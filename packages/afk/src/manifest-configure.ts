import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { confirm, input, search, select } from "@inquirer/prompts";
import {
  addManifestItem,
  emptyEditableManifest,
  isItemManifestArea,
  itemLabel,
  manifestFilename,
  removeManifestItem,
  serializeEditableManifest,
  setManifestItemDefaultValues,
  setSkillAutoInvocationValues,
  updateManifestItem,
  validateEditableManifest,
  type EditableManifest,
  type EditableManifestArea,
  type EditableManifestItem,
} from "./manifest-editor.js";
import {
  isHookManifest,
  loadDefaultManifestContent,
  localManifestDir,
  type HookManifest,
  type HookManifestItem,
  type McpManifestItem,
  type RulesManifest,
  type SkillManifest,
  type SkillManifestItem,
  type PluginManifestItem,
  type PluginPostInstallCommand,
} from "./manifest.js";
import type { SkillProfileCatalog } from "./skills/profiles.js";
import { isPromptExit } from "./menu.js";
import { muted, sectionTitle } from "./brand.js";
import { afkPromptTheme, afkSearchTheme, afkSelectTheme, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import { searchableCheckbox } from "./searchable-checkbox.js";
import { paint, strong, terminalPalette } from "./terminal-theme.js";
import type { CliOptions, Runtime, SkillProfileMode } from "./types.js";
import { runArea } from "./setup.js";

export type ManifestArea = EditableManifestArea | "profiles";
type ManifestAreaChoice = ManifestArea | "finish";
export type ManifestAction = "add" | "edit" | "bulk-edit" | "remove" | "toggle-default" | "toggle-auto" | "toggle-always-on" | "set-profile-mode" | "edit-rules" | "finish" | "back";
type BulkSkillSetting = "on" | "off" | "unchanged";
type EditableDraft = EditableManifest | SkillProfileCatalog;
type Drafts = Record<ManifestArea, EditableDraft>;
type SerializedDrafts = Partial<Record<`${ManifestArea}.json`, string>>;
type SelectChoice<Value extends string> = {
  name: string;
  value: Value;
  description?: string;
  searchAliases?: string[];
};
type InputConfig = {
  message: string;
  default?: string;
  required?: boolean;
};
type MultiSelectChoice = {
  name: string;
  value: string;
  description?: string;
  searchAliases?: string[];
};
type BooleanToggleChoice = MultiSelectChoice & { enabled: boolean };

export type ManifestConfigurePrompts = {
  selectArea: (choices: Array<SelectChoice<ManifestAreaChoice>>) => Promise<ManifestAreaChoice>;
  selectAction: (area: ManifestArea, choices: Array<SelectChoice<ManifestAction>>) => Promise<ManifestAction>;
  selectItem: (area: ManifestArea, choices: Array<SelectChoice<string>>, message: string) => Promise<string>;
  selectItems: (area: ManifestArea, choices: MultiSelectChoice[], message: string) => Promise<string[]>;
  selectBulkSkillSetting: (message: string, onLabel: string, offLabel: string) => Promise<BulkSkillSetting>;
  selectProfileMode: (current: SkillProfileMode) => Promise<SkillProfileMode>;
  toggleBooleans: (area: ManifestArea, choices: BooleanToggleChoice[], message: string) => Promise<Record<string, boolean>>;
  input: (config: InputConfig) => Promise<string>;
  confirm: (message: string, defaultValue: boolean) => Promise<boolean>;
};

const manifestAreas: ManifestArea[] = ["rules", "skills", "profiles", "mcps", "plugins", "hooks"];

const areaDescriptions: Record<ManifestArea, string> = {
  rules: "Point rules sync at one AGENTS.md source.",
  skills: "Add, edit, remove, and toggle skills.",
  profiles: "Edit profile-level always-on skills.",
  mcps: "Add, edit, remove, and toggle MCP recommendations.",
  plugins: "Add, edit, remove, and toggle plugin installers.",
  hooks: "Add, edit, remove, and toggle lifecycle hooks.",
};

export async function runManifestConfigure(runtime: Runtime, options: CliOptions): Promise<number> {
  return runManifestConfigureWithPrompts(runtime, options, inquirerPrompts());
}

export async function runManifestConfigureArea(runtime: Runtime, options: CliOptions, area: ManifestArea): Promise<number> {
  return runManifestConfigureWithPrompts(runtime, options, inquirerPrompts(), { area });
}

export async function runManifestConfigureAreaAction(runtime: Runtime, options: CliOptions, area: ManifestArea, action: ManifestAction): Promise<number> {
  return runManifestConfigureWithPrompts(runtime, options, inquirerPrompts(), { area, action });
}

export async function runManifestConfigureWithPrompts(
  runtime: Runtime,
  options: CliOptions,
  prompts: ManifestConfigurePrompts,
  initial?: { area: ManifestArea; action?: ManifestAction },
): Promise<number> {
  const outputDir = options.manifestConfigureLocal ? join(options.cwd, "afk", "catalog") : localManifestDir(options.homeDir);
  const original = readEditableManifests(outputDir);
  const drafts = cloneDrafts(original);
  const touched = new Set<ManifestArea>();
  const setupEligibleSkillActions = new Set<"edit" | "bulk-edit">();

  resetPromptSteps();
  runtime.io.stdout(`\n${sectionTitle("AFK catalog")}`);
  runtime.io.stdout(muted(`Writing to: ${outputDir}`));
  try {
    if (initial) {
      runtime.io.stdout(renderPromptStep("Catalog editor", `Editing ${catalogFilename(initial.area)}.`));
      await editManifestArea(runtime, prompts, drafts, touched, setupEligibleSkillActions, initial.area, options, initial.action);
    } else {
      runtime.io.stdout(renderPromptStep("Catalog editor", "Choose a catalog file, make changes, and finish to review the JSON before writing."));

      while (true) {
        const area = await prompts.selectArea(areaChoices(drafts));
        if (area === "finish") {
          break;
        }

        const navigation = await editManifestArea(runtime, prompts, drafts, touched, setupEligibleSkillActions, area, options);
        if (navigation === "finish") {
          break;
        }
      }
    }
  } catch (error) {
    const hasUnsavedChanges = Object.keys(changedDrafts(original, drafts, touched)).length > 0;
    if (!isPromptExit(error) || !hasUnsavedChanges) {
      throw error;
    }

    runtime.io.stdout("\nYou have unsaved catalog changes.");
    const shouldReview = await prompts.confirm("Finish and review changes before exiting?", true);
    if (!shouldReview) {
      runtime.io.stdout("\nDiscarded unsaved catalog changes.");
      return 130;
    }
  }

  const validationErrors = validationErrorsFor(drafts, touched);
  if (validationErrors.length > 0) {
    runtime.io.stderr("\nCatalog validation failed:");
    for (const error of validationErrors) {
      runtime.io.stderr(`- ${error}`);
    }
    return 1;
  }

  const serialized = changedDrafts(original, drafts, touched);
  if (Object.keys(serialized).length === 0) {
    runtime.io.stdout("\nNo catalog changes planned.");
    return 0;
  }

  runtime.io.stdout(`\n${sectionTitle("Catalog preview")}`);
  for (const [filename, content] of Object.entries(serialized)) {
    runtime.io.stdout(`\n--- ${filename} ---\n${content.trimEnd()}`);
  }

  if (options.dryRun) {
    runtime.io.stdout("\nDry run complete. No catalog files written.");
    return 0;
  }

  runtime.io.stdout(renderPromptStep("Write catalog", "Review the preview above, then confirm whether AFK should write the files."));
  const shouldWrite = await prompts.confirm(`Write ${Object.keys(serialized).length} catalog file(s)?`, true);
  if (!shouldWrite) {
    runtime.io.stdout("\nCancelled. No catalog files written.");
    return 0;
  }

  mkdirSync(outputDir, { recursive: true });
  for (const [filename, content] of Object.entries(serialized)) {
    writeFileSync(join(outputDir, filename), content);
  }

  runtime.io.stdout(`\nWrote ${Object.keys(serialized).length} catalog file(s) to ${outputDir}.`);
  const affectedSkillIds = changedSkillIds(original, drafts, setupEligibleSkillActions);
  if (!options.manifestConfigureLocal && affectedSkillIds.length > 0) {
    runtime.io.stdout(renderPromptStep("Apply skill changes", "Run setup only for the skills changed in this catalog edit."));
    const skillLabel = affectedSkillIds.length === 1 ? "skill" : "skills";
    const shouldRunSetup = await prompts.confirm(
      `Run setup for ${affectedSkillIds.length} affected ${skillLabel} now?`,
      true,
    );
    if (shouldRunSetup) {
      return runArea("skills", runtime, {
        ...options,
        setupScope: "global",
        scopeExplicit: true,
        setupManifestsPrepared: true,
        selectedSkillIds: affectedSkillIds,
        selectedSkillAgentIds: [],
        manifestContents: {
          ...options.manifestContents,
          "skills.json": rawSerialize(drafts.skills),
        },
      });
    }
  }

  return 0;
}

async function editManifestArea(
  runtime: Runtime,
  prompts: ManifestConfigurePrompts,
  drafts: Drafts,
  touched: Set<ManifestArea>,
  setupEligibleSkillActions: Set<"edit" | "bulk-edit">,
  area: ManifestArea,
  options: CliOptions,
  initialAction?: ManifestAction,
): Promise<"back" | "finish"> {
  runtime.io.stdout(renderPromptStep(areaTitle(area), areaDescriptions[area]));
  let action = initialAction;

  while (true) {
    action = action ?? await prompts.selectAction(area, actionChoices(area, drafts[area]));
    if (action === "finish") {
      return "finish";
    }
    if (action === "back") {
      return "back";
    }

    if (area === "rules") {
      drafts.rules = await configureRules(prompts, drafts.rules);
      touched.add("rules");
      if (initialAction) {
        return "back";
      }
      action = undefined;
      continue;
    }

    if (area === "profiles") {
      drafts.profiles = await applyProfileAction(prompts, drafts.profiles, drafts.skills, action);
      touched.add("profiles");
      if (initialAction) {
        return "back";
      }
      action = undefined;
      continue;
    }

    if (area === "skills" && action === "bulk-edit") {
      const result = await applyBulkSkillEdit(prompts, drafts.skills as EditableManifest, drafts.profiles);
      drafts.skills = result.skills;
      drafts.profiles = result.profiles;
      touched.add("skills");
      touched.add("profiles");
      setupEligibleSkillActions.add("bulk-edit");
      if (initialAction) {
        return "back";
      }
      action = undefined;
      continue;
    }

    if (!isItemManifestArea(area)) {
      return "back";
    }

    try {
      drafts[area] = await applyItemAction(prompts, area, drafts[area] as EditableManifest, action, options);
      touched.add(area);
      if (area === "skills" && action === "edit") {
        setupEligibleSkillActions.add("edit");
      }
      if (initialAction) {
        return "back";
      }
    } catch (error) {
      if (isPromptExit(error)) {
        throw error;
      }
      runtime.io.stderr(`\n${error instanceof Error ? error.message : String(error)}`);
      if (initialAction) {
        return "back";
      }
    }
    action = undefined;
  }
}

async function applyItemAction(
  prompts: ManifestConfigurePrompts,
  area: Exclude<EditableManifestArea, "rules">,
  manifest: EditableManifest,
  action: ManifestAction,
  options: CliOptions,
): Promise<EditableManifest> {
  if (action === "add") {
    if (area === "hooks" && entryCount(manifest) === 0) {
      const shouldAddDefaultHooks = await prompts.confirm("Add default AFK hooks?", true);
      if (shouldAddDefaultHooks) {
        const defaultHooks = await loadDefaultHooks(options);
        return defaultHooks;
      }
    }

    const item = await promptItem(prompts, area);
    const next = addManifestItem(area, manifest, item);
    return area === "skills" ? ensureSkillDefaultSource(next as SkillManifest, item as SkillManifestItem) : next;
  }

  if (action === "remove") {
    const selectedId = await prompts.selectItem(area, itemChoices(area, manifest), `${actionLabel(action)} which ${singularArea(area)}?`);
    const selected = findItem(manifest, selectedId);
    const shouldRemove = await prompts.confirm(`Remove ${selected ? itemLabel(selected) : selectedId}?`, false);
    return shouldRemove ? removeManifestItem(area, manifest, selectedId) : manifest;
  }

  if (action === "toggle-default") {
    return setManifestItemDefaultValues(
      area,
      manifest,
      await prompts.toggleBooleans(area, booleanToggleChoices(manifest, "default"), `Toggle ${singularArea(area)} defaults`),
    );
  }

  if (action === "toggle-auto" && area === "skills") {
    return setSkillAutoInvocationValues(
      manifest,
      await prompts.toggleBooleans(area, booleanToggleChoices(manifest, "autoInvocation"), "Toggle skill autoInvocation"),
    );
  }

  if (action === "edit") {
    const selectedId = await prompts.selectItem(area, itemChoices(area, manifest), `${actionLabel(action)} which ${singularArea(area)}?`);
    const existing = findItem(manifest, selectedId);
    if (!existing) {
      throw new Error(`Missing ${area} id: ${selectedId}`);
    }
    const item = await promptItem(prompts, area, existing);
    const next = updateManifestItem(area, manifest, selectedId, item);
    return area === "skills" ? ensureSkillDefaultSource(next as SkillManifest, item as SkillManifestItem) : next;
  }

  return manifest;
}

async function applyBulkSkillEdit(
  prompts: ManifestConfigurePrompts,
  skillsManifest: EditableManifest,
  profilesManifest: EditableDraft,
): Promise<{ skills: SkillManifest; profiles: SkillProfileCatalog }> {
  const profiles = normalizeProfileDraft(profilesManifest);
  const selectedIds = await prompts.selectItems(
    "skills",
    bulkSkillChoices(skillsManifest, profiles),
    "Select skills to bulk edit",
  );

  if (selectedIds.length === 0) {
    return { skills: skillsManifest as SkillManifest, profiles };
  }

  const invocation = await prompts.selectBulkSkillSetting(
    "Set invocation mode for selected skills",
    "Auto",
    "Manual",
  );
  const alwaysOn = await prompts.selectBulkSkillSetting(
    "Set always-on for selected skills",
    "On",
    "Off",
  );

  const invocationValue = settingValue(invocation);
  const skills = invocationValue === undefined
    ? skillsManifest as SkillManifest
    : setSkillAutoInvocationValues(
      skillsManifest,
      Object.fromEntries(selectedIds.map((id) => [id, invocationValue])),
    );
  const alwaysOnValue = settingValue(alwaysOn);
  const nextAlwaysOn = alwaysOnValue === undefined
    ? profiles.alwaysOn
    : updateAlwaysOn(profiles.alwaysOn, selectedIds, alwaysOnValue);

  return {
    skills,
    profiles: { ...profiles, alwaysOn: nextAlwaysOn },
  };
}

async function applyProfileAction(
  prompts: ManifestConfigurePrompts,
  manifest: EditableDraft,
  skillsManifest: EditableDraft,
  action: ManifestAction,
): Promise<SkillProfileCatalog> {
  const profileCatalog = normalizeProfileDraft(manifest);
  if (action === "set-profile-mode") {
    return {
      ...profileCatalog,
      mode: await prompts.selectProfileMode(profileCatalog.mode),
    };
  }

  if (action !== "toggle-always-on") {
    return profileCatalog;
  }

  const values = await prompts.toggleBooleans("profiles", alwaysOnToggleChoices(profileCatalog, skillsManifest), "Toggle always-on skills");
  const alwaysOn = Object.entries(values)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id)
    .sort((left, right) => left.localeCompare(right));
  return { ...profileCatalog, alwaysOn };
}

