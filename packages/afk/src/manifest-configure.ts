import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { emitKeypressEvents } from "node:readline";
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
import { afkPromptTheme, afkSelectTheme, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import type { Area, CliOptions, Runtime } from "./types.js";

type ManifestArea = Area;
type ManifestAreaChoice = ManifestArea | "finish";
export type ManifestAction = "add" | "edit" | "remove" | "toggle-default" | "toggle-auto" | "edit-rules" | "back";
type Drafts = Record<ManifestArea, EditableManifest>;
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
};

export type ManifestConfigurePrompts = {
  selectArea: (choices: Array<SelectChoice<ManifestAreaChoice>>) => Promise<ManifestAreaChoice>;
  selectAction: (area: ManifestArea, choices: Array<SelectChoice<ManifestAction>>) => Promise<ManifestAction>;
  selectItem: (area: ManifestArea, choices: Array<SelectChoice<string>>, message: string) => Promise<string>;
  toggleBooleans: (area: ManifestArea, choices: BooleanToggleChoice[], message: string) => Promise<Record<string, boolean>>;
  input: (config: InputConfig) => Promise<string>;
  confirm: (message: string, defaultValue: boolean) => Promise<boolean>;
};

const manifestAreas: ManifestArea[] = ["rules", "skills", "mcps", "plugins", "hooks"];

