import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

  if (options.manifestShowVisualize) {
    return runSkillsVisualization(runtime, options, selected, showSource);
  }

  runtime.io.stdout("");
  runtime.io.stdout(sectionTitle("AFK catalog"));
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
  if ((options.manifestShowReact || options.manifestShowVisualize) && flags.length === 0) {
    return categories.filter((category) => category.id === "skills");
  }

  if (flags.length === 0) {
    return categories.filter((category) => category.id !== "presets");
  }

  return categories.filter((category) => flags.includes(category.id));
}

async function runSkillsVisualization(runtime: Runtime, options: CliOptions, selected: ManifestShowCategory[], showSource: boolean): Promise<number> {
  if (selected.some((category) => category.id !== "skills")) {
    runtime.io.stderr("The skills visualization only supports skills. Use afk show skills --visualize.");
    return 1;
  }

  const skillCategory = categories.find((category) => category.id === "skills");
  if (!skillCategory) {
    runtime.io.stderr("Skills catalog category is not available.");
    return 1;
  }

  const loaded = showSource ? await loadSourceManifest(skillCategory.filename, options) : loadLocalManifest(manifestShowDir(options), skillCategory.filename);
  if (!loaded.content || !isRecord(loaded.content)) {
    runtime.io.stderr("Skills catalog file is missing or invalid. Run afk refresh, or pass --source to visualize a source directly.");
    return 1;
  }

  const outputPath = join(options.cwd, "afk-skills.html");
  writeFileSync(outputPath, renderSkillsVisualizationHtml(loaded.content, {
    generatedAt: new Date().toISOString(),
    sourceKind: loaded.source,
    sourceLabel: loaded.location,
  }));
  runtime.io.stdout(`Skill visualization written: ${outputPath}`);
  await openVisualizationWhenInteractive(runtime, outputPath);
  return 0;
}

async function openVisualizationWhenInteractive(runtime: Runtime, outputPath: string): Promise<void> {
  if (!shouldAutoOpenVisualization()) {
    return;
  }

  const command = openFileCommand(outputPath);
  const result = await runtime.spawn(command.command, command.args, undefined, { verbose: false });
  if (result.code === 0) {
    runtime.io.stdout("Skill visualization opened in your browser.");
  }
}

function shouldAutoOpenVisualization(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.CI !== "true" && process.env.AFK_NO_OPEN !== "1";
}

function openFileCommand(path: string): { command: string; args: string[] } {
  if (process.platform === "darwin") {
    return { command: "open", args: [path] };
  }

  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", path] };
  }

  return { command: "xdg-open", args: [path] };
}

