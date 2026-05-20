import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sectionTitle, muted } from "./brand.js";
import { localManifestDir } from "./manifest.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { CliOptions, ManifestCategory, Runtime } from "./types.js";

type ManifestShowCategory = {
  id: ManifestCategory;
  label: string;
  filename: string;
};

const categories: ManifestShowCategory[] = [
  { id: "rules", label: "Rules", filename: "rules.json" },
  { id: "workflows", label: "Workflows", filename: "workflows.json" },
  { id: "skills", label: "Skills", filename: "skills.json" },
  { id: "mcps", label: "MCPs", filename: "mcps.json" },
  { id: "utils", label: "Utils", filename: "utils.json" },
  { id: "presets", label: "Presets", filename: "presets.json" },
];

export function runManifestShow(runtime: Runtime, options: CliOptions): number {
  const selected = selectedCategories(options);
  const manifestDir = manifestShowDir(options);
  const scopeLabel = options.setupScope === "project" ? "Project" : "Global";

  runtime.io.stdout("");
  runtime.io.stdout(sectionTitle("AFK manifests"));
  runtime.io.stdout(`${muted("Scope")} ${scopeBadge(scopeLabel)}  ${muted("Directory")} ${manifestDir}`);

  for (const category of selected) {
    const loaded = loadManifest(manifestDir, category.filename);
    runtime.io.stdout(renderCardHeader(category.label, loaded));

    if (!loaded.content) {
      runtime.io.stdout(`${muted("  status")} ${paint(terminalPalette.ember, "missing")}`);
      continue;
    }

    runtime.io.stdout(renderManifestSummary(category.id, loaded.content));
  }

  return 0;
}

function selectedCategories(options: CliOptions): ManifestShowCategory[] {
  const flags = options.selectedManifestCategories;
  if (flags.length === 0) {
    return categories.filter((category) => category.id !== "presets");
  }

  return categories.filter((category) => flags.includes(category.id));
}

function manifestShowDir(options: CliOptions): string {
  return options.setupScope === "project" ? join(options.cwd, "afk", "manifests") : localManifestDir(options.homeDir);
}

function loadManifest(manifestDir: string, filename: string): { source: "local" | "missing"; path: string; content: unknown | null } {
  const localPath = join(manifestDir, filename);
  if (existsSync(localPath)) {
    return {
      source: "local",
      path: localPath,
      content: JSON.parse(readFileSync(localPath, "utf8")) as unknown,
    };
  }

  return {
    source: "missing",
    path: localPath,
    content: null,
  };
}

function renderCardHeader(label: string, loaded: { source: string; path: string }): string {
  const status = loaded.source === "missing" ? paint(terminalPalette.ember, "missing") : paint(terminalPalette.harbor, "ready");
  return [
    "",
    `${paint(terminalPalette.brass, "┌")} ${bold}${label}${reset} ${muted(`(${loaded.source})`)} ${status}`,
    `${muted("  file")} ${loaded.path}`,
  ].join("\n");
}

function renderManifestSummary(category: ManifestCategory, manifest: unknown): string {
  if (!isRecord(manifest)) {
    return "- Invalid manifest shape";
  }

  switch (category) {
    case "rules":
      return renderRules(manifest);
    case "workflows":
      return renderItems(manifest, "workflow");
    case "skills":
      return renderSkills(manifest);
    case "mcps":
      return renderItems(manifest, "MCP");
    case "utils":
      return renderUtils(manifest);
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
      const auto = item.autoInvocation === false ? ` ${paint(terminalPalette.ember, "auto:off")}` : "";
      return sourceItemLine(`${labelFor(item)}${defaultSuffix(item.default)}${auto}`, args);
    }),
  ].join("\n");
}

function renderUtils(manifest: Record<string, unknown>): string {
  return [
    summaryLine("version", valueOrUnknown(manifest.version)),
    ...renderItemList(manifest.items, "utility", (item) => {
      const description = typeof item.description === "string" ? item.description : "";
      return sourceItemLine(`${labelFor(item)}${defaultSuffix(item.default)}`, description);
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

function scopeBadge(value: "Project" | "Global"): string {
  return paint(value === "Project" ? terminalPalette.harbor : terminalPalette.brass, value);
}

function valueOrUnknown(value: unknown): string {
  return value === undefined || value === null ? "unknown" : String(value);
}

function pluralize(value: string): string {
  if (value === "utility") {
    return "Utilities";
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
