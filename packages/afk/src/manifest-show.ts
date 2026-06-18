import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sectionTitle, muted } from "./brand.js";
import { loadDefaultManifestContent, localManifestDir, readRememberedDefaultsSource, type ManifestName } from "./manifest.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { CliOptions, ManifestCategory, Runtime } from "./types.js";

type ManifestShowCategory = {
  id: ManifestCategory;
  label: string;
  filename: string;
};

const categories: ManifestShowCategory[] = [
  { id: "rules", label: "Rules", filename: "rules.json" },
  { id: "skills", label: "Skills", filename: "skills.json" },
  { id: "mcps", label: "MCPs", filename: "mcps.json" },
  { id: "plugins", label: "Plugins", filename: "plugins.json" },
  { id: "hooks", label: "Hooks", filename: "hooks.json" },
  { id: "presets", label: "Presets", filename: "presets.json" },
];

export async function runManifestShow(runtime: Runtime, options: CliOptions): Promise<number> {
  const selected = selectedCategories(options);
  const localDir = manifestShowDir(options);
  const sourceLabel = manifestShowSourceLabel(options);
  const showSource = options.defaultsSourceExplicit;

  if (options.manifestShowReact && selected.some((category) => category.id !== "skills")) {
    runtime.io.stderr("The React skill view only supports skills. Use afk show skills --react.");
    return 1;
  }

  runtime.io.stdout("");
  runtime.io.stdout(sectionTitle("AFK manifests"));
  runtime.io.stdout(showSource
    ? `${muted("Source")} ${sourceBadge("Source")}  ${muted("Defaults")} ${sourceLabel}`
    : `${muted("Source")} ${sourceBadge("Cache")}  ${muted("Directory")} ${localDir}`);

  for (const category of selected) {
    const loaded = showSource ? await loadSourceManifest(category.filename, options) : loadLocalManifest(localDir, category.filename);
    runtime.io.stdout(renderCardHeader(category.label, loaded));

    if (!loaded.content) {
      runtime.io.stdout(`${muted("  status")} ${paint(terminalPalette.ember, "missing")}`);
      continue;
    }

    runtime.io.stdout(renderManifestSummary(category.id, loaded.content, options));
  }

  return 0;
}

function selectedCategories(options: CliOptions): ManifestShowCategory[] {
  const flags = options.selectedManifestCategories;
  if (options.manifestShowReact && flags.length === 0) {
    return categories.filter((category) => category.id === "skills");
  }

  if (flags.length === 0) {
    return categories.filter((category) => category.id !== "presets");
  }

  return categories.filter((category) => flags.includes(category.id));
}

function manifestShowDir(options: CliOptions): string {
  return options.setupScope === "project" || options.manifestLocal ? join(options.cwd, "afk", "manifests") : localManifestDir(options.homeDir);
}

function loadLocalManifest(manifestDir: string, filename: string): LoadedManifest {
  const localPath = join(manifestDir, filename);
  if (existsSync(localPath)) {
    return {
      source: "local",
      location: localPath,
      content: JSON.parse(readFileSync(localPath, "utf8")) as unknown,
    };
  }

  return {
    source: "missing",
    location: localPath,
    content: null,
  };
}

async function loadSourceManifest(filename: ManifestShowCategory["filename"], options: CliOptions): Promise<LoadedManifest> {
  const content = await loadDefaultManifestContent(filename as ManifestName, options);
  if (!content) {
    return {
      source: "missing",
      location: manifestShowSourceLabel(options),
      content: null,
    };
  }

  return {
    source: "source",
    location: manifestShowSourceLabel(options),
    content: JSON.parse(content) as unknown,
  };
}

function manifestShowSourceLabel(options: CliOptions): string {
  return options.defaultsSource || readRememberedDefaultsSource(options) || "logbookfordevs/ai-field-kit";
}

type LoadedManifest = {
  source: "source" | "local" | "missing";
  location: string;
  content: unknown | null;
};

function renderCardHeader(label: string, loaded: LoadedManifest): string {
  const status = loaded.source === "missing" ? paint(terminalPalette.ember, "missing") : paint(terminalPalette.harbor, "ready");
  return [
    "",
    `${paint(terminalPalette.brass, "┌")} ${bold}${label}${reset} ${muted(`(${loaded.source})`)} ${status}`,
    `${muted(`  ${loaded.source === "local" ? "file" : "source"}`)} ${loaded.location}`,
  ].join("\n");
}