const areaDescriptions: Record<ManifestArea, string> = {
  rules: "Point rules sync at one AGENTS.md source.",
  skills: "Add, edit, remove, and toggle skills.",
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
  runtime.io.stdout("\nAFK configure");
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

    if (!isItemManifestArea(area)) {
      return;
    }

    try {
      drafts[area] = await applyItemAction(prompts, area, drafts[area], action, options);
      touched.add(area);
    } catch (error) {
      runtime.io.stderr(`\n${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function applyItemAction(
  prompts: ManifestConfigurePrompts,
  area: Exclude<ManifestArea, "rules">,
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

async function promptItem(prompts: ManifestConfigurePrompts, area: Exclude<ManifestArea, "rules">, existing?: EditableManifestItem): Promise<EditableManifestItem> {
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
  const isDefault = await prompts.confirm(booleanPrompt("Selected by default?", defaultValue, existing ? "current" : "default"), defaultValue);
  const autoInvocation = await prompts.confirm(booleanPrompt("Allow automatic model invocation?", autoInvocationValue, existing ? "current" : "default"), autoInvocationValue);

  return {
    id,
    label,
    source,
    args: skillArgsFromInput(existing, skill),
    default: isDefault,
    autoInvocation,
    role: existing?.role ?? "primitive",
    composes: existing?.composes ?? [],
    profiles: existing?.profiles ?? [],
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
  const nextPostInstallLine = await prompts.input({ message: "Post-install command (optional, or rtk-init)", default: existingPostInstallLine });
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
    mcps: readManifestOrEmpty(outputDir, "mcps"),
    plugins: readManifestOrEmpty(outputDir, "plugins"),
    hooks: readManifestOrEmpty(outputDir, "hooks"),
  };
}

function readManifestOrEmpty(outputDir: string, area: ManifestArea): EditableManifest {
  const path = join(outputDir, manifestFilename(area));
  if (!existsSync(path)) {
    return emptyEditableManifest(area);
  }

  return JSON.parse(readFileSync(path, "utf8")) as EditableManifest;
}

function cloneDrafts(drafts: Drafts): Drafts {
  return {
    rules: cloneDraft(drafts.rules),
    skills: cloneDraft(drafts.skills),
    mcps: cloneDraft(drafts.mcps),
    plugins: cloneDraft(drafts.plugins),
    hooks: cloneDraft(drafts.hooks),
  };
}

function cloneDraft(manifest: EditableManifest): EditableManifest {
  return JSON.parse(JSON.stringify(manifest)) as EditableManifest;
}

function changedDrafts(original: Drafts, drafts: Drafts, touched: Set<ManifestArea>): SerializedDrafts {
  const serialized: SerializedDrafts = {};
  for (const area of touched) {
    const originalContent = rawSerialize(original[area]);
    const nextContent = serializeEditableManifest(area, drafts[area]);
    if (originalContent !== nextContent) {
      serialized[manifestFilename(area)] = nextContent;
    }
  }

  return serialized;
}

function rawSerialize(manifest: EditableManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function validationErrorsFor(drafts: Drafts, touched: Set<ManifestArea>): string[] {
  return [...touched].flatMap((area) => validateEditableManifest(area, drafts[area]).map((error) => `${manifestFilename(area)}: ${error}`));
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

function actionChoices(area: ManifestArea, manifest: EditableManifest): Array<SelectChoice<ManifestAction>> {
  if (area === "rules") {
    return [
      { name: "Edit rules source", value: "edit-rules", description: "Change the rules URL/path and inferred source type." },
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

function renderAreaSummary(area: ManifestArea, manifest: EditableManifest): string {
  if (area === "rules") {
    const rules = isRulesDraft(manifest) ? manifest : { version: 1, source: "github", url: "" };
    return `\nCurrent rules source: ${rules.url || "(empty)"} [${rules.source}]`;
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

function entryCount(manifest: EditableManifest): number {
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
    case "mcps":
      return "MCPs";
    case "plugins":
      return "Plugins";
    case "hooks":
      return "Hooks";
  }
}

function singularArea(area: Exclude<ManifestArea, "rules">): string {
  switch (area) {
    case "skills":
      return "skill";
    case "mcps":
      return "MCP";
    case "plugins":
      return "plugin";
    case "hooks":
      return "hook";
  }
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

  if (postInstall === "rtk-init") {
    return "rtk-init";
  }

  if ((postInstall.command === "sh" || postInstall.command === "bash") && postInstall.args[0] === "-c" && postInstall.args[1]) {
    return postInstall.args[1];
  }

  return [postInstall.command, ...postInstall.args].join(" ");
}

function postInstallFromLine(line: string, existing?: PluginManifestItem["postInstall"]): "rtk-init" | PluginPostInstallCommand {
  if (line === "rtk-init") {
    return "rtk-init";
  }

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

  const stdin = process.stdin;
  const stdout = process.stdout;
  const values = choices.map((choice) => choice.enabled);

  if (!stdin.isTTY || !stdout.isTTY) {
    return booleanRecord(choices, values);
  }

  return new Promise<Record<string, boolean>>((resolve, reject) => {
    let index = 0;
    let renderedLines = 0;
    const wasRaw = stdin.isRaw;

    const cleanup = (): void => {
      stdin.off("keypress", onKeypress);
      if (typeof stdin.setRawMode === "function") {
        stdin.setRawMode(wasRaw);
      }
      stdout.write("\x1b[?25h\n");
    };

    const render = (): void => {
      if (renderedLines > 0) {
        stdout.write(`\x1b[${renderedLines}A`);
      }

      const lines = [
        `◇ ${message}`,
        "  ↑/↓ move · ← off · → on · space toggle · enter save",
        ...choices.map((choice, choiceIndex) => {
          const cursor = choiceIndex === index ? "◆" : " ";
          const description = choice.description ? ` · ${choice.description}` : "";
          return `${cursor} ${booleanSwitch(values[choiceIndex] ?? false)} ${choice.name.replace(/^\[(?:on |off)\]\s+/, "")}${description}`;
        }),
      ];

      stdout.write(lines.map((line) => `\x1b[2K${line}`).join("\n"));
      renderedLines = lines.length;
    };

    const onKeypress = (_input: string, key: KeypressInfo): void => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        const error = new Error("User force closed the prompt with SIGINT");
        error.name = "ExitPromptError";
        reject(error);
        return;
      }

      if (key.name === "up") {
        index = index === 0 ? choices.length - 1 : index - 1;
        render();
        return;
      }

      if (key.name === "down") {
        index = index === choices.length - 1 ? 0 : index + 1;
        render();
        return;
      }

      if (key.name === "left") {
        values[index] = false;
        render();
        return;
      }

      if (key.name === "right") {
        values[index] = true;
        render();
        return;
      }

      if (key.name === "space") {
        values[index] = !(values[index] ?? false);
        render();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(booleanRecord(choices, values));
      }
    };

    emitKeypressEvents(stdin);
    if (typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true);
    }
    stdin.on("keypress", onKeypress);
    stdout.write("\x1b[?25l");
    render();
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

type KeypressInfo = {
  name?: string;
  ctrl?: boolean;
};

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
