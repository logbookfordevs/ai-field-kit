import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
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
import { afkPromptTheme, afkSelectTheme, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import { searchableCheckbox } from "./searchable-checkbox.js";
import type { Area, CliOptions, Runtime } from "./types.js";

type ManifestArea = Area | "profiles";
type ManifestAreaChoice = ManifestArea | "finish";
export type ManifestAction = "add" | "edit" | "remove" | "toggle-default" | "toggle-auto" | "toggle-always-on" | "edit-rules" | "back";
type EditableDraft = EditableManifest | SkillProfileCatalog;
type Drafts = Record<ManifestArea, EditableDraft>;
type SerializedDrafts = Partial<Record<`${ManifestArea}.json`, string>>;
type SelectChoice<Value extends string> = {
  name: string;
  value: Value;
  description?: string;
};
type InputConfig = {
  message: string;
  default?: string;
  required?: boolean;
};
type BooleanToggleChoice = {
  name: string;
  value: string;
  enabled: boolean;
  description?: string;
  searchAliases?: string[];
};

export type ManifestConfigurePrompts = {
  selectArea: (choices: Array<SelectChoice<ManifestAreaChoice>>) => Promise<ManifestAreaChoice>;
  selectAction: (area: ManifestArea, choices: Array<SelectChoice<ManifestAction>>) => Promise<ManifestAction>;
  selectItem: (area: ManifestArea, choices: Array<SelectChoice<string>>, message: string) => Promise<string>;
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

export async function runManifestConfigureWithPrompts(runtime: Runtime, options: CliOptions, prompts: ManifestConfigurePrompts): Promise<number> {
  const outputDir = options.manifestConfigureLocal ? join(options.cwd, "afk", "catalog") : localManifestDir(options.homeDir);
  const original = readEditableManifests(outputDir);
  const drafts = cloneDrafts(original);
  const touched = new Set<ManifestArea>();

  resetPromptSteps();
  runtime.io.stdout("\nAFK config");
  runtime.io.stdout(`Writing to: ${outputDir}`);
  runtime.io.stdout(renderPromptStep("Catalog editor", "Choose a catalog file, make changes, and finish to review the JSON before writing."));

  while (true) {
    const area = await prompts.selectArea(areaChoices(drafts));
    if (area === "finish") {
      break;
    }

    await editManifestArea(runtime, prompts, drafts, touched, area, options);
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

  runtime.io.stdout("\nCatalog preview");
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
  return 0;
}

async function editManifestArea(
  runtime: Runtime,
  prompts: ManifestConfigurePrompts,
  drafts: Drafts,
  touched: Set<ManifestArea>,
  area: ManifestArea,
  options: CliOptions,
): Promise<void> {
  runtime.io.stdout(renderPromptStep(areaTitle(area), areaDescriptions[area]));

  while (true) {
    runtime.io.stdout(renderAreaSummary(area, drafts[area]));
    const action = await prompts.selectAction(area, actionChoices(area, drafts[area]));
    if (action === "back") {
      return;
    }

    if (area === "rules") {
      drafts.rules = await configureRules(prompts, drafts.rules);
      touched.add("rules");
      continue;
    }

    if (area === "profiles") {
      drafts.profiles = await applyProfileAction(prompts, drafts.profiles, drafts.skills, action);
      touched.add("profiles");
      continue;
    }

    if (!isItemManifestArea(area)) {
      return;
    }

    try {
      drafts[area] = await applyItemAction(prompts, area, drafts[area] as EditableManifest, action, options);
      touched.add(area);
    } catch (error) {
      runtime.io.stderr(`\n${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function applyItemAction(
  prompts: ManifestConfigurePrompts,
  area: Exclude<Area, "rules">,
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
    const selectedId = await prompts.selectItem(area, itemChoices(manifest), `${actionLabel(action)} which ${singularArea(area)}?`);
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
    const selectedId = await prompts.selectItem(area, itemChoices(manifest), `${actionLabel(action)} which ${singularArea(area)}?`);
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

async function applyProfileAction(
  prompts: ManifestConfigurePrompts,
  manifest: EditableDraft,
  skillsManifest: EditableDraft,
  action: ManifestAction,
): Promise<SkillProfileCatalog> {
  const profileCatalog = normalizeProfileDraft(manifest);
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

async function promptItem(prompts: ManifestConfigurePrompts, area: Exclude<Area, "rules">, existing?: EditableManifestItem): Promise<EditableManifestItem> {
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
  const autoInvocationValue = existing?.autoInvocation ?? true;
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

function readManifestOrEmpty(outputDir: string, area: Area): EditableManifest {
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
      { name: "Back to catalog", value: "back" },
    ];
  }

  if (area === "profiles") {
    return [
      { name: "Toggle alwaysOn", value: "toggle-always-on", description: "Choose skills that stay active across enabled profiles." },
      { name: "Back to catalog", value: "back" },
    ];
  }

  const hasItems = entryCount(manifest) > 0;
  return [
    { name: `Add ${singularArea(area)}`, value: "add" },
    ...(hasItems ? [{ name: `Edit ${singularArea(area)}`, value: "edit" as const }] : []),
    ...(hasItems ? [{ name: `Remove ${singularArea(area)}`, value: "remove" as const }] : []),
    ...(hasItems ? [{ name: "Toggle default", value: "toggle-default" as const }] : []),
    ...(area === "skills" && hasItems ? [{ name: "Toggle autoInvocation", value: "toggle-auto" as const }] : []),
    { name: "Back to catalog", value: "back" },
  ];
}

function itemChoices(manifest: EditableManifest): Array<SelectChoice<string>> {
  return itemsFromManifest(manifest).map((item) => ({
    name: itemLabel(item),
    value: item.id,
    description: itemDescription(item),
  }));
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

function renderAreaSummary(area: ManifestArea, manifest: EditableDraft): string {
  if (area === "rules") {
    const rules = isRulesDraft(manifest) ? manifest : { version: 1, source: "github", url: "" };
    return `\nCurrent rules source: ${rules.url || "(empty)"} [${rules.source}]`;
  }

  if (area === "profiles") {
    const profiles = normalizeProfileDraft(manifest);
    return [
      "",
      "Profiles entries",
      `- alwaysOn: ${profiles.alwaysOn.length > 0 ? profiles.alwaysOn.join(", ") : "(none)"}`,
      `- profiles: ${profiles.items.length}`,
    ].join("\n");
  }

  const items = itemsFromManifest(manifest);
  if (items.length === 0) {
    return `\nNo ${area} entries yet.`;
  }

  return [
    "",
    `${areaTitle(area)} entries`,
    ...items.map((item) => `- ${itemLabel(item)}${item.default ? " [default]" : ""}`),
  ].join("\n");
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
    case "remove":
      return "Remove";
    case "toggle-default":
      return "Toggle default for";
    case "toggle-auto":
      return "Toggle autoInvocation for";
    case "toggle-always-on":
      return "Toggle alwaysOn for";
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

function singularArea(area: Exclude<Area, "rules"> | "profiles"): string {
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
  return { version: 1, alwaysOn: [], items: [] };
}

function normalizeProfileDraft(value: unknown): SkillProfileCatalog {
  if (!isProfileCatalogDraft(value)) {
    return emptyProfileCatalog();
  }

  return {
    version: Math.max(value.version, 1),
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
    selectItem: async (_area, choices, message) => select<string>({
      message,
      choices,
      pageSize: 12,
      theme: afkSelectTheme,
    }),
    toggleBooleans: async (_area, choices, message) => toggleBooleanPrompt(message, choices),
    input: askInput,
    confirm: askConfirm,
  };
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