function renderManifestSummary(category: ManifestCategory, manifest: unknown, options: CliOptions): string {
  if (!isRecord(manifest)) {
    return "- Invalid manifest shape";
  }

  switch (category) {
    case "rules":
      return renderRules(manifest);
    case "skills":
      return options.manifestShowReact ? renderSkillsAsReact(manifest) : renderSkills(manifest);
    case "mcps":
      return renderItems(manifest, "MCP");
    case "plugins":
      return renderPlugins(manifest);
    case "hooks":
      return renderHooks(manifest);
    case "presets":
      return renderPresets(manifest);
  }
}

function renderRules(manifest: Record<string, unknown>): string {
  const lines = [summaryLine("version", valueOrUnknown(manifest.version))];
  if (typeof manifest.source === "string") {
    lines.push(summaryLine("source", manifest.source));
  }
  if (typeof manifest.url === "string") {
    lines.push(summaryLine("url", manifest.url || "(empty)"));
  }
  if (Array.isArray(manifest.files)) {
    lines.push(summaryLine("files", String(manifest.files.length)));
    for (const item of manifest.files) {
      if (!isRecord(item)) {
        continue;
      }
      lines.push(itemLine(`${String(item.id ?? "unnamed")} ${muted(String(item.path ?? item.url ?? "(no path)"))}${defaultSuffix(item.default)}`));
    }
  }

  return lines.join("\n");
}

function renderSkills(manifest: Record<string, unknown>): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    summaryLine("default source", typeof manifest.defaultSource === "string" && manifest.defaultSource ? manifest.defaultSource : "(none)"),
    ...renderItemList(manifest.items, "skill", (item) => {
      const args = Array.isArray(item.args) && item.args.length > 0 ? item.args.filter((value) => typeof value === "string").join(" ") : "";
      const details = [
        `role: ${stringValue(item.role, "primitive")}`,
        `auto-invocation: ${item.autoInvocation === false ? "off" : "on"}`,
        ...stringListDetail("composes", item.composes),
        ...stringListDetail("profiles", item.profiles),
        ...(args ? [`args: ${args}`] : []),
      ];
      return detailItemLine(`${labelFor(item)}${defaultSuffix(item.default)}`, details);
    }),
  ].join("\n");
}

function renderSkillsAsReact(manifest: Record<string, unknown>): string {
  const items = Array.isArray(manifest.items) ? manifest.items.filter(isRecord) : [];
  const byId = new Map(items.map((item) => [stringValue(item.id, "unnamed"), item]));
  const modelDiscovered = items.filter((item) => item.autoInvocation !== false);
  const userInvoked = items.filter((item) => item.autoInvocation === false);
  const composed = items.filter((item) => stringList(item.composes).length > 0);

  if (items.length === 0) {
    return [
      summaryLine("version", valueOrUnknown(manifest.version)),
      summaryLine("components", "0"),
    ].join("\n");
  }

  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    summaryLine("components", `${items.length} (${modelDiscovered.length} auto-discoverable, ${userInvoked.length} explicit)`),
    summaryLine("composition", `${composed.length} composed skill${composed.length === 1 ? "" : "s"}`),
    "",
    muted("  // JSX-ish map of AFK's skill architecture"),
    jsxOpen("  ", "AFKSkillTree"),
    ...renderReactGroup("ModelDiscovery", modelDiscovered, byId, 2),
    ...renderReactGroup("ExplicitInvocation", userInvoked, byId, 2),
    jsxClose("  ", "AFKSkillTree"),
  ].join("\n");
}

function renderReactGroup(name: string, items: Record<string, unknown>[], byId: Map<string, Record<string, unknown>>, indentLevel: number): string[] {
  const indent = "  ".repeat(indentLevel);
  if (items.length === 0) {
    return [jsxSelfClosing(indent, name, [])];
  }

  return [
    jsxOpen(indent, name),
    ...items.flatMap((item) => renderSkillComponent(item, byId, indentLevel + 1)),
    jsxClose(indent, name),
  ];
}

function renderSkillComponent(item: Record<string, unknown>, byId: Map<string, Record<string, unknown>>, indentLevel: number): string[] {
  const indent = "  ".repeat(indentLevel);
  const children = stringList(item.composes);
  const tag = componentTag(item.role);
  const attrs = skillAttributes(item, "id");

  if (children.length === 0) {
    return [jsxSelfClosing(indent, tag, attrs)];
  }

  return [
    jsxOpen(indent, tag, attrs),
    ...children.map((childId) => renderSkillReference(childId, byId, indentLevel + 1)),
    jsxClose(indent, tag),
  ];
}

