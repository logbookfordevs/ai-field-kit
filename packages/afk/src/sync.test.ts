import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test, vi } from "vitest";
import * as interactive from "./interactive.js";
import { runCliWithRuntime } from "./cli.js";
import { localManifestDir } from "./manifest.js";
import type { Runtime } from "./types.js";

const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(overrides: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "afk-sync-"));
  roots.push(root);
  const home = join(root, "home");
  const source = join(root, "source");
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const manifests: Record<string, unknown> = {
    "skills.json": { version: 1, defaultSource: "", items: [] },
    "profiles.json": { version: 1, mode: "strict", alwaysOn: [], items: [] },
    "agents.json": { version: 1, items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: source, presets: [{ id: "daily", label: "Daily", areas: ["tools"] }] },
    "rules.json": { version: 1, source: "github", url: "" },
    "tools.json": { version: 1, items: [tool("first"), tool("second")] },
    "hooks.json": { version: 1, items: [] },
    ...overrides,
  };
  function write(file: string, value: unknown) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)); }
  for (const [name, content] of Object.entries(manifests)) {
    write(join(source, "afk", "catalog", name), content);
    write(join(localManifestDir(home), name), content);
  }
  const output: string[] = [];
  const calls: Array<{ command: string; args: string[] }> = [];
  const runtime: Runtime = {
    io: { stdout: (line) => output.push(line), stderr: (line) => output.push(line) },
    spawn: async (command, args) => { calls.push({ command, args }); return { code: 0 }; },
  };
  return {
    home, source, output, calls, runtime, write,
    install: (id: string) => { const file = join(bin, id); writeFileSync(file, "#!/bin/sh\n"); chmodSync(file, 0o755); },
    run: (args: string[] = []) => runCliWithRuntime(["sync", ...args], { HOME: home, PATH: bin }, runtime, { stdin: false, stdout: false }),
  };
}
function tool(id: string) { return { id, label: id, description: id, default: false, install: { command: `install-${id}`, args: [] }, update: { command: id, args: ["update"] } }; }

test("sync requires a preset outside a terminal and rejects unknown presets without writes", async () => {
  const f = fixture();
  const before = readFileSync(join(localManifestDir(f.home), "tools.json"), "utf8");
  assert.equal(await f.run(), 1);
  assert.match(f.output.join("\n"), /needs --preset/);
  assert.equal(await f.run(["--preset", "missing", "--yes"]), 1);
  assert.match(f.output.join("\n"), /Unknown preset/);
  assert.equal(readFileSync(join(localManifestDir(f.home), "tools.json"), "utf8"), before);
  assert.equal(f.calls.length, 0);
});

test("sync refreshes commands, includes nondefault preset tools, preserves local-only entries, and skips missing tools", async () => {
  const f = fixture();
  f.install("first");
  f.write(join(localManifestDir(f.home), "tools.json"), { version: 1, items: [{ ...tool("first"), update: { command: "stale", args: [] } }, tool("local-only")] });
  assert.equal(await f.run(["--preset", "daily", "--yes"]), 0);
  assert.deepEqual(f.calls, [{ command: "first", args: ["update"] }]);
  assert.match(f.output.join("\n"), /second: not detected/);
  assert.match(readFileSync(join(localManifestDir(f.home), "tools.json"), "utf8"), /local-only/);
});

test("sync dry-run previews refreshed commands without cache writes or subprocesses", async () => {
  const f = fixture();
  f.install("first");
  const file = join(localManifestDir(f.home), "tools.json");
  f.write(file, { version: 1, items: [] });
  const before = readFileSync(file, "utf8");
  assert.equal(await f.run(["--preset", "daily", "--dry-run", "--yes"]), 0);
  assert.equal(readFileSync(file, "utf8"), before);
  assert.equal(f.calls.length, 0);
  assert.match(f.output.join("\n"), /first update/);
});