async function configureRules(prompts: ManifestConfigurePrompts, manifest: EditableManifest): Promise<RulesManifest> {
  const existing = isRulesDraft(manifest) ? manifest : { version: 1, source: "github", url: "" };
  const url = await prompts.input({
    message: "Rules raw URL or local path",
    default: existing.url,
    required: true,
  });

  return {
    version: 1,
    source: inferSource(url),
    url,
  };
}

async function promptItem(prompts: ManifestConfigurePrompts, area: Exclude<EditableManifestArea, "rules">, existing?: EditableManifestItem): Promise<EditableManifestItem> {
  switch (area) {
    case "skills":
      return promptSkill(prompts, existing as SkillManifestItem | undefined);
    case "mcps":
      return promptMcp(prompts, existing as McpManifestItem | undefined);
    case "plugins":
      return promptPlugin(prompts, existing as PluginManifestItem | undefined);
    case "hooks":
      return promptHook(prompts, existing as HookManifestItem | undefined);
  }
}

async function promptSkill(prompts: ManifestConfigurePrompts, existing?: SkillManifestItem): Promise<SkillManifestItem> {
  const existingSkill = skillIdFromArgs(existing?.args ?? []);
  const source = await prompts.input({ message: "Skill source repo URL", default: existing?.source ?? "", required: true });
  const skill = await prompts.input({ message: "Specific skill id/name (blank installs the whole source)", default: existingSkill ?? "" });
  const id = await prompts.input({ message: "Skill id", default: existing?.id ?? inferId(skill || source), required: true });
  const label = await prompts.input({ message: "Skill label", default: existing?.label ?? inferLabel(id), required: true });
  const defaultValue = existing?.default ?? true;
  const autoInvocationValue = existing?.autoInvocation ?? false;
  const startDisabledValue = existing?.startDisabled ?? false;
  const isDefault = await prompts.confirm(booleanPrompt("Selected by default?", defaultValue, existing ? "current" : "default"), defaultValue);
  const autoInvocation = await prompts.confirm(booleanPrompt("Allow automatic model invocation?", autoInvocationValue, existing ? "current" : "default"), autoInvocationValue);
  const startDisabled = await prompts.confirm(booleanPrompt("Start installed skill disabled?", startDisabledValue, existing ? "current" : "default"), startDisabledValue);

  return {
    id,
    label,
    source,
    args: skillArgsFromInput(existing, skill),
    default: isDefault,
    autoInvocation,
    startDisabled,
    role: existing?.role ?? "primitive",
    composes: existing?.composes ?? [],
  };
}

