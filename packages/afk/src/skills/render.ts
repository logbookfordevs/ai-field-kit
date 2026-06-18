import { sectionTitle, muted } from "../brand.js";
import { bold, paint, reset, terminalPalette } from "../terminal-theme.js";
import { skillCatalogFileName, type SkillCategorizationState, type SkillRecord } from "./catalog.js";

export function renderSkillList(records: SkillRecord[], categorization: SkillCategorizationState): string {
  if (records.length === 0) {
    return [
      sectionTitle("Skill Library"),
      muted("No skills found in the selected roots."),
    ].join("\n");
  }

  const groups = groupRecords(records);
  return [
    sectionTitle("Skill Library"),
    muted(renderLibrarySummary(records, categorization)),
    "",
    ...groups.flatMap(([label, group]) => renderSkillGroup(label, group)),
  ].join("\n");
}

export function renderSkillDetails(record: SkillRecord): string {
  return [
    sectionTitle("Skill Detail"),
    `${bold}${record.name}${reset} ${muted(`[${record.folder}]`)}`,
    muted(record.description),
    "",
    renderField("Root", record.rootLabel),
    renderField("Storage", record.storage),
    renderField("Mode", record.readOnly ? "read-only" : "managed"),
    renderField("Auto", renderAutoInvocation(record)),
    record.autoInvocationDetails.length > 0 ? renderField("Auto source", record.autoInvocationDetails.join(", ")) : undefined,
    record.agent ? renderField("Agent", record.agent) : undefined,
    record.category ? renderField("Category", record.category) : undefined,
    record.tags.length > 0 ? renderField("Tags", record.tags.join(", ")) : undefined,
    record.platforms.length > 0 ? renderField("Platforms", record.platforms.join(", ")) : undefined,
    renderField("Skill file", record.skillFilePath),
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export function renderSkillMove(input: {
  folder: string;
  enabled: boolean;
  dryRun: boolean;
  movement: string;
}): string {
  const verb = input.enabled ? "enable" : "disable";
  const title = input.dryRun ? "Skill Move Preview" : "Skill Move Complete";
  return [
    sectionTitle(title),
    input.dryRun
      ? `${muted("Would")} ${accent(verb)} ${strong(input.folder)}`
      : `${accent(input.enabled ? "Enabled" : "Disabled")} ${strong(input.folder)}`,
    muted(input.movement),
  ].join("\n");
}

export function renderSkillOpen(input: {
  folder: string;
  app: string;
  target: string;
  commandLine: string;
}): string {
  return [
    sectionTitle("Skill Open"),
    `${muted("Opening")} ${strong(input.folder)} ${muted("with")} ${accent(input.app)}`,
    renderField("Target", input.target),
    "",
    `${muted("$")} ${input.commandLine}`,
  ].join("\n");
}

export function renderSkillTrash(input: {
  folder: string;
  movement: string;
  dryRun: boolean;
}): string {
  return renderSkillTrashBatch({
    items: [{ folder: input.folder, movement: input.movement }],
    dryRun: input.dryRun,
  });
}

export function renderSkillTrashBatch(input: {
  items: Array<{ folder: string; movement: string }>;
  dryRun: boolean;
}): string {
  const count = input.items.length;
  return [
    sectionTitle(input.dryRun ? "Trash Preview" : "Trash Complete"),
    input.dryRun
      ? `${muted("Would move")} ${accent(String(count))} ${muted(count === 1 ? "skill to Trash" : "skills to Trash")}`
      : `${muted("Moved")} ${accent(String(count))} ${muted(count === 1 ? "skill to Trash" : "skills to Trash")}`,
    ...input.items.map((item) => `${paint(terminalPalette.sienna, "•")} ${strong(item.folder)} ${muted(item.movement)}`),
  ].join("\n");
}

export function renderCategorizationRoute(input: {
  mode: string;
  taxonomyPath: string;
  commandLine: string;
  dryRun: boolean;
}): string {
  return [
    sectionTitle(input.dryRun ? "Categorization Preview" : "Categorization Route"),
    renderField("Mode", input.mode),
    renderField("Taxonomy", input.taxonomyPath),
    renderField("Runner", "codex exec"),
    "",
    `${muted("$")} ${input.commandLine}`,
  ].join("\n");
}

export function renderSkillUpgradeRoute(input: {
  label: string;
  commandLine: string;
}): string {
  return [
    sectionTitle("Skill Upgrade"),
    `${muted("Delegating")} ${accent(input.label)} ${muted("to the official skills CLI")}`,
    "",
    `${muted("$")} ${input.commandLine}`,
  ].join("\n");
}

export function renderPromptPreview(prompt: string): string {
  return [
    "",
    sectionTitle("Prompt Preview"),
    prompt,
  ].join("\n");
}

export function renderSkillChoice(record: SkillRecord): string {
  const details = [
    muted(record.rootLabel),
    record.storage === "disabled" ? warn("disabled") : success("active"),
    record.readOnly ? muted("read-only") : accent("managed"),
    renderAutoInvocationBadge(record),
    record.category ? accent(record.category) : undefined,
  ].filter((value): value is string => Boolean(value));

  return [
    strong(accent(record.name)),
    muted(`[${record.folder}]`),
    details.join(` ${muted("·")} `),
  ].filter(Boolean).join(" ");
}

function renderSkillGroup(label: string, records: SkillRecord[]): string[] {
  return [
    `${paint(terminalPalette.sienna, "┌")} ${accent(label)}`,
    ...records.map((record, index) => renderSkillRow(record, index === records.length - 1)),
    "",
  ];
}

function renderSkillRow(record: SkillRecord, isLast: boolean): string {
  const branch = paint(terminalPalette.sienna, isLast ? "└" : "├");
  const status = record.storage === "disabled" ? warn("disabled") : success("active");
  const management = record.readOnly ? muted("read-only") : accent("managed");
  const autoInvocation = muted(` · ${renderAutoInvocationBadge(record)}`);
  const category = record.category ? muted(` · ${record.category}`) : "";
  return `${branch} ${strong(record.name)} ${muted(`[${record.folder}]`)} ${status} ${management}${autoInvocation}${category}\n  ${muted(truncate(record.description, 120))}`;
}

function renderLibrarySummary(records: SkillRecord[], categorization: SkillCategorizationState): string {
  const active = records.filter((record) => record.storage === "active").length;
  const disabled = records.filter((record) => record.storage === "disabled").length;
  const project = records.filter((record) => record.rootKind === "project-agent").length;
  const agent = records.filter((record) => record.rootKind === "agent-library").length;
  const taxonomy = categorization.state === "loaded"
    ? skillCatalogFileName
    : categorization.state === "invalid"
      ? `${skillCatalogFileName} needs repair`
      : `${skillCatalogFileName} not created yet`;

  return `${active} active · ${disabled} disabled · ${project} project · ${agent} agent · ${taxonomy}`;
}

function renderField(label: string, value: string): string {
  return `${muted(label.padEnd(10))} ${value}`;
}

function renderAutoInvocation(record: SkillRecord): string {
  switch (record.autoInvocation) {
    case "enabled":
      return "enabled";
    case "disabled":
      return "disabled";
    case "mixed":
      return "mixed";
    case "default":
      return "default";
  }
}

function renderAutoInvocationBadge(record: SkillRecord): string {
  switch (record.autoInvocation) {
    case "enabled":
      return success("auto");
    case "disabled":
      return warn("manual");
    case "mixed":
      return warn("mixed");
    case "default":
      return muted("default");
  }
}

function groupRecords(records: SkillRecord[]): Array<[string, SkillRecord[]]> {
  const groups = new Map<string, SkillRecord[]>();
  for (const record of records) {
    groups.set(record.rootLabel, [...(groups.get(record.rootLabel) ?? []), record]);
  }

  return [...groups.entries()];
}

function strong(value: string): string {
  return `${bold}${value}${reset}`;
}

function accent(value: string): string {
  return paint(terminalPalette.brass, value);
}

function success(value: string): string {
  return paint(terminalPalette.harbor, value);
}

function warn(value: string): string {
  return paint(terminalPalette.ember, value);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