function renderSkillReference(id: string, byId: Map<string, Record<string, unknown>>, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const item = byId.get(id);
  const tag = item ? componentTag(item.role) : "ExternalSkill";
  const attrs = item ? skillAttributes(item, "ref") : [
    { name: "ref", stringValue: id, tone: "external" },
    { name: "external", tone: "external" },
  ] satisfies JsxAttribute[];
  return jsxSelfClosing(indent, tag, attrs);
}

type JsxAttribute = {
  name: string;
  stringValue?: string;
  expressionValue?: string;
  tone?: "identity" | "boolean" | "false" | "default" | "external";
};

function skillAttributes(item: Record<string, unknown>, idProp: "id" | "ref"): JsxAttribute[] {
  const id = stringValue(item.id, "unnamed");
  const attrs: JsxAttribute[] = [
    { name: idProp, stringValue: id, tone: "identity" },
    item.autoInvocation === false
      ? { name: "autoDiscovery", expressionValue: "false", tone: "false" }
      : { name: "autoDiscovery", tone: "boolean" },
  ];
  if (item.default === true) {
    attrs.push({ name: "defaultInstalled", tone: "default" });
  }

  return attrs;
}

function jsxOpen(indent: string, tag: string, attrs: JsxAttribute[] = []): string {
  return `${indent}${jsxPunctuation("<")}${jsxTag(tag)}${renderJsxAttributes(attrs)}${jsxPunctuation(">")}`;
}

function jsxClose(indent: string, tag: string): string {
  return `${indent}${jsxPunctuation("</")}${jsxTag(tag)}${jsxPunctuation(">")}`;
}

function jsxSelfClosing(indent: string, tag: string, attrs: JsxAttribute[]): string {
  return `${indent}${jsxPunctuation("<")}${jsxTag(tag)}${renderJsxAttributes(attrs)}${jsxPunctuation(" />")}`;
}

function renderJsxAttributes(attrs: JsxAttribute[]): string {
  if (attrs.length === 0) {
    return "";
  }

  return ` ${attrs.map(renderJsxAttribute).join(" ")}`;
}

function renderJsxAttribute(attr: JsxAttribute): string {
  const name = paint(attributeNameColor(attr), attr.name);
  if (attr.stringValue !== undefined) {
    return `${name}${jsxPunctuation("=")}${jsxPunctuation("\"")}${paint(attributeValueColor(attr), escapeAttribute(attr.stringValue))}${jsxPunctuation("\"")}`;
  }
  if (attr.expressionValue !== undefined) {
    return `${name}${jsxPunctuation("={")}${paint(attributeValueColor(attr), attr.expressionValue)}${jsxPunctuation("}")}`;
  }

  return name;
}

function jsxTag(tag: string): string {
  return paint(tagColor(tag), tag);
}

function jsxPunctuation(value: string): string {
  return muted(value);
}

function tagColor(tag: string): typeof terminalPalette[keyof typeof terminalPalette] {
  switch (tag) {
    case "WrapperSkill":
      return terminalPalette.brass;
    case "FlowSkill":
      return terminalPalette.rust;
    case "UtilitySkill":
      return terminalPalette.sienna;
    case "ReferenceSkill":
      return terminalPalette.driftwood;
    case "RouterSkill":
      return terminalPalette.ember;
    case "ExternalSkill":
      return terminalPalette.ember;
    case "ModelDiscovery":
    case "ExplicitInvocation":
      return terminalPalette.lantern;
    case "AFKSkillTree":
      return terminalPalette.harbor;
    case "PrimitiveSkill":
    default:
      return terminalPalette.harbor;
  }
}

function attributeNameColor(attr: JsxAttribute): typeof terminalPalette[keyof typeof terminalPalette] {
  if (attr.tone === "external") {
    return terminalPalette.ember;
  }
  if (attr.tone === "default") {
    return terminalPalette.brass;
  }

  return terminalPalette.driftwood;
}

function attributeValueColor(attr: JsxAttribute): typeof terminalPalette[keyof typeof terminalPalette] {
  switch (attr.tone) {
    case "external":
    case "false":
      return terminalPalette.ember;
    case "default":
      return terminalPalette.brass;
    case "boolean":
      return terminalPalette.harbor;
    case "identity":
    default:
      return terminalPalette.lantern;
  }
}