test("sync only installs missing selected members with --install-missing", async () => {
  const f = fixture({ "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["tools"], selections: { tools: ["second"] } }] } });
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--install-missing", "--yes"]), 0);
  assert.deepEqual(f.calls.map((call) => call.command), ["install-second"]);
});

test("sync continues independent updates and returns failure when one tool fails", async () => {
  const f = fixture();
  f.install("first"); f.install("second");
  f.runtime.spawn = async (command, args) => { f.calls.push({ command, args }); return { code: command === "first" ? 7 : 0 }; };
  assert.equal(await f.run(["--preset", "daily", "--yes"]), 1);
  assert.deepEqual(f.calls.map((call) => call.command), ["first", "second"]);
  assert.match(f.output.join("\n"), /1 succeeded, 0 skipped, 1 failed/);
});

test("sync honors an explicitly empty preset selection", async () => {
  const f = fixture({ "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["tools"], selections: { tools: [] } }] } });
  f.install("first");
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--yes"]), 0);
  assert.equal(f.calls.length, 0);
});

test("sync uses executable metadata for package-managed tools", async () => {
  const f = fixture({ "tools.json": { version: 1, items: [{ ...tool("package-id"), executable: "actual-bin", update: { command: "npm", args: ["install", "-g", "package-id@latest"] } }] } });
  f.install("actual-bin");
  assert.equal(await f.run(["--preset", "daily", "--yes"]), 0);
  assert.deepEqual(f.calls.map((call) => call.command), ["npm"]);
});

test("sync refreshes profile definitions without bringing in inactive package skills", async () => {
  const f = fixture({
    "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["profiles", "skills"], all: true }] },
    "profiles.json": { version: 2, mode: "strict", alwaysOn: [], items: [{ id: "package", name: "Package", catalogSkills: [], packages: [{ source: "owner/package" }] }] },
    "skills.json": { version: 1, defaultSource: "", items: [{ id: "package-skill", label: "Package skill", source: "owner/package", args: ["--skill", "package-skill"], default: false, imported: true }] },
  });
  f.write(join(f.source, "afk", "catalog", "skills.json"), { version: 1, defaultSource: "", items: [] });
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--install-missing", "--yes"]), 0);
  assert.equal(f.calls.length, 0);
  assert.match(f.output.join("\n"), /inactive package skill/);
  assert.equal(existsSync(join(f.home, ".agents", "skills", "package-skill")), false);
});

test("sync updates a disabled skill without enabling it or installing a missing dependency", async () => {
  const skill = (id: string) => ({ id, label: id, source: "owner/skills", args: ["--skill", id], default: false });
  const f = fixture({
    "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["skills"], selections: { skills: ["quiet"] } }] },
    "skills.json": { version: 1, defaultSource: "", items: [{ ...skill("quiet"), composes: ["dependency"] }, skill("dependency"), skill("unselected")] },
  });
  const disabled = join(f.home, ".agents", "skills", ".disabled", "quiet", "SKILL.md");
  mkdirSync(dirname(disabled), { recursive: true });
  writeFileSync(disabled, "---\nname: quiet\n---\nOld\n");
  f.runtime.spawn = async (command, args) => {
    f.calls.push({ command, args });
    const active = join(f.home, ".agents", "skills", "quiet", "SKILL.md");
    mkdirSync(dirname(active), { recursive: true });
    writeFileSync(active, "---\nname: quiet\n---\nUpdated\n");
    return { code: 0 };
  };
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--yes"]), 0);
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0]?.args.includes("quiet"));
  assert.match(readFileSync(disabled, "utf8"), /Updated/);
  assert.equal(existsSync(join(f.home, ".agents", "skills", "quiet")), false);
  assert.match(f.output.join("\n"), /dependency: not detected/);
});

test("sync refreshes managed rules and installed hooks while preserving unrelated content", async () => {
  const f = fixture();
  const ruleSource = join(f.source, "rules.md");
  const hookSource = join(f.source, "check.js");
  writeFileSync(ruleSource, "Fresh rule\n");
  writeFileSync(hookSource, "// Fresh hook\n");
  f.write(join(f.source, "afk", "catalog", "presets.json"), { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["rules", "hooks"] }] });
  f.write(join(f.source, "afk", "catalog", "rules.json"), { version: 2, layers: [{ id: "shared", label: "Shared", source: ruleSource }] });
  f.write(join(f.source, "afk", "catalog", "hooks.json"), { version: 1, items: [{ id: "check", label: "Check", description: "Check", source: hookSource, command: "node", args: [], events: ["stop"], agents: ["codex"], default: false }] });
  const target = join(f.home, ".codex", "AGENTS.md");
  mkdirSync(join(f.home, ".codex", "hooks"), { recursive: true });
  writeFileSync(target, "Personal rule\n<!-- AFK:RULES:START -->\nOld rule\n<!-- AFK:RULES:END -->\n");
  writeFileSync(join(f.home, ".codex", "hooks", "check.js"), "// Old hook\n");
  assert.equal(await f.run(["--preset", "daily", "--agent", "codex", "--yes"]), 0, f.output.join("\n"));
  assert.match(readFileSync(target, "utf8"), /Personal rule/);
  assert.match(readFileSync(target, "utf8"), /Fresh rule/);
  assert.match(readFileSync(join(f.home, ".codex", "hooks", "check.js"), "utf8"), /Fresh hook/);
});