async function promptMcp(prompts: ManifestConfigurePrompts, existing?: McpManifestItem): Promise<McpManifestItem> {
  const source = await prompts.input({ message: "MCP source or command", default: existing?.source ?? "", required: true });
  const id = await prompts.input({ message: "MCP id", default: existing?.id ?? inferId(source), required: true });
  const label = await prompts.input({ message: "MCP label", default: existing?.label ?? inferLabel(id), required: true });
  const args = await prompts.input({ message: "add-mcp args", default: existing?.args.join(" ") ?? `--name ${id}` });
  const defaultValue = existing?.default ?? true;
  const isDefault = await prompts.confirm(booleanPrompt("Selected by default?", defaultValue, existing ? "current" : "default"), defaultValue);

  return {
    id,
    label,
    source,
    args: splitArgs(args),
    default: isDefault,
  };
}

async function promptPlugin(prompts: ManifestConfigurePrompts, existing?: PluginManifestItem): Promise<PluginManifestItem> {
  const installLine = installLineFromCommand(existing?.install);
  const existingPostInstallLine = postInstallLine(existing?.postInstall);
  const id = await prompts.input({ message: "Plugin id", default: existing?.id ?? inferId(installLine || "plugin"), required: true });
  const label = await prompts.input({ message: "Plugin label", default: existing?.label ?? inferLabel(id), required: true });
  const description = await prompts.input({ message: "Plugin description", default: existing?.description ?? `${label} install script.`, required: true });
  const nextInstallLine = await prompts.input({ message: "Plugin install command", default: installLine, required: true });
  const nextPostInstallLine = await prompts.input({ message: "Post-install command (optional)", default: existingPostInstallLine });
  const defaultValue = existing?.default ?? true;
  const isDefault = await prompts.confirm(booleanPrompt("Selected by default?", defaultValue, existing ? "current" : "default"), defaultValue);

  return {
    id,
    label,
    description,
    install: installLine === nextInstallLine && existing?.install ? existing.install : { command: "sh", args: ["-c", nextInstallLine] },
    ...(nextPostInstallLine.trim()
      ? { postInstall: postInstallFromLine(nextPostInstallLine, existing?.postInstall) }
      : {}),
    default: isDefault,
  };
}