function componentTag(role: unknown): string {
  switch (role) {
    case "wrapper":
      return "WrapperSkill";
    case "flow":
      return "FlowSkill";
    case "utility":
      return "UtilitySkill";
    case "reference":
      return "ReferenceSkill";
    case "router":
      return "RouterSkill";
    case "primitive":
    default:
      return "PrimitiveSkill";
  }
}

function renderPlugins(manifest: Record<string, unknown>): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    ...renderItemList(manifest.items, "plugin", (item) => {
      const description = typeof item.description === "string" ? item.description : "";
      return sourceItemLine(`${labelFor(item)}${defaultSuffix(item.default)}`, description);
    }),
  ].join("\n");
}

function renderHooks(manifest: Record<string, unknown>): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    ...renderItemList(manifest.items, "hook", (item) => {
      const agents = Array.isArray(item.agents) ? ` [${item.agents.filter((value) => typeof value === "string").join(", ")}]` : "";
      const description = typeof item.description === "string" ? item.description : "";
      return sourceItemLine(`${labelFor(item)}${defaultSuffix(item.default)}${agents}`, description);
    }),
  ].join("\n");
}

function renderPresets(manifest: Record<string, unknown>): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    summaryLine("defaults source", typeof manifest.defaultsSource === "string" && manifest.defaultsSource ? manifest.defaultsSource : "(none)"),
    ...renderItemList(manifest.presets, "preset", (item) => {
      const areas = Array.isArray(item.areas) ? ` [${item.areas.filter((value) => typeof value === "string").join(", ")}]` : "";
      return `${labelFor(item)}${areas}`;
    }),
  ].join("\n");
}

function renderItems(manifest: Record<string, unknown>, singular: string): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    ...(typeof manifest.source === "string" ? [summaryLine("source", manifest.source)] : []),
    ...renderItemList(manifest.items, singular, (item) => {
      const source = item.url ?? item.source ?? "";
      return sourceItemLine(`${labelFor(item)}${defaultSuffix(item.default)}`, typeof source === "string" ? source : "");
    }),
  ].join("\n");
}

function renderItemList(items: unknown, singular: string, format: (item: Record<string, unknown>) => string): string[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [summaryLine(pluralize(singular).toLowerCase(), "0")];
  }

  const records = items.filter(isRecord);
  const selected = records.filter((item) => item.default === true).length;
  return [
    summaryLine(pluralize(singular).toLowerCase(), `${records.length}${selected > 0 ? ` (${selected} default)` : ""}`),
    ...records.map((item) => itemLine(format(item))),
  ];
}

function labelFor(item: Record<string, unknown>): string {
  const id = typeof item.id === "string" ? item.id : "unnamed";
  const label = typeof item.label === "string" && item.label !== id ? ` (${item.label})` : "";
  return `${id}${label}`;
}

function defaultSuffix(value: unknown): string {
  return value === true ? ` ${paint(terminalPalette.harbor, "[default]")}` : "";
}

function summaryLine(label: string, value: string): string {
  return `${muted(`  ${label}`)} ${value}`;
}

function itemLine(value: string): string {
  return `${paint(terminalPalette.brass, "  •")} ${value}`;
}

function sourceItemLine(title: string, source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return title;
  }

  return `${title}\n${muted(`    ${truncateMiddle(trimmed, 96)}`)}`;
}

function detailItemLine(title: string, details: string[]): string {
  if (details.length === 0) {
    return title;
  }

  return [
    title,
    ...details.map((detail) => muted(`    ${truncateMiddle(detail, 96)}`)),
  ].join("\n");
}

function sourceBadge(value: "Source" | "Cache"): string {
  return paint(value === "Source" ? terminalPalette.harbor : terminalPalette.brass, value);
}

function valueOrUnknown(value: unknown): string {
  return value === undefined || value === null ? "unknown" : String(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringListDetail(label: string, value: unknown): string[] {
  const values = stringList(value);
  return values.length > 0 ? [`${label}: ${values.join(", ")}`] : [];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pluralize(value: string): string {
  if (value === "plugin") {
    return "Plugins";
  }

  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}s`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const marker = "...";
  const sideLength = Math.floor((maxLength - marker.length) / 2);
  return `${value.slice(0, sideLength)}${marker}${value.slice(value.length - sideLength)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