test("sync updates only MCP targets with an existing named configuration", async () => {
  const f = fixture({
    "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["mcps"] }] },
    "mcps.json": { version: 1, items: [{ id: "service", label: "Service", source: "https://example.test/mcp", args: ["--name", "named-service"], default: false }] },
  });
  mkdirSync(join(f.home, ".codex"), { recursive: true });
  writeFileSync(join(f.home, ".codex", "config.toml"), '[mcp_servers."named-service"]\nurl = "https://old.test/mcp"\n');
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--agent", "codex", "--agent", "claude", "--yes"]), 0);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0]?.args[1], "https://example.test/mcp");
  assert.ok(f.calls[0]?.args.includes("codex"));
  assert.ok(!f.calls[0]?.args.includes("claude-code"));
  assert.match(f.output.join("\n"), /service \(claude\): not detected/);
});


test("bare interactive sync opens the preset picker", async () => {
  const f = fixture();
  const picker = vi.spyOn(interactive, "selectPresetId").mockResolvedValue("daily");
  assert.equal(await runCliWithRuntime(["sync", "--dry-run"], { HOME: f.home, PATH: "" }, f.runtime, { stdin: true, stdout: true }), 0);
  assert.equal(picker.mock.calls.length, 1);
  assert.equal(f.calls.length, 0);
});

test("sync updates installed Custom Agents and skips missing definitions", async () => {
  const f = fixture();
  const source = join(f.source, "helper.md");
  writeFileSync(source, "---\nname: helper\ndescription: Helps with a bounded task.\n---\nUpdated instructions.\n");
  f.write(join(f.source, "afk", "catalog", "presets.json"), { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["agents"], all: true }] });
  f.write(join(f.source, "afk", "catalog", "agents.json"), { version: 1, items: [{ id: "helper", label: "Helper", source }, { id: "missing", label: "Missing", source }] });
  const target = join(f.home, ".claude", "agents", "helper.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "Old instructions.\n");
  assert.equal(await f.run(["--preset", "daily", "--agent", "claude", "--yes"]), 0, f.output.join("\n"));
  assert.match(readFileSync(target, "utf8"), /Updated instructions/);
  assert.equal(existsSync(join(f.home, ".claude", "agents", "missing.md")), false);
});

test("sync rejects an invalid selection before writing the refreshed cache", async () => {
  const f = fixture();
  const before = readFileSync(join(localManifestDir(f.home), "presets.json"), "utf8");
  f.write(join(f.source, "afk", "catalog", "presets.json"), { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["tools"], selections: { tools: ["unknown"] } }] });
  assert.equal(await f.run(["--preset", "daily", "--yes"]), 1);
  assert.match(f.output.join("\n"), /unknown catalog entry/);
  assert.equal(readFileSync(join(localManifestDir(f.home), "presets.json"), "utf8"), before);
  assert.equal(f.calls.length, 0);
});


test("sync detects OpenCode JSONC native server maps without treating comment-like strings as comments", async () => {
  const f = fixture({
    "presets.json": { version: 1, presets: [{ id: "daily", label: "Daily", areas: ["mcps"] }] },
    "mcps.json": { version: 1, items: [{ id: "service", label: "Service", source: "https://example.test/mcp", args: ["--name", "service"], default: false }] },
  });
  const file = join(f.home, ".config", "opencode", "opencode.jsonc");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '{ // MCP config\n"mcp": {"servers": {"service": {"url": "https://old.test/mcp",},},}, /* end */ }');
  assert.equal(await f.run(["--preset", "daily", "--source", f.source, "--agent", "opencode", "--yes"]), 0);
  assert.equal(f.calls.length, 1);
});