async function promptHook(prompts: ManifestConfigurePrompts, existing?: HookManifestItem): Promise<HookManifestItem> {
  const id = await prompts.input({ message: "Hook id", default: existing?.id ?? "hook", required: true });
  const label = await prompts.input({ message: "Hook label", default: existing?.label ?? inferLabel(id), required: true });
  const description = await prompts.input({ message: "Hook description", default: existing?.description ?? `${label} hook.`, required: true });
  const source = await prompts.input({ message: "Hook source", default: existing?.source ?? "", required: true });
  const command = await prompts.input({ message: "Hook command", default: existing?.command ?? "node", required: true });
  const args = await prompts.input({ message: "Hook args", default: existing?.args.join(" ") ?? "${HOOK_FILE}" });
  const agents = await prompts.input({ message: "Hook agents", default: existing?.agents.join(", ") ?? "codex, claude, cursor-local", required: true });
  const defaultValue = existing?.default ?? true;
  const isDefault = await prompts.confirm(booleanPrompt("Selected by default?", defaultValue, existing ? "current" : "default"), defaultValue);

  return {
    id,
    label,
    description,
    source,
    command,
    args: splitArgs(args),
    events: ["stop"],
    agents: parseHookAgents(agents),
    default: isDefault,
  };
}

async function loadDefaultHooks(options: CliOptions): Promise<HookManifest> {
  const content = await loadDefaultManifestContent("hooks.json", options);
  if (!content) {
    throw new Error("Could not load default hooks catalog file from the configured defaults source.");
  }

  const parsed: unknown = JSON.parse(content);
  if (!isHookManifest(parsed)) {
    throw new Error("Default hooks catalog file from the configured defaults source is invalid.");
  }

  return parsed;
}