function manifestShowDir(options: CliOptions): string {
  return options.setupScope === "project" || options.manifestLocal ? join(options.cwd, "afk", "catalog") : localManifestDir(options.homeDir);
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
    return "- Invalid catalog file shape";
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

function renderSkillsVisualizationHtml(manifest: Record<string, unknown>, context: { generatedAt: string; sourceKind: string; sourceLabel: string }): string {
  const items = skillItems(manifest);
  const modelDiscovered = items.filter((item) => item.autoInvocation !== false);
  const userInvoked = items.filter((item) => item.autoInvocation === false);
  const composed = items.filter((item) => stringList(item.composes).length > 0);
  const roleCounts = roleSummary(items);
  const reactTree = renderSkillsAsReactPlain(manifest);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AFK Skills Composition</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfaf7;
    --paper: #ffffff;
    --paper-2: #f0eee8;
    --ink: #171512;
    --muted: #665f55;
    --line: #d6cec0;
    --primitive: #c75a49;
    --wrapper: #247268;
    --workflow: #50508f;
    --utility: #8a612c;
    --reference: #395f85;
    --router: #8d3b64;
    --external: #b65a3c;
    --mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    --sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --serif: ui-serif, Georgia, "Times New Roman", Times, serif;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #141414;
      --paper: #1f1e1c;
      --paper-2: #292724;
      --ink: #f7f0e3;
      --muted: #b8ad9b;
      --line: #5a4f40;
      --primitive: #ff7b62;
      --wrapper: #69c7b5;
      --workflow: #a79cff;
      --utility: #ebb15e;
      --reference: #7db7f2;
      --router: #f078ad;
      --external: #ff987d;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.5;
  }
  .wrap { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 70px; }
  header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; border-bottom: 1px solid var(--line); padding-bottom: 22px; }
  .eyebrow { font-family: var(--mono); color: var(--muted); font-size: 12px; margin-bottom: 12px; }
  h1 { font-family: var(--serif); font-size: clamp(38px, 6vw, 72px); line-height: 0.98; margin: 0; font-weight: 520; max-width: 11ch; }
  .subhead { color: var(--muted); max-width: 58rem; margin: 18px 0 0; font-size: 17px; }
  .meta { font-family: var(--mono); color: var(--muted); font-size: 12px; text-align: right; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); border-block: 1px solid var(--line); margin: 28px 0 0; }
  .metric { padding: 16px 14px; border-right: 1px solid var(--line); }
  .metric:last-child { border-right: 0; }
  .metric b { display: block; font-family: var(--mono); color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .metric span { display: block; font-size: 28px; margin-top: 4px; }
  section { margin-top: 54px; }
  .section-head { display: grid; grid-template-columns: minmax(0, 0.55fr) minmax(280px, 1fr); gap: 24px; align-items: end; border-top: 1px solid var(--line); padding-top: 20px; margin-bottom: 18px; }
  h2 { font-family: var(--serif); font-weight: 520; font-size: clamp(27px, 4vw, 42px); line-height: 1.04; margin: 0; }
  .section-head p { margin: 0; color: var(--muted); }
  .lanes { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .lane { border-top: 1px solid var(--line); padding-top: 14px; min-width: 0; }
  .lane h3 { margin: 0 0 12px; font-size: 17px; }
  .skill-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .skill, .composition-card { border: 1px solid var(--line); background: var(--paper); padding: 12px; border-radius: 8px; min-width: 0; }
  .skill { border-left: 5px solid var(--role-color); }
  .skill b, .composition-card b { display: block; overflow-wrap: anywhere; }
  .skill span, .composition-card span { display: block; color: var(--muted); font-family: var(--mono); font-size: 11px; margin-top: 3px; }
  .primitive { --role-color: var(--primitive); }
  .wrapper { --role-color: var(--wrapper); }
  .workflow { --role-color: var(--workflow); }
  .utility { --role-color: var(--utility); }
  .reference { --role-color: var(--reference); }
  .router { --role-color: var(--router); }
  .composition-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .composition-card { border-top: 4px solid var(--role-color); }
  .children { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .pill { border: 1px solid var(--line); border-radius: 999px; padding: 4px 7px; font-family: var(--mono); font-size: 11px; color: var(--ink); background: var(--paper-2); }
  .code-window { margin: 0; border: 1px solid rgba(255,255,255,0.08); background: #15130f; color: #f8ead7; border-radius: 8px; padding: 18px; font-family: var(--mono); font-size: 12px; line-height: 1.66; overflow: auto; max-height: 720px; }
  .jsx-punct { color: #8c8374; }
  .jsx-root, .jsx-primitive { color: #9de0cf; }
  .jsx-group, .jsx-string { color: #f8ead7; }
  .jsx-wrapper { color: #f3bf68; }
  .jsx-workflow { color: #b6adff; }
  .jsx-utility { color: #dca85e; }
  .jsx-reference { color: #86b9ed; }
  .jsx-router { color: #ff8fbd; }
  .jsx-external, .jsx-false { color: #ff987d; }
  .jsx-prop { color: #ffb07c; }
  footer { border-top: 1px solid var(--line); color: var(--muted); font-family: var(--mono); font-size: 12px; margin-top: 56px; padding-top: 18px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  @media (max-width: 820px) {
    header, .section-head, .lanes { grid-template-columns: 1fr; }
    .meta { text-align: left; }
    .metrics { grid-template-columns: repeat(2, 1fr); }
    .metric:nth-child(2) { border-right: 0; }
    .metric:nth-child(-n + 2) { border-bottom: 1px solid var(--line); }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <div class="eyebrow">AFK skills / composition visualization</div>
        <h1>Skills as a component system.</h1>
        <p class="subhead">A static snapshot of the current skills catalog: primitives stay discoverable, wrappers become named experiences, and workflows carry larger execution motion.</p>
      </div>
      <div class="meta">
        <div>${escapeHtml(context.sourceKind)} source</div>
        <div>${escapeHtml(context.sourceLabel)}</div>
        <div>${escapeHtml(context.generatedAt)}</div>
      </div>
    </header>

    <div class="metrics">
      <div class="metric"><b>skills</b><span>${items.length}</span></div>
      <div class="metric"><b>auto-discoverable</b><span>${modelDiscovered.length}</span></div>
      <div class="metric"><b>explicit</b><span>${userInvoked.length}</span></div>
      <div class="metric"><b>composed</b><span>${composed.length}</span></div>
    </div>

    <section>
      <div class="section-head">
        <h2>Invocation lanes.</h2>
        <p>Auto-discoverable skills are available to the model by topic. Explicit skills are still installable and invokable, but stay out of automatic discovery.</p>
      </div>
      <div class="lanes">
        <div class="lane">
          <h3>Model discovery</h3>
          <div class="skill-grid">${modelDiscovered.map(renderSkillCardHtml).join("")}</div>
        </div>
        <div class="lane">
          <h3>Explicit invocation</h3>
          <div class="skill-grid">${userInvoked.map(renderSkillCardHtml).join("")}</div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Composed skills.</h2>
        <p>These are the wrappers and workflows with children. This is where the React analogy becomes concrete: role becomes component, composes becomes children.</p>
      </div>
      <div class="composition-grid">${composed.map((item) => renderCompositionCardHtml(item, items)).join("")}</div>
    </section>

    <section>
      <div class="section-head">
        <h2>React analogy.</h2>
        <p>The tree below is not runtime code. It is a readable projection of <code>role</code>, <code>autoInvocation</code>, and <code>composes</code>.</p>
      </div>
      <pre class="code-window">${highlightJsxForHtml(reactTree)}</pre>
    </section>

    <section>
      <div class="section-head">
        <h2>Role counts.</h2>
        <p>The catalog doubles as a small architecture map.</p>
      </div>
      <div class="skill-grid">${roleCounts.map(([role, count]) => `<div class="skill ${roleClass(role)}"><b>${escapeHtml(role)}</b><span>${count} skill${count === 1 ? "" : "s"}</span></div>`).join("")}</div>
    </section>

    <footer>
      <span>Generated by <code>afk show skills --visualize</code>.</span>
      <span>Small pieces. Named compositions. Explicit discovery.</span>
    </footer>
  </div>
</body>
</html>
`;
}

function renderSkillCardHtml(item: Record<string, unknown>): string {
  const id = stringValue(item.id, "unnamed");
  const label = typeof item.label === "string" && item.label !== id ? item.label : "";
  const role = stringValue(item.role, "primitive");
  return `<article class="skill ${roleClass(role)}"><b>${escapeHtml(label || id)}</b><span>${escapeHtml(role)} · ${item.default === true ? "default" : "optional"}</span></article>`;
}

function renderCompositionCardHtml(item: Record<string, unknown>, items: Record<string, unknown>[]): string {
  const id = stringValue(item.id, "unnamed");
  const role = stringValue(item.role, "primitive");
  const byId = new Map(items.map((entry) => [stringValue(entry.id, "unnamed"), entry]));
  const children = stringList(item.composes);
  return `<article class="composition-card ${roleClass(role)}"><b>${escapeHtml(id)}</b><span>${escapeHtml(role)} · ${children.length} child${children.length === 1 ? "" : "ren"}</span><div class="children">${children.map((child) => {
    const childItem = byId.get(child);
    return `<span class="pill">${escapeHtml(child)}${childItem ? "" : " external"}</span>`;
  }).join("")}</div></article>`;
}

function renderSkillsAsReactPlain(manifest: Record<string, unknown>): string {
  const items = skillItems(manifest);
  const byId = new Map(items.map((item) => [stringValue(item.id, "unnamed"), item]));
  const modelDiscovered = items.filter((item) => item.autoInvocation !== false);
  const userInvoked = items.filter((item) => item.autoInvocation === false);
  return [
    "<AFKSkillTree>",
    ...renderReactGroupPlain("ModelDiscovery", modelDiscovered, byId, 1),
    ...renderReactGroupPlain("ExplicitInvocation", userInvoked, byId, 1),
    "</AFKSkillTree>",
  ].join("\n");
}

function renderReactGroupPlain(name: string, items: Record<string, unknown>[], byId: Map<string, Record<string, unknown>>, indentLevel: number): string[] {
  const indent = "  ".repeat(indentLevel);
  if (items.length === 0) {
    return [`${indent}<${name} />`];
  }

  return [
    `${indent}<${name}>`,
    ...items.flatMap((item) => renderSkillComponentPlain(item, byId, indentLevel + 1)),
    `${indent}</${name}>`,
  ];
}

function renderSkillComponentPlain(item: Record<string, unknown>, byId: Map<string, Record<string, unknown>>, indentLevel: number): string[] {
  const indent = "  ".repeat(indentLevel);
  const children = stringList(item.composes);
  const tag = componentTag(item.role);
  const attrs = skillAttributesPlain(item, "id");
  if (children.length === 0) {
    return [`${indent}<${tag} ${attrs} />`];
  }

  return [
    `${indent}<${tag} ${attrs}>`,
    ...children.map((childId) => renderSkillReferencePlain(childId, byId, indentLevel + 1)),
    `${indent}</${tag}>`,
  ];
}

function renderSkillReferencePlain(id: string, byId: Map<string, Record<string, unknown>>, indentLevel: number): string {
  const indent = "  ".repeat(indentLevel);
  const item = byId.get(id);
  const tag = item ? componentTag(item.role) : "ExternalSkill";
  const attrs = item ? skillAttributesPlain(item, "ref") : `ref="${escapeJsxAttribute(id)}" external`;
  return `${indent}<${tag} ${attrs} />`;
}

function skillAttributesPlain(item: Record<string, unknown>, idProp: "id" | "ref"): string {
  const attrs = [
    `${idProp}="${escapeJsxAttribute(stringValue(item.id, "unnamed"))}"`,
    item.autoInvocation === false ? "autoDiscovery={false}" : "autoDiscovery",
  ];
  if (item.default === true) {
    attrs.push("defaultInstalled");
  }

  return attrs.join(" ");
}

function escapeJsxAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function skillItems(manifest: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(manifest.items) ? manifest.items.filter(isRecord) : [];
}

function roleSummary(items: Record<string, unknown>[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const role = stringValue(item.role, "primitive");
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function roleClass(role: string): string {
  return ["primitive", "wrapper", "workflow", "utility", "reference", "router"].includes(role) ? role : "primitive";
}

function highlightJsxForHtml(source: string): string {
  return escapeHtml(source).replace(/&lt;[^\n]*?&gt;/g, highlightJsxTagForHtml);
}

function highlightJsxTagForHtml(token: string): string {
  const closing = token.startsWith("&lt;/");
  const selfClosing = token.endsWith("/&gt;");
  const open = closing ? "&lt;/" : "&lt;";
  const close = selfClosing ? " /&gt;" : "&gt;";
  const inner = token.slice(open.length, token.length - (selfClosing ? 5 : 4)).trim();
  const firstSpace = inner.indexOf(" ");
  const tag = firstSpace === -1 ? inner : inner.slice(0, firstSpace);
  const attrs = closing || firstSpace === -1 ? "" : inner.slice(firstSpace + 1);
  return `<span class="jsx-punct">${open}</span><span class="${jsxTagClass(tag)}">${tag}</span>${attrs ? ` ${highlightJsxAttributesForHtml(attrs)}` : ""}<span class="jsx-punct">${close}</span>`;
}

function highlightJsxAttributesForHtml(attrs: string): string {
  return attrs.split(/\s+/).filter(Boolean).map((attr) => {
    if (attr.includes("={false}")) {
      const [name] = attr.split("=");
      return `<span class="jsx-prop">${escapeHtml(name ?? "")}</span><span class="jsx-punct">={</span><span class="jsx-false">false</span><span class="jsx-punct">}</span>`;
    }

    const stringMatch = attr.match(/^([^=]+)="(.+)"$/);
    if (stringMatch) {
      return `<span class="jsx-prop">${escapeHtml(stringMatch[1] ?? "")}</span><span class="jsx-punct">="</span><span class="jsx-string">${escapeHtml(stringMatch[2] ?? "")}</span><span class="jsx-punct">"</span>`;
    }

    const escapedStringMatch = attr.match(/^([^=]+)=&quot;(.+)&quot;$/);
    if (escapedStringMatch) {
      return `<span class="jsx-prop">${escapeHtml(escapedStringMatch[1] ?? "")}</span><span class="jsx-punct">="</span><span class="jsx-string">${escapeHtml(unescapeHtmlAttribute(escapedStringMatch[2] ?? ""))}</span><span class="jsx-punct">"</span>`;
    }

    return `<span class="jsx-prop">${escapeHtml(attr)}</span>`;
  }).join(" ");
}

function unescapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function jsxTagClass(tag: string): string {
  if (tag === "AFKSkillTree") return "jsx-root";
  if (tag === "ModelDiscovery" || tag === "ExplicitInvocation") return "jsx-group";
  if (tag === "PrimitiveSkill") return "jsx-primitive";
  if (tag === "WrapperSkill") return "jsx-wrapper";
  if (tag === "WorkflowSkill") return "jsx-workflow";
  if (tag === "UtilitySkill") return "jsx-utility";
  if (tag === "ReferenceSkill") return "jsx-reference";
  if (tag === "RouterSkill") return "jsx-router";
  return "jsx-external";
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
    case "WorkflowSkill":
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
    case "workflow":
      return "WorkflowSkill";
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

function escapeHtml(value: string): string {
  return escapeAttribute(value);
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
