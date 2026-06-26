import { sectionTitle, muted } from "../brand.js";
import { formatOperation } from "../fs-utils.js";
import { bold, paint, reset, terminalPalette } from "../terminal-theme.js";
import { skillCatalogFileName, type SkillCategorizationState, type SkillRecord } from "./catalog.js";
import type { SkillProfileApplyResult, SkillProfileCatalog, SkillProfileItem, SkillProfileState } from "./profiles.js";
import type { PathOperation } from "../types.js";

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
    renderField("Auto", renderAutoInvocation(record)),
    record.autoInvocationDetails.length > 0 ? renderField("Auto source", record.autoInvocationDetails.join(", ")) : undefined,
    record.agent ? renderField("Agent", record.agent) : undefined,
    record.category ? renderField("Category", record.category) : undefined,
    record.tags.length > 0 ? renderField("Tags", record.tags.join(", ")) : undefined,
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

export function renderSkillInvocationPolicy(input: {
  folder: string;
  allowInvocation: boolean;
  dryRun: boolean;
  operations: PathOperation[];
}): string {
  const verb = input.allowInvocation ? "enable" : "disable";
  const title = input.dryRun ? "Auto Invocation Preview" : "Auto Invocation Complete";
  return [
    sectionTitle(title),
    input.dryRun
      ? `${muted("Would")} ${accent(verb)} ${muted("auto invocation for")} ${strong(input.folder)}`
      : `${accent(input.allowInvocation ? "Enabled" : "Disabled")} ${muted("auto invocation for")} ${strong(input.folder)}`,
    input.operations.length === 0 ? muted("No file changes needed.") : undefined,
    ...input.operations.map((operation) => `${paint(terminalPalette.sienna, "•")} ${muted(formatOperation(operation))}`),
  ].filter((line): line is string => Boolean(line)).join("\n");
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

export function renderSkillDelete(input: {
  folder: string;
  movement: string;
  dryRun: boolean;
}): string {
  return renderSkillDeleteBatch({
    items: [{ folder: input.folder, movement: input.movement }],
    dryRun: input.dryRun,
  });
}

export function renderSkillDeleteBatch(input: {
  items: Array<{ folder: string; movement: string }>;
  dryRun: boolean;
}): string {
  const count = input.items.length;
  return [
    sectionTitle(input.dryRun ? "Delete Preview" : "Delete Complete"),
    input.dryRun
      ? `${muted("Would permanently delete")} ${accent(String(count))} ${muted(count === 1 ? "skill" : "skills")}`
      : `${muted("Deleted")} ${accent(String(count))} ${muted(count === 1 ? "skill" : "skills")}`,
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

export function renderSkillProfileList(input: {
  catalog: SkillProfileCatalog;
  state: SkillProfileState;
  catalogPath: string;
}): string {
  if (input.catalog.items.length === 0) {
    return [
      sectionTitle("Skill Profiles"),
      muted("No skill profiles found."),
      renderField("Catalog", input.catalogPath),
    ].join("\n");
  }

  const enabled = new Set(input.state.enabledProfileIds);
  return [
    sectionTitle("Skill Profiles"),
    muted(`${input.catalog.items.length} profiles · ${enabled.size} enabled · ${input.catalog.alwaysOn.length} always-on · ${input.catalog.mode} mode`),
    renderField("Catalog", input.catalogPath),
    "",
    ...input.catalog.items.map((profile) => renderSkillProfileRow(profile, enabled.has(profile.id))),
  ].join("\n");
}

export function renderSkillProfileDetail(input: {
  profile: SkillProfileItem;
  catalog: SkillProfileCatalog;
  state: SkillProfileState;
  catalogPath: string;
}): string {
  const enabled = input.state.enabledProfileIds.includes(input.profile.id);
  return [
    sectionTitle("Skill Profile"),
    `${strong(accent(input.profile.name))} ${muted(`[${input.profile.id}]`)}`,
    renderField("State", enabled ? success("enabled") : muted("disabled")),
    renderField("Mode", input.catalog.mode),
    renderField("Skills", input.profile.skills.length === 0 ? muted("none") : input.profile.skills.join(", ")),
    renderField("Always-on", input.catalog.alwaysOn.length === 0 ? muted("none") : input.catalog.alwaysOn.join(", ")),
    renderField("Catalog", input.catalogPath),
  ].join("\n");
}

export function renderSkillProfileWrite(input: {
  profile: SkillProfileItem;
  mode: SkillProfileCatalog["mode"];
  catalogPath: string;
  dryRun: boolean;
  created: boolean;
}): string {
  const verb = input.created ? "Create" : "Update";
  return [
    sectionTitle(input.dryRun ? `Profile ${verb} Preview` : `Profile ${verb} Complete`),
    `${input.dryRun ? muted("Would save") : accent("Saved")} ${strong(input.profile.name)} ${muted(`[${input.profile.id}]`)}`,
    renderField("Mode", input.mode),
    renderField("Skills", input.profile.skills.length === 0 ? muted("none") : input.profile.skills.join(", ")),
    renderField("Catalog", input.catalogPath),
  ].join("\n");
}

export function renderSkillProfileDelete(input: {
  profile: SkillProfileItem;
  catalogPath: string;
  dryRun: boolean;
}): string {
  return [
    sectionTitle(input.dryRun ? "Profile Delete Preview" : "Profile Delete Complete"),
    input.dryRun
      ? `${muted("Would remove profile")} ${strong(input.profile.id)}`
      : `${accent("Removed profile")} ${strong(input.profile.id)}`,
    renderField("Catalog", input.catalogPath),
  ].join("\n");
}

export function renderSkillProfileApply(input: SkillProfileApplyResult): string {
  const enabled = input.movements.filter((movement) => movement.action === "enable").map((movement) => movement.folder).sort();
  const disabled = input.movements.filter((movement) => movement.action === "disable").map((movement) => movement.folder).sort();

  return [
    sectionTitle(input.dryRun ? "Profile Move Preview" : "Profile Move Complete"),
    renderField("Profiles", input.state.enabledProfileIds.length === 0 ? muted("none") : input.state.enabledProfileIds.join(", ")),
    renderField("Mode", input.catalog.mode),
    renderSkillProfileApplyTable(enabled.length, disabled.length, input.keptSkills.length),
    renderSkillProfileApplyList("Enabled", enabled),
    renderSkillProfileApplyList("Disabled", disabled),
    renderSkillProfileApplyList("Kept", input.keptSkills),
    renderField("State", input.paths.statePath),
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export function renderSkillProfileStatus(input: SkillProfileApplyResult): string {
  return [
    sectionTitle("Skill Profile Status"),
    renderField("Enabled", input.state.enabledProfileIds.length === 0 ? muted("none") : input.state.enabledProfileIds.join(", ")),
    renderField("Mode", input.catalog.mode),
    renderField("Always-on", input.catalog.alwaysOn.length === 0 ? muted("none") : input.catalog.alwaysOn.join(", ")),
    renderField("Kept", input.keptSkills.length === 0 ? muted("none") : input.keptSkills.join(", ")),
    renderField("Moved", input.state.profileMovedSkills.length === 0 ? muted("none") : input.state.profileMovedSkills.join(", ")),
    renderField("Pre-disabled", input.state.preExistingDisabledSkills.length === 0 ? muted("none") : input.state.preExistingDisabledSkills.join(", ")),
    renderField("Catalog", input.paths.catalogPath),
    renderField("State", input.paths.statePath),
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
  return [
    strong(accent(record.name)),
    muted(`[${record.folder}]`),
    muted(record.rootLabel),
  ].join(" ");
}

export function renderSkillChoiceDescription(record: SkillRecord): string {
  return [
    truncate(record.description, 160),
    renderSkillMetadataLine(record, { includeScope: false }),
  ].filter(Boolean).join("\n");
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
  return `${branch} ${strong(record.name)} ${muted(`[${record.folder}]`)} ${muted(record.rootLabel)}`;
}

function renderSkillProfileRow(profile: SkillProfileItem, enabled: boolean): string {
  const status = enabled ? success("enabled") : muted("disabled");
  return `${paint(terminalPalette.sienna, "•")} ${strong(profile.name)} ${muted(`[${profile.id}]`)} ${status}\n  ${muted(profile.skills.length === 0 ? "No skills assigned." : profile.skills.join(", "))}`;
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

function renderSkillMetadataLine(record: SkillRecord, options: { includeScope?: boolean } = {}): string {
  const fields = [
    options.includeScope === false ? undefined : renderMetadataField("Scope", muted(record.rootLabel)),
    renderMetadataField("Status", record.storage === "disabled" ? warn("disabled") : success("active")),
    renderMetadataField("Invocation", renderAutoInvocationBadge(record)),
    record.agent ? renderMetadataField("Agent", accent(record.agent)) : undefined,
    record.category ? renderMetadataField("Category", accent(record.category)) : undefined,
    record.tags.length > 0 ? renderMetadataField("Tags", accent(record.tags.join(", "))) : undefined,
  ].filter((value): value is string => Boolean(value));

  return fields.join(` ${muted("·")} `);
}

function renderMetadataField(label: string, value: string): string {
  return `${muted(`${label}:`)} ${value}`;
}

function renderSkillProfileApplyTable(enabled: number, disabled: number, kept: number): string {
  const headers = ["enabled", "disabled", "kept"];
  const values = [enabled, disabled, kept].map(String);
  const widths = headers.map((header, index) => Math.max(header.length, values[index]?.length ?? 0));
  return [
    widths.map((width, index) => muted(headers[index]?.padEnd(width) ?? "")).join("  "),
    values.map((value, index) => accent(value.padEnd(widths[index] ?? value.length))).join("  "),
  ].join("\n");
}

function renderSkillProfileApplyList(label: string, skills: string[]): string | undefined {
  if (skills.length === 0) {
    return undefined;
  }

  return `${muted(`${label.padEnd(10)} ${skills.join(", ")}`)}`;
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