function readEditableManifests(outputDir: string): Drafts {
  return {
    rules: readManifestOrEmpty(outputDir, "rules"),
    skills: readManifestOrEmpty(outputDir, "skills"),
    profiles: readProfilesOrEmpty(outputDir),
    mcps: readManifestOrEmpty(outputDir, "mcps"),
    plugins: readManifestOrEmpty(outputDir, "plugins"),
    hooks: readManifestOrEmpty(outputDir, "hooks"),
  };
}

function readManifestOrEmpty(outputDir: string, area: EditableManifestArea): EditableManifest {
  const path = join(outputDir, catalogFilename(area));
  if (!existsSync(path)) {
    return emptyEditableManifest(area);
  }

  return JSON.parse(readFileSync(path, "utf8")) as EditableManifest;
}

function readProfilesOrEmpty(outputDir: string): SkillProfileCatalog {
  const path = join(outputDir, catalogFilename("profiles"));
  if (!existsSync(path)) {
    return emptyProfileCatalog();
  }

  return normalizeProfileDraft(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

function cloneDrafts(drafts: Drafts): Drafts {
  return {
    rules: cloneDraft(drafts.rules),
    skills: cloneDraft(drafts.skills),
    profiles: cloneProfileDraft(drafts.profiles),
    mcps: cloneDraft(drafts.mcps),
    plugins: cloneDraft(drafts.plugins),
    hooks: cloneDraft(drafts.hooks),
  };
}

function cloneDraft(manifest: EditableManifest): EditableManifest {
  return JSON.parse(JSON.stringify(manifest)) as EditableManifest;
}

function cloneProfileDraft(manifest: EditableDraft): SkillProfileCatalog {
  return normalizeProfileDraft(JSON.parse(JSON.stringify(manifest)) as unknown);
}

function changedDrafts(original: Drafts, drafts: Drafts, touched: Set<ManifestArea>): SerializedDrafts {
  const serialized: SerializedDrafts = {};
  for (const area of touched) {
    const originalContent = rawSerialize(original[area]);
    const nextContent = serializeDraft(area, drafts[area]);
    if (originalContent !== nextContent) {
      serialized[catalogFilename(area)] = nextContent;
    }
  }

  return serialized;
}

function changedSkillIds(
  original: Drafts,
  drafts: Drafts,
  setupEligibleSkillActions: Set<"edit" | "bulk-edit">,
): string[] {
  if (setupEligibleSkillActions.size === 0) {
    return [];
  }

  const previousSkills = original.skills as SkillManifest;
  const nextSkills = drafts.skills as SkillManifest;
  const previousItems = new Map(previousSkills.items.map((item) => [item.id, setupSkillSignature(item)]));
  const affected = nextSkills.items
    .filter((item) => previousItems.get(item.id) !== setupSkillSignature(item))
    .map((item) => item.id);
  const originalAlwaysOn = new Set(normalizeProfileDraft(original.profiles).alwaysOn);
  const nextAlwaysOn = new Set(normalizeProfileDraft(drafts.profiles).alwaysOn);

  for (const item of nextSkills.items) {
    if (originalAlwaysOn.has(item.id) !== nextAlwaysOn.has(item.id)) {
      affected.push(item.id);
    }
  }

  return [...new Set(affected)];
}

function setupSkillSignature(item: SkillManifestItem): string {
  return JSON.stringify({
    id: item.id,
    source: item.source,
    args: item.args,
    autoInvocation: item.autoInvocation ?? true,
    startDisabled: item.startDisabled === true,
  });
}

function rawSerialize(manifest: EditableDraft): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function validationErrorsFor(drafts: Drafts, touched: Set<ManifestArea>): string[] {
  return [...touched].flatMap((area) => validateDraft(area, drafts[area]).map((error) => `${catalogFilename(area)}: ${error}`));
}

function areaChoices(drafts: Drafts): Array<SelectChoice<ManifestAreaChoice>> {
  return [
    ...manifestAreas.map((area) => ({
      name: `${areaTitle(area)} (${entryCount(drafts[area])})`,
      value: area,
      description: areaDescriptions[area],
    })),
    {
      name: "Finish and review",
      value: "finish" as const,
      description: "Preview changed catalog JSON before writing.",
    },
  ];
}

function actionChoices(area: ManifestArea, manifest: EditableDraft): Array<SelectChoice<ManifestAction>> {
  if (area === "rules") {
    return [
      { name: "Edit rules source", value: "edit-rules", description: "Change the rules URL/path and inferred source type." },
      finishActionChoice(),
      manageOtherCatalogsChoice(),
    ];
  }

  if (area === "profiles") {
    return [
      { name: "Set profile mode", value: "set-profile-mode", description: "Choose strict availability or context-only filtering." },
      { name: "Toggle alwaysOn", value: "toggle-always-on", description: "Choose skills that stay active across enabled profiles." },
      finishActionChoice(),
      manageOtherCatalogsChoice(),
    ];
  }

  const hasItems = entryCount(manifest) > 0;
  return [
    { name: `Add ${singularArea(area)}`, value: "add" },
    ...(area === "skills" && hasItems ? [{ name: "Bulk edit skills", value: "bulk-edit" as const, description: "Set invocation and always-on policy for multiple skills." }] : []),
    ...(hasItems ? [{ name: `Edit ${singularArea(area)}`, value: "edit" as const }] : []),
    ...(hasItems ? [{ name: `Remove ${singularArea(area)}`, value: "remove" as const }] : []),
    ...(hasItems ? [{ name: "Toggle default", value: "toggle-default" as const }] : []),
    ...(area === "skills" && hasItems ? [{ name: "Toggle autoInvocation", value: "toggle-auto" as const }] : []),
    finishActionChoice(),
    manageOtherCatalogsChoice(),
  ];
}

function finishActionChoice(): SelectChoice<ManifestAction> {
  return {
    name: "Finish and review",
    value: "finish",
    description: "Preview changed catalog JSON before writing.",
  };
}

function manageOtherCatalogsChoice(): SelectChoice<ManifestAction> {
  return {
    name: "Back to manage other catalogs",
    value: "back",
  };
}

function itemChoices(area: Exclude<EditableManifestArea, "rules">, manifest: EditableManifest): Array<SelectChoice<string>> {
  return itemsFromManifest(manifest).map((item) => ({
    name: area === "skills" ? brandedSkillId(item.id) : itemLabel(item),
    value: item.id,
    description: area === "skills" ? skillItemDescription(item) : itemDescription(item),
    ...(area === "skills" ? { searchAliases: [item.id, item.label, itemDescription(item)] } : {}),
  }));
}

function brandedSkillId(id: string): string {
  return strong(paint(terminalPalette.brass, id));
}

function skillItemDescription(item: EditableManifestItem): string {
  return [
    item.label !== item.id ? `label: ${item.label}` : undefined,
    itemDescription(item),
  ].filter((value): value is string => Boolean(value)).join(" · ");
}

function booleanToggleChoices(manifest: EditableManifest, field: "default" | "autoInvocation"): BooleanToggleChoice[] {
  return itemsFromManifest(manifest).map((item) => {
    const enabled = field === "default" ? item.default : autoInvocationValue(item);
    return {
      name: `${booleanSwitch(enabled)} ${itemLabel(item)}`,
      value: item.id,
      enabled,
      description: itemDescription(item),
    };
  });
}

function bulkSkillChoices(manifest: EditableManifest, profiles: SkillProfileCatalog): MultiSelectChoice[] {
  const alwaysOnIds = new Set(profiles.alwaysOn);
  return itemsFromManifest(manifest).map((item) => ({
    name: brandedSkillId(item.id),
    value: item.id,
    description: [
      `invocation: ${autoInvocationValue(item) ? "auto" : "manual"}`,
      `always-on: ${alwaysOnIds.has(item.id) ? "on" : "off"}`,
      skillItemDescription(item),
    ].join(" · "),
    searchAliases: alwaysOnSearchAliases(item),
  }));
}

function itemsFromManifest(manifest: EditableManifest): EditableManifestItem[] {
  const record = toRecord(manifest);
  if (!record || !Array.isArray(record.items)) {
    return [];
  }

  return record.items.filter(isEditableItem);
}

function findItem(manifest: EditableManifest, id: string): EditableManifestItem | undefined {
  return itemsFromManifest(manifest).find((item) => item.id === id);
}

function entryCount(manifest: EditableDraft): number {
  if (isProfileCatalogDraft(manifest)) {
    return manifest.alwaysOn.length + manifest.items.length;
  }

  if (isRulesDraft(manifest)) {
    return manifest.url ? 1 : 0;
  }

  return itemsFromManifest(manifest).length;
}

function ensureSkillDefaultSource(manifest: SkillManifest, item: SkillManifestItem): SkillManifest {
  if (manifest.defaultSource.trim()) {
    return manifest;
  }

  return { ...manifest, defaultSource: item.source };
}

function itemDescription(item: EditableManifestItem): string {
  const states = [`default: ${booleanState(item.default)}`];
  if ("autoInvocation" in item) {
    states.push(`autoInvocation: ${booleanState(item.autoInvocation ?? true)}`);
  }
  if ("startDisabled" in item) {
    states.push(`startDisabled: ${booleanState(item.startDisabled ?? false)}`);
  }

  if ("description" in item) {
    return [states.join(" · "), item.description].join(" · ");
  }

  if ("source" in item) {
    return [states.join(" · "), item.source].join(" · ");
  }

  return states.join(" · ");
}

function actionLabel(action: ManifestAction): string {
  switch (action) {
    case "edit":
      return "Edit";
    case "bulk-edit":
      return "Bulk edit";
    case "remove":
      return "Remove";
    case "toggle-default":
      return "Toggle default for";
    case "toggle-auto":
      return "Toggle autoInvocation for";
    case "toggle-always-on":
      return "Toggle alwaysOn for";
    case "set-profile-mode":
      return "Set profile mode for";
    default:
      return "Select";
  }
}

function areaTitle(area: ManifestArea): string {
  switch (area) {
    case "rules":
      return "Rules";
    case "skills":
      return "Skills";
    case "profiles":
      return "Profiles";
    case "mcps":
      return "MCPs";
    case "plugins":
      return "Plugins";
    case "hooks":
      return "Hooks";
  }
}

function singularArea(area: Exclude<EditableManifestArea, "rules"> | "profiles"): string {
  switch (area) {
    case "skills":
      return "skill";
    case "profiles":
      return "profile";
    case "mcps":
      return "MCP";
    case "plugins":
      return "plugin";
    case "hooks":
      return "hook";
  }
}

function catalogFilename(area: ManifestArea): `${ManifestArea}.json` {
  return area === "profiles" ? "profiles.json" : manifestFilename(area);
}

function serializeDraft(area: ManifestArea, manifest: EditableDraft): string {
  if (area === "profiles") {
    return `${JSON.stringify(normalizeProfileDraft(manifest), null, 2)}\n`;
  }

  return serializeEditableManifest(area, manifest as EditableManifest);
}

function validateDraft(area: ManifestArea, manifest: EditableDraft): string[] {
  if (area === "profiles") {
    return isProfileCatalogDraft(manifest) ? [] : ["Invalid profiles manifest shape"];
  }

  return validateEditableManifest(area, manifest as EditableManifest);
}

function alwaysOnToggleChoices(profiles: SkillProfileCatalog, skillsManifest: EditableDraft): BooleanToggleChoice[] {
  const skillItems = itemsFromManifest(skillsManifest as EditableManifest);
  const byId = new Map(skillItems.map((item) => [item.id, item]));
  const ids = [...new Set([...skillItems.map((item) => item.id), ...profiles.alwaysOn])].sort((left, right) => left.localeCompare(right));
  const enabledIds = new Set(profiles.alwaysOn);
  return ids.map((id) => {
    const item = byId.get(id);
    const enabled = enabledIds.has(id);
    return {
      name: `${booleanSwitch(enabled)} ${item ? itemLabel(item) : id}`,
      value: id,
      enabled,
      description: item ? itemDescription(item) : "Missing from skills catalog",
      searchAliases: item ? alwaysOnSearchAliases(item) : ["missing:true"],
    };
  });
}

function alwaysOnSearchAliases(item: EditableManifestItem): string[] {
  const aliases = [
    `default:${booleanState(item.default)}`,
  ];
  if ("autoInvocation" in item) {
    aliases.push(`auto:${booleanState(item.autoInvocation ?? true)}`);
    aliases.push(`autoInvocation:${booleanState(item.autoInvocation ?? true)}`);
  }
  if ("startDisabled" in item) {
    aliases.push(`startDisabled:${booleanState(item.startDisabled ?? false)}`);
    aliases.push(`start-disabled:${booleanState(item.startDisabled ?? false)}`);
  }
  return aliases;
}

function emptyProfileCatalog(): SkillProfileCatalog {
  return { version: 1, mode: "strict", alwaysOn: [], items: [] };
}

function normalizeProfileDraft(value: unknown): SkillProfileCatalog {
  if (!isProfileCatalogDraft(value)) {
    return emptyProfileCatalog();
  }

  return {
    version: Math.max(value.version, 1),
    mode: value.mode === "context" ? "context" : "strict",
    alwaysOn: uniqueStrings(value.alwaysOn),
    items: value.items
      .map((item) => ({
        id: item.id.trim().toLowerCase(),
        name: item.name.trim() || item.id.trim(),
        skills: uniqueStrings(item.skills),
      }))
      .filter((item) => item.id)
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function isProfileCatalogDraft(value: unknown): value is SkillProfileCatalog {
  return isRecord(value) &&
    typeof value.version === "number" &&
    (value.mode === undefined || value.mode === "strict" || value.mode === "context") &&
    Array.isArray(value.alwaysOn) &&
    value.alwaysOn.every((item) => typeof item === "string") &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Array.isArray(item.skills) &&
      item.skills.every((skill) => typeof skill === "string")
    );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function settingValue(setting: BulkSkillSetting): boolean | undefined {
  if (setting === "unchanged") {
    return undefined;
  }

  return setting === "on";
}

function updateAlwaysOn(current: string[], selectedIds: string[], enabled: boolean): string[] {
  const selected = new Set(selectedIds);
  return uniqueStrings(enabled
    ? [...current, ...selectedIds]
    : current.filter((id) => !selected.has(id)));
}

function installLineFromCommand(install?: PluginManifestItem["install"]): string {
  if (!install) {
    return "";
  }

  if ((install.command === "sh" || install.command === "bash") && install.args[0] === "-c" && install.args[1]) {
    return install.args[1];
  }

  return [install.command, ...install.args].join(" ");
}

function postInstallLine(postInstall?: PluginManifestItem["postInstall"]): string {
  if (!postInstall) {
    return "";
  }

  if ((postInstall.command === "sh" || postInstall.command === "bash") && postInstall.args[0] === "-c" && postInstall.args[1]) {
    return postInstall.args[1];
  }

  return [postInstall.command, ...postInstall.args].join(" ");
}

function postInstallFromLine(line: string, existing?: PluginManifestItem["postInstall"]): PluginPostInstallCommand {
  if (line === postInstallLine(existing) && typeof existing === "object") {
    return existing;
  }

  return { command: "sh", args: ["-c", line] };
}

function parseHookAgents(value: string): HookManifestItem["agents"] {
  const agents = value.split(",").map((item) => item.trim()).filter(Boolean);
  const parsed = agents.filter((agent): agent is HookManifestItem["agents"][number] => agent === "codex" || agent === "claude" || agent === "cursor-local");
  return parsed.length > 0 ? parsed : ["codex"];
}

function booleanPrompt(label: string, value: boolean, kind: "current" | "default"): string {
  return `${label} (${kind}: ${booleanState(value)})`;
}

function booleanState(value: boolean): "on" | "off" {
  return value ? "on" : "off";
}

function booleanSwitch(value: boolean): string {
  return `[${value ? "on " : "off"}]`;
}

function autoInvocationValue(item: EditableManifestItem): boolean {
  return "autoInvocation" in item ? item.autoInvocation ?? true : false;
}

function inquirerPrompts(): ManifestConfigurePrompts {
  return {
    selectArea: async (choices) => select<ManifestAreaChoice>({
      message: "Choose a catalog file to edit",
      choices,
      pageSize: 8,
      theme: afkSelectTheme,
    }),
    selectAction: async (_area, choices) => select<ManifestAction>({
      message: "Choose an action",
      choices,
      pageSize: 8,
      theme: afkSelectTheme,
    }),
    selectItem: async (area, choices, message) => area === "skills"
      ? search<string>({
        message,
        source: async (term) => filterCatalogSelectChoices(choices, term),
        pageSize: 12,
        instructions: {
          navigation: "Use arrow keys to move.",
          pager: "Type to filter by id, label, source, or policy.",
        },
        theme: afkSearchTheme,
      })
      : select<string>({
        message,
        choices,
        pageSize: 12,
        theme: afkSelectTheme,
      }),
    selectItems: async (_area, choices, message) => selectItemsPrompt(message, choices),
    selectBulkSkillSetting: async (message, onLabel, offLabel) => select<BulkSkillSetting>({
      message,
      choices: [
        { name: "Leave unchanged", value: "unchanged" },
        { name: onLabel, value: "on" },
        { name: offLabel, value: "off" },
      ],
      default: "unchanged",
      theme: afkSelectTheme,
    }),
    selectProfileMode: async (current) => select<SkillProfileMode>({
      message: "Choose profile mode",
      choices: [
        {
          name: "strict",
          value: "strict",
          description: "Only alwaysOn and enabled profile skills stay active.",
        },
        {
          name: "context",
          value: "context",
          description: "Keep manual skills active; filter discoverable skills by profile.",
        },
      ],
      default: current,
      theme: afkSelectTheme,
    }),
    toggleBooleans: async (_area, choices, message) => toggleBooleanPrompt(message, choices),
    input: askInput,
    confirm: askConfirm,
  };
}

export function filterCatalogSelectChoices<Value extends string>(
  choices: Array<SelectChoice<Value>>,
  term: string | undefined,
): Array<SelectChoice<Value>> {
  const tokens = term?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return choices;
  }

  return choices.filter((choice) => {
    const searchable = [choice.value, choice.description ?? "", ...(choice.searchAliases ?? [])].join(" ").toLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
}

async function toggleBooleanPrompt(message: string, choices: BooleanToggleChoice[]): Promise<Record<string, boolean>> {
  if (choices.length === 0) {
    return {};
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return booleanRecord(choices, choices.map((choice) => choice.enabled));
  }

  const selected = await searchableCheckbox<string>({
    message,
    choices: choices.map((choice) => ({
      name: choice.name.replace(/^\[(?:on |off)\]\s+/, ""),
      value: choice.value,
      checked: choice.enabled,
      short: choice.value,
      ...(choice.description ? { description: choice.description } : {}),
      searchAliases: choice.searchAliases ?? [],
    })),
    pageSize: 12,
    instructions: "Use space to toggle, type to filter, enter to save.",
    filterShortcuts: [
      { key: "1", label: "auto on", term: "auto:on" },
      { key: "2", label: "auto off", term: "auto:off" },
      { key: "3", label: "default on", term: "default:on" },
      { key: "4", label: "start disabled", term: "start-disabled:on" },
    ],
  });
  const selectedIds = new Set(selected);
  return Object.fromEntries(choices.map((choice) => [choice.value, selectedIds.has(choice.value)]));
}

async function selectItemsPrompt(message: string, choices: MultiSelectChoice[]): Promise<string[]> {
  if (choices.length === 0 || !process.stdin.isTTY || !process.stdout.isTTY) {
    return [];
  }

  return searchableCheckbox<string>({
    message,
    choices: choices.map((choice) => ({
      name: choice.name,
      value: choice.value,
      short: choice.value,
      ...(choice.description ? { description: choice.description } : {}),
      searchAliases: choice.searchAliases ?? [],
    })),
    pageSize: 12,
    required: true,
    instructions: "Use space to toggle, type to filter, enter to continue.",
  });
}

function booleanRecord(choices: BooleanToggleChoice[], values: boolean[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index];
    if (choice) {
      record[choice.value] = values[index] ?? choice.enabled;
    }
  }

  return record;
}

async function askInput(config: InputConfig): Promise<string> {
  return input({
    ...config,
    theme: afkPromptTheme,
  });
}

async function askConfirm(message: string, defaultValue: boolean): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
    theme: afkPromptTheme,
  });
}

export function inferId(value: string): string {
  const candidate = filenameStem(value) || value;
  const withoutGit = candidate.replace(/\.git$/i, "");
  const normalized = withoutGit
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}

export function inferLabel(value: string): string {
  const titled = value
    .replace(/\.(md|json|toml|yaml|yml)$/i, "")
    .replace(/^afk-/, "AFK / ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

  return titled.replace(/\b(Api|Mcp|Url|Afk|Cli|Rtk|Pr)\b/g, (match) => match.toUpperCase());
}

function filenameStem(value: string): string {
  try {
    const parsed = new URL(value);
    const last = basename(parsed.pathname);
    return last.replace(/\.[^.]+$/, "");
  } catch {
    const last = basename(value.trim());
    return last.replace(/\.[^.]+$/, "");
  }
}

function inferSource(value: string): "github" | "local" {
  return /^https:\/\/(raw\.githubusercontent\.com|github\.com)\//.test(value) ? "github" : "local";
}

function skillIdFromArgs(args: string[]): string | null {
  const index = args.indexOf("--skill");
  return index >= 0 ? args[index + 1] ?? null : null;
}

function skillArgsFromInput(existing: SkillManifestItem | undefined, value: string): string[] {
  const skill = value.trim();
  if (existing && skill === (skillIdFromArgs(existing.args) ?? "")) {
    return [...existing.args];
  }

  return skill ? ["--skill", skill] : [];
}

function splitArgs(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function isRulesDraft(value: EditableManifest): value is RulesManifest {
  const record = toRecord(value);
  return Boolean(record && typeof record.version === "number" && (record.source === "github" || record.source === "local") && typeof record.url === "string");
}

function isEditableItem(value: unknown): value is EditableManifestItem {
  return isRecord(value) && typeof value.id === "string" && typeof value.label === "string" && typeof value.default === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
