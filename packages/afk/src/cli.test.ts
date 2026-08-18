import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";
import { isPromptExit, runCli, runCliWithRuntime } from "./cli.js";
import type { Runtime } from "./types.js";
import { localManifestDir } from "./manifest.js";

test("runCli prints package version for version flags", async () => {
  const output: string[] = [];
  const expectedVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
  const code = await withConsole(output, () => runCli(["--version"]));

  assert.equal(code, 0);
  assert.equal(output.join("\n"), `afk ${expectedVersion}`);

  output.length = 0;
  const shortCode = await withConsole(output, () => runCli(["-v"]));
  assert.equal(shortCode, 0);
  assert.equal(output.join("\n"), `afk ${expectedVersion}`);
});

test("runCli prints general help for top-level help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk refresh [category...] [options]"));
  assert.ok(output.join("\n").includes("afk open"));
  assert.ok(!output.join("\n").includes("afk catalog [options]"));
  assert.ok(output.join("\n").includes("afk doctor [options]"));
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes("afk setup profiles [options]"));
  assert.ok(output.join("\n").includes("afk setup mcps [options]"));
  assert.ok(output.join("\n").includes("afk setup plugins [options]"));
  assert.ok(output.join("\n").includes("afk setup hooks [options]"));
  assert.ok(output.join("\n").includes("afk ui <command> [options]"));
  assert.ok(output.join("\n").includes("afk update [options]"));
  assert.ok(output.join("\n").includes("afk rules catalog [command] [options]"));
  assert.ok(output.join("\n").includes("afk skills catalog <command> [options]"));
  assert.ok(output.join("\n").includes("afk profiles catalog <command> [options]"));
  assert.ok(output.join("\n").includes("afk agents catalog [command] [options]"));
  assert.ok(output.join("\n").includes("afk mcps catalog [command] [options]"));
  assert.ok(output.join("\n").includes("afk plugins catalog [command] [options]"));
  assert.ok(output.join("\n").includes("afk hooks catalog [command] [options]"));
  assert.ok(!output.join("\n").includes("afk setup utils"));
  assert.ok(output.join("\n").includes("afk show [category...] [options]"));
  assert.ok(output.join("\n").includes("afk setup [options]         Prepare rules, skills, Custom Agents, MCPs, plugins, and hooks"));
  assert.ok(output.join("\n").includes("afk skills catalog <command> [options]             Manage skills catalog definitions"));
  assert.ok(output.join("\n").includes("afk profiles catalog <command> [options]           Edit profile catalog data"));
  assert.ok(output.join("\n").includes("afk update [options]        Update AFK from the latest GitHub release"));
  assert.ok(output.join("\n").includes("afk doctor [options]        Validate every local AFK catalog file"));
  assert.ok(!output.join("\n").includes("afk config [options]"));
  assert.ok(!output.join("\n").includes("afk manifests configure [options]"));
  assert.ok(!output.join("\n").includes("afk manifests show [options]"));
  assert.ok(!output.join("\n").includes("afk setup mcps install [options]"));
  assert.ok(output.join("\n").includes("afk --version"));
  assert.ok(output.join("\n").includes('Run "afk <command> --help"'));
});

test("runCli routes catalog operations under their command families", async () => {
  const output: string[] = [];

  for (const [family, title] of [
    ["rules", "AFK rules catalog"],
    ["skills", "AFK skills catalog"],
    ["profiles", "AFK profiles catalog"],
    ["agents", "AFK agents catalog"],
    ["mcps", "AFK mcps catalog"],
    ["plugins", "AFK plugins catalog"],
    ["hooks", "AFK hooks catalog"],
  ] as const) {
    output.length = 0;
    const code = await withConsole(output, () => runCli([family, "catalog", "--help"]));
    assert.equal(code, 0, family);
    assert.ok(output.join("\n").includes(title), family);
  }

  output.length = 0;
  const oldCode = await withConsole(output, () => runCli(["catalog", "skills", "--help"]));
  assert.equal(oldCode, 1);
  assert.ok(output.join("\n").includes("Unknown command: catalog skills"));
});

test("runCli prints contextual open help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["open", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK open"));
  assert.ok(text.includes("afk open"));
  assert.ok(text.includes("Open the user AFK folder"));
  assert.ok(text.includes("--code"));
});

test("runCli prints contextual doctor help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["doctor", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK doctor"));
  assert.ok(text.includes("afk doctor [options]"));
  assert.ok(text.includes("--local"));
  assert.ok(text.includes("global catalog by default"));
});

test("runCli accepts --code for afk open", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async (command, args) => {
      calls.push({ command, args });
      return { code: 0 };
    },
  };

  const code = await runCliWithRuntime(["open", "--code"], { HOME: "/tmp/leo" }, runtime);

  assert.equal(code, 0);
  assert.deepEqual(calls, [{ command: "code", args: ["/tmp/leo/.agents/afk"] }]);
});

test("runCli prints contextual update help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["update", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK update"));
  assert.ok(text.includes("afk update [options]"));
  assert.ok(text.includes("Update the AFK CLI from the latest GitHub release."));
  assert.ok(text.includes("afk update --dry-run"));
});

test("runCli reports operational errors without exposing a stack trace", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-cli-error-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "rules.json"), "{ invalid json\n");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["show", "rules"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 1);
  assert.ok(text.includes("AFK could not complete the command:"));
  assert.ok(text.includes("JSON"));
  assert.ok(!text.includes("node:fs"));
  assert.ok(!text.includes("\n    at "));
});

test("runCli doctor validates the global AFK catalog by default", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-cli-doctor-global-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), JSON.stringify({ version: 1, items: [] }));
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["doctor"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 1);
  assert.ok(text.includes("skills.json"));
  assert.ok(text.includes("Invalid"));
  assert.ok(text.includes(manifestDir));
});

test("runCli doctor accepts a valid global AFK catalog", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-cli-doctor-valid-"));
  const manifestDir = localManifestDir(homeDir);
  cpSync(resolve(new URL("../catalog", import.meta.url).pathname), manifestDir, { recursive: true });
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["doctor"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK doctor found 8 valid catalog files."));
});

test("runCli doctor --local validates the project AFK catalog", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "afk-cli-doctor-local-"));
  const projectCatalogDir = join(cwd, "afk", "catalog");
  cpSync(resolve(new URL("../catalog", import.meta.url).pathname), projectCatalogDir, { recursive: true });
  writeFileSync(join(projectCatalogDir, "hooks.json"), JSON.stringify({ version: 1, items: [{ id: "broken" }] }));
  const originalCwd = process.cwd();
  const output: string[] = [];

  try {
    process.chdir(cwd);
    const code = await withConsole(output, () => runCli(["doctor", "--local"], { HOME: mkdtempSync(join(tmpdir(), "afk-cli-doctor-home-")) }));
    const text = output.join("\n");

    assert.equal(code, 1);
    assert.ok(text.includes(projectCatalogDir));
    assert.ok(text.includes("Invalid hooks.json"));
  } finally {
    process.chdir(originalCwd);
  }
});

test("runCli exposes Custom Agents as a first-class command family", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "agents", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup agents"));
  assert.ok(text.includes("--custom-agent <id>"));
  assert.ok(text.includes("--all"));
  assert.ok(text.includes("--yes confirms the operation; it never selects Custom Agents"));

  output.length = 0;
  const catalogCode = await withConsole(output, () => runCli(["agents", "catalog", "add", "--help"]));
  const catalogText = output.join("\n");
  assert.equal(catalogCode, 0);
  assert.ok(catalogText.includes("AFK agents catalog"));
  assert.ok(!catalogText.includes("toggle-default"));

  output.length = 0;
  const showCode = await withConsole(output, () => runCli(["show", "agents", "--help"]));
  assert.equal(showCode, 0);
  assert.ok(output.join("\n").includes("AFK show agents"));
});

test("runCli exposes preset setup and rejects a missing preset id", async () => {
  const output: string[] = [];
  const helpCode = await withConsole(output, () => runCli(["setup", "--help"]));
  const helpText = output.join("\n");

  assert.equal(helpCode, 0);
  assert.ok(helpText.includes("--preset <id>"));
  assert.ok(helpText.includes("afk setup --preset afk-architect"));

  output.length = 0;
  const missingCode = await withConsole(output, () => runCli(["setup", "--preset"]));

  assert.equal(missingCode, 1);
  assert.ok(output.join("\n").includes("Missing --preset value"));
});

test("runCli exposes the preset command family and setup preset routes", async () => {
  const output: string[] = [];
  const presetHelpCode = await withConsole(output, () => runCli(["preset", "--help"]));
  const presetHelp = output.join("\n");

  assert.equal(presetHelpCode, 0);
  assert.ok(presetHelp.includes("AFK preset"));
  assert.ok(presetHelp.includes("afk preset [id] [options]"));
  assert.ok(presetHelp.includes("--source <source>"));

  output.length = 0;
  const setupHelpCode = await withConsole(output, () => runCli(["setup", "preset", "--help"]));
  const setupHelp = output.join("\n");

  assert.equal(setupHelpCode, 0);
  assert.ok(setupHelp.includes("AFK setup preset"));
  assert.ok(setupHelp.includes("afk setup preset [id] [options]"));
  assert.ok(setupHelp.includes("afk setup preset afk-architect"));
});

test("runCli accepts explicit preset ids through both new routes", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-preset-routes-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);

  for (const route of [["preset", "afk-architect"], ["setup", "preset", "afk-architect"]]) {
    const output: string[] = [];
    const code = await withConsole(output, () => runCli([
      ...route,
      "--source",
      repoDir,
      "--agent",
      "codex",
      "--yes",
      "--dry-run",
    ], { HOME: homeDir, AI_RULES_REPO: repoDir }));

    assert.equal(code, 0);
    assert.ok(output.join("\n").includes("- Preset: afk-architect"));
  }
});

test("runCli dry-runs the source-aware daily routine in declared area order", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-daily-routine-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([
    "preset",
    "daily-routine",
    "--source",
    repoDir,
    "--agent",
    "codex",
    "--yes",
    "--dry-run",
  ], { HOME: homeDir, AI_RULES_REPO: repoDir }));
  const text = output.join("\n");

  assert.equal(code, 0, text);
  assert.ok(text.includes("- Preset: daily-routine"));
  assert.ok(text.includes("- Areas: rules, skills, plugins, agents"));
  assert.ok(text.indexOf("◆ Rules") < text.indexOf("◆ Skills"));
  assert.ok(text.indexOf("◆ Skills") < text.indexOf("◆ Plugins"));
  assert.ok(text.indexOf("◆ Plugins") < text.indexOf("◆ Custom Agents"));
  assert.ok(text.includes("- afk-architect ->"));
  assert.ok(text.includes("afk-cartographer.toml"));
});

test("runCli documents the existing all-catalog setup path", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("afk setup --all --yes"));
  assert.ok(text.includes("every cataloged item"));
});

test("runCli refreshes the full catalog before setup when --refresh is passed", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-setup-refresh-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const output: string[] = [];

  const code = await withConsole(output, () => runCli([
    "setup",
    "--refresh",
    "--source",
    repoDir,
    "--yes",
    "--dry-run",
    "--init-only",
  ], { HOME: homeDir, AI_RULES_REPO: repoDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("Refreshing global AFK catalog."));
  assert.ok(text.indexOf("Refreshing global AFK catalog.") < text.indexOf("Choose the parts of your AI field setup"));
});

test("runCli limits project setup area refreshes to the matching local catalog category", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-setup-skills-refresh-"));
  const projectDir = mkdtempSync(join(tmpdir(), "afk-setup-skills-project-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const originalCwd = process.cwd();

  process.chdir(projectDir);
  try {
    const code = await runCli([
      "setup",
      "skills",
      "--local",
      "--refresh",
      "--source",
      repoDir,
      "--yes",
      "--init-only",
    ], { HOME: homeDir, AI_RULES_REPO: repoDir });

    assert.equal(code, 0);
    assert.equal(existsSync(join(projectDir, "afk", "catalog", "skills.json")), true);
    assert.equal(existsSync(join(projectDir, "afk", "catalog", "rules.json")), false);
    assert.equal(existsSync(join(projectDir, "afk", "catalog", "mcps.json")), false);
    assert.equal(existsSync(join(localManifestDir(homeDir), "skills.json")), false);
  } finally {
    process.chdir(originalCwd);
  }
});

test("runCli dry-runs the AFK Architect required bundle in dependency order", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-architect-cli-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([
    "setup",
    "--preset",
    "afk-architect",
    "--source",
    repoDir,
    "--agent",
    "codex",
    "--yes",
    "--dry-run",
  ], { HOME: homeDir, AI_RULES_REPO: repoDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("◆ AFK Architect"));
  assert.ok(text.includes("- Preset: afk-architect"));
  assert.ok(text.includes("- Bundle: Architect + Cartographer + Builder + Pathfinder"));
  assert.ok(text.includes("- Areas: skills, agents"));
  assert.ok(text.includes("--skill afk-architect"));
  assert.ok(text.includes("afk-cartographer.toml"));
  assert.ok(text.includes("afk-builder.toml"));
  assert.ok(text.includes("afk-pathfinder.toml"));
  assert.ok(text.indexOf("Shared skills") < text.indexOf("afk-cartographer.toml"));
  assert.equal(text.match(/◆ Custom Agents/g)?.length, 1);
  assert.ok(text.includes("AFK Architect voyage charted"));
  assert.ok(text.includes("→ AFK Architect"));
  assert.ok(text.includes("Shared skill →"));
  assert.ok(text.includes("→ Cartographer →"));
  assert.ok(text.includes("→ Builder →"));
  assert.ok(text.includes("→ Pathfinder →"));
  assert.ok(text.includes("1 skill and 3 Custom Agents would be provisioned for Codex."));
  assert.ok(text.includes("☠"));
  assert.ok(!text.includes("Plugins /"));
  assert.ok(!text.includes("MCPs /"));
});

test("runCli reports an unknown setup preset without throwing", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-unknown-preset-cli-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([
    "setup",
    "--preset",
    "missing-preset",
    "--source",
    repoDir,
    "--yes",
    "--dry-run",
  ], { HOME: homeDir, AI_RULES_REPO: repoDir }));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown AFK preset: missing-preset"));
});

test("runCli marks an optimized preset incomplete when a selected harness cannot provision its agents", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-incomplete-preset-cli-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([
    "setup",
    "--preset",
    "afk-architect",
    "--source",
    repoDir,
    "--agent",
    "pi",
    "--yes",
    "--dry-run",
  ], { HOME: homeDir, AI_RULES_REPO: repoDir }));
  const text = output.join("\n");

  assert.equal(code, 1);
  assert.ok(text.includes("--skill afk-architect"));
  assert.ok(text.includes("AFK skipped Pi"));
  assert.ok(text.includes("Setup completed with failures"));
});

test("runCli dry-runs CLI update", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["update", "--dry-run"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash"));
});

test("runCli keeps plain afk as help in non-interactive output", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk setup [options]"));
});

test("runCli prints contextual refresh help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["refresh", "skills", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK refresh"));
  assert.ok(output.join("\n").includes("afk refresh skills"));
  assert.ok(output.join("\n").includes("Refresh cached AFK catalog"));
  assert.ok(output.join("\n").includes("Use refresh when you want the local catalog cache to change."));
  assert.ok(output.join("\n").includes("--override"));
  assert.ok(!output.join("\n").includes("--refresh-defaults"));
});

test("runCli limits override to the top-level refresh command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "refresh", "--override"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("--override is only supported with afk refresh"));
});

test("runCli accepts override for a targeted refresh", async () => {
  const output: string[] = [];
  const homeDir = mkdtempSync(join(tmpdir(), "afk-targeted-override-"));
  const code = await withConsole(output, () => runCli(
    ["refresh", "skills", "--override", "--empty", "--dry-run"],
    { HOME: homeDir },
  ));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("skills.json"));
});

test("runCli prints contextual skills catalog import help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "catalog", "import", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills catalog import"));
  assert.ok(text.includes("afk skills catalog import --local"));
  assert.ok(text.includes("Backfill missing skills catalog entries"));
  assert.ok(text.includes("original source can be recovered"));
});

test("runCli rejects old catalog import command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["catalog", "import", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 1);
  assert.ok(text.includes("Unknown command: catalog import"));
});

test("runCli exposes catalog skills status and rejects the removed import-status command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "catalog", "status", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills catalog status"));
  assert.ok(text.includes("Compare installed shared skills with skills catalog entries."));
  assert.ok(text.includes("afk skills catalog status --local"));

  output.length = 0;
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-skills-status-"));
  const statusCode = await withConsole(output, () => runCli(["skills", "catalog", "status"], { HOME: homeDir }));
  assert.equal(statusCode, 0);
  assert.ok(output.join("\n").includes("Catalog Skills Status"));

  output.length = 0;
  const removedCode = await withConsole(output, () => runCli(["skills", "catalog", "import-status"]));
  assert.equal(removedCode, 1);
  assert.ok(output.join("\n").includes("Unknown catalog skills command: import-status"));
});

test("runCli rejects the removed refresh-defaults flag", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--refresh-defaults"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --refresh-defaults"));
});

test("runCli rejects the removed include-external flag", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "skills", "--include-external"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --include-external"));
});

test("runCli prints contextual setup help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup"));
  assert.ok(text.includes("--refresh"));
  assert.ok(text.includes("Use this when you want AFK to prepare agent-facing surfaces"));
  assert.ok(text.includes("Subcommands:"));
  assert.ok(!text.includes("afk setup refresh"));
  assert.ok(text.includes("afk setup profiles"));
  assert.ok(text.includes("afk setup profiles                Install skills from Skills Profiles"));
  assert.ok(text.includes("afk setup mcps"));
  assert.ok(text.includes("afk setup plugins"));
  assert.ok(text.includes("afk setup hooks"));
  assert.ok(!text.includes("afk setup utils"));
  assert.ok(text.includes("--verbose"));
  assert.ok(!text.includes("afk setup mcps install"));
  assert.ok(!text.includes("--default-source <source>"));
  assert.ok(text.includes("--all"));
  assert.ok(!text.includes("afk setup --default-source your-org/dev-kit"));
  assert.ok(!text.includes("afk setup --defaults-source your-org/dev-kit"));
  assert.ok(!text.includes("--refresh-defaults"));
  assert.ok(!text.includes("--include-external"));
});

test("runCli prints contextual area help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "mcps", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup MCPs"));
  assert.ok(text.includes("--refresh"));
  assert.ok(text.includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(text.includes("--verbose                         Show delegated installer output"));
  assert.ok(text.includes("--yes, -y                         Accept defaults and skip prompts"));
  assert.ok(text.includes("--agent <agent>                   Override detected targets; repeatable"));
  assert.ok(!text.includes("--default-source <source>"));
  assert.ok(!text.includes("AFK setup skills"));
});

test("runCli prints contextual setup profiles help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "profiles", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup profiles"));
  assert.ok(text.includes("Install skills from selected profiles in profiles.json."));
  assert.ok(text.includes("automatically includes their composed dependencies"));
  assert.ok(text.includes("offers lock-backed recovery, then asks before installing the available skills"));
  assert.ok(text.includes("afk setup profiles --local"));
  assert.ok(!text.includes("AFK setup skills"));
});

test("runCli rejects the removed setup utils command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "utils", "--help"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown command: setup utils"));
});

test("runCli rejects the removed util manifest flag", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "--util"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --util"));
});

test("runCli rejects old manifest category flags", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "--skills"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --skills"));
});

test("runCli accepts default-source aliases on refresh", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => emptyCatalogResponse(input);
  const homeDir = mkdtempSync(join(tmpdir(), "afk-default-source-alias-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);

  try {
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(
      ["refresh", "--default-source", "acme/dev-kit"],
      { HOME: homeDir, AI_RULES_REPO: repoDir },
    ));

    assert.equal(code, 0);
    assert.equal(readFileSync(join(localManifestDir(homeDir), "presets.json"), "utf8").includes('"defaultsSource": "acme/dev-kit"'), true);

    output.length = 0;
    const aliasCode = await withConsole(output, () => runCli(
      ["refresh", "--defaults-source", "acme/legacy-kit"],
      { HOME: homeDir, AI_RULES_REPO: repoDir },
    ));

    assert.equal(aliasCode, 0);
    assert.equal(readFileSync(join(localManifestDir(homeDir), "presets.json"), "utf8").includes('"defaultsSource": "acme/legacy-kit"'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli keeps --source github mapped to the built-in AFK defaults source", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return emptyCatalogResponse(input);
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-source-github-"));
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(
      ["refresh", "--dry-run", "--source", "github"],
      { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
    ));

    assert.equal(code, 0);
    assert.ok(requestedUrls.length > 0);
    assert.ok(requestedUrls.every((url) => url.startsWith("https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli accepts skills CLI agent targets for noninteractive skill installs", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "afk-note",
          label: "AFK / Note",
          source: "https://github.com/logbookfordevs/ai-field-kit",
          args: ["--skill", "afk-note"],
          default: true,
          autoInvocation: true,
        },
      ],
    },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "local", presets: [] },
    "rules.json": { version: 1, source: "github", url: "" },
    "plugins.json": { version: 1, items: [] },
    "hooks.json": { version: 1, items: [] },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(
    ["setup", "skills", "--dry-run", "--verbose", "--yes", "--agent", "claude-code"],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("$ npx skills add https://github.com/logbookfordevs/ai-field-kit"));
  assert.ok(text.includes("--agent universal"));
  assert.ok(text.includes("--agent claude-code"));
});

test("runCli setup skills help uses skills CLI agent names", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "skills", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("afk setup skills --local --agent claude-code"));
  assert.equal(/^  afk setup skills --local --agent claude$/m.test(text), false);
});

test("runCli keeps old area command forms as aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "mcps", "install", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup MCPs"));
  assert.ok(text.includes("Usage:\n  afk setup mcps [options]"));
});

test("runCli prints contextual hooks help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "hooks", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup hooks"));
  assert.ok(output.join("\n").includes("Merge selected AFK lifecycle hooks"));
  assert.ok(!output.join("\n").includes("AFK setup skills"));
});

test("runCli rejects the removed top-level catalog command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["catalog", "--help"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown command: catalog"));
});

test("runCli prints contextual catalog area help", async () => {
  const rulesOutput: string[] = [];
  const rulesCode = await withConsole(rulesOutput, () => runCli(["rules", "catalog", "--help"]));
  const rulesText = rulesOutput.join("\n");

  assert.equal(rulesCode, 0);
  assert.ok(rulesText.includes("AFK rules catalog"));
  assert.ok(rulesText.includes("Manage ordered rules layers in rules.json."));
  assert.ok(rulesText.includes("add"));
  assert.ok(rulesText.includes("remove"));
  assert.ok(rulesText.includes("afk rules catalog edit --local"));

  const skillsOutput: string[] = [];
  const skillsCode = await withConsole(skillsOutput, () => runCli(["skills", "catalog", "toggle-auto", "--help"]));
  const skillsText = skillsOutput.join("\n");

  assert.equal(skillsCode, 0);
  assert.ok(skillsText.includes("AFK skills catalog"));
  assert.ok(skillsText.includes("toggle-auto"));
  assert.ok(skillsText.includes("bulk-edit"));
  assert.ok(skillsText.includes("status"));
  assert.ok(!skillsText.includes("import-status"));

  const mcpsOutput: string[] = [];
  const mcpsCode = await withConsole(mcpsOutput, () => runCli(["mcps", "catalog", "--help"]));
  const mcpsText = mcpsOutput.join("\n");

  assert.equal(mcpsCode, 0);
  assert.ok(mcpsText.includes("AFK mcps catalog"));
  assert.ok(mcpsText.includes("toggle-default"));
});

test("runCli rejects removed config command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["config", "--help"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown command: config"));
});

test("runCli rejects removed configure aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["configure", "--help"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown command: configure"));

  output.length = 0;
  const legacyCode = await withConsole(output, () => runCli(["manifests", "configure", "--help"]));
  assert.equal(legacyCode, 1);
  assert.ok(output.join("\n").includes("Unknown command: manifests configure"));
});

test("runCli prints contextual skills help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "list", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK skills list"));
  assert.ok(output.join("\n").includes("--scope global|project|all"));
  assert.ok(output.join("\n").includes("--agent <agent>|custom"));
  assert.ok(output.join("\n").includes("--agent-path <folder>"));
  assert.ok(output.join("\n").includes("--enabled"));
  assert.ok(output.join("\n").includes("--disabled"));
  assert.ok(output.join("\n").includes("--auto-invocation <state>"));
  assert.ok(output.join("\n").includes("--category <id-or-label>"));
  assert.ok(!output.join("\n").includes("AFK setup skills install"));
});

test("runCli lists get, update, and reset in the skills command help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("get <folder>"));
  assert.ok(text.includes("update [skills...]"));
  assert.ok(text.includes("reset"));
  assert.ok(!text.includes("upgrade [skills...]"));
});

test("runCli validates skills list auto invocation filters", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "list", "--auto-invocation", "invalid"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --auto-invocation value: invalid"));
});

test("runCli lists only enabled skills unless disabled storage is requested", async () => {
  const homeDir = localHomeWithManifests({});
  writeSkill(join(homeDir, ".agents", "skills"), "active-demo", "Active Demo");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "disabled-demo", "Disabled Demo");
  const output: string[] = [];

  const defaultCode = await withConsole(output, () => runCli(["skills", "list"], { HOME: homeDir }));
  const defaultText = output.join("\n");

  assert.equal(defaultCode, 0);
  assert.ok(defaultText.includes("active-demo"));
  assert.ok(!defaultText.includes("disabled-demo"));

  output.length = 0;
  const disabledCode = await withConsole(output, () => runCli(["skills", "list", "--disabled"], { HOME: homeDir }));
  const disabledText = output.join("\n");

  assert.equal(disabledCode, 0);
  assert.ok(!disabledText.includes("active-demo"));
  assert.ok(disabledText.includes("disabled-demo"));
});

test("runCli shows disabled skills only when disabled storage is requested", async () => {
  const homeDir = localHomeWithManifests({});
  writeSkill(join(homeDir, ".agents", "skills"), "active-demo", "Active Demo");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "disabled-demo", "Disabled Demo");
  const output: string[] = [];

  const activeCode = await withConsole(output, () => runCli(["skills", "show", "active-demo"], { HOME: homeDir }));

  assert.equal(activeCode, 0);
  assert.ok(output.join("\n").includes("Active Demo"));

  output.length = 0;
  const defaultDisabledCode = await withConsole(output, () => runCli(["skills", "show", "disabled-demo"], { HOME: homeDir }));

  assert.equal(defaultDisabledCode, 1);
  assert.ok(output.join("\n").includes("Skill not found: disabled-demo"));

  output.length = 0;
  const explicitDisabledCode = await withConsole(output, () =>
    runCli(["skills", "show", "disabled-demo", "--disabled"], { HOME: homeDir })
  );

  assert.equal(explicitDisabledCode, 0);
  assert.ok(output.join("\n").includes("Disabled Demo"));
});

test("runCli prints contextual ui help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["ui", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK UI"));
  assert.ok(text.includes("Delegate UI-focused skill routing to UI Skills."));
  assert.ok(text.includes("afk ui list --category motion"));
});

test("runCli dry-runs ui-skills list delegation", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["ui", "list", "--category", "motion", "--dry-run"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("$ npx --yes ui-skills list --category motion"));
});

test("runCli validates ui category usage", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["ui", "get", "baseline-ui", "--category", "motion"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --category"));
});

test("runCli prints contextual skills open help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "open", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK skills open"));
  assert.ok(output.join("\n").includes("--app finder|code|cursor|zed|agy"));
  assert.ok(output.join("\n").includes("--agent <agent>|custom"));
  assert.ok(output.join("\n").includes("--agent-path <folder>"));
  assert.ok(output.join("\n").includes("--enabled"));
  assert.ok(output.join("\n").includes("--disabled"));
});

test("runCli prints contextual skills get help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "get", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills get"));
  assert.ok(text.includes("Print one local skill as agent context"));
});

test("runCli accepts --all for profile use and prints complete skill content", async () => {
  const homeDir = localHomeWithManifests({
    "profiles.json": {
      version: 1,
      alwaysOn: [],
      items: [{ id: "video", name: "Video", skills: ["demo"] }],
    },
  });
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "demo", "Demo");
  const output: string[] = [];

  const code = await withConsole(output, () =>
    runCli(["skills", "profiles", "use", "video", "--all"], { HOME: homeDir })
  );
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("The user wants you to take into account the skills listed below."));
  assert.ok(text.includes("# Demo"));
  assert.ok(text.includes('storage="disabled"'));
});

test("runCli prints contextual skills update help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "update", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills update"));
  assert.ok(text.includes("--scope global|project|all"));
  assert.ok(text.includes("--all"));
  assert.ok(!text.includes("skills upgrade"));
  assert.ok(!text.includes("AFK skills check"));
});

test("runCli rejects the retired skills upgrade command", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "upgrade"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown skills command: upgrade"));
});

test("runCli prints contextual skills delete help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "delete", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills delete"));
  assert.ok(text.includes("--agent <agent>|custom"));
  assert.ok(text.includes("--agent-path <folder>"));
  assert.ok(text.includes("--enabled"));
  assert.ok(text.includes("--disabled"));
  assert.ok(text.includes("--catalog-only"));
  assert.ok(text.includes("--profile"));
});

test("runCli prints contextual skills invocation help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "invocation", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills invocation"));
  assert.ok(text.includes("invocation [disable|enable] [folder]"));
  assert.ok(text.includes("Bare command opens the batch editor"));
  assert.ok(text.includes("--agent <agent>|custom"));
  assert.ok(text.includes("--agent-path <folder>"));
  assert.ok(text.includes("--enabled"));
  assert.ok(text.includes("--disabled"));
});

test("runCli prints contextual skills profiles help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "profiles", "enable", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills profiles"));
  assert.ok(text.includes("enable <profile>"));
  assert.ok(text.includes("--focus"));
  assert.ok(text.includes("--additive"));
  assert.ok(text.includes("--local"));
  assert.ok(!text.includes("--always-on <skill>"));
  assert.ok(!text.includes("create <profile>"));
});

test("runCli dry-runs a shared skills reset against catalog policy", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        { id: "active-catalog", label: "Active", source: "example/skills", args: ["--skill", "active-catalog"], default: false, autoInvocation: true },
        { id: "disabled-catalog", label: "Disabled", source: "example/skills", args: ["--skill", "disabled-catalog"], default: false, autoInvocation: false, startDisabled: true },
      ],
    },
    "profiles.json": { version: 2, mode: "context", alwaysOn: [], items: [] },
  });
  const skillsRoot = join(homeDir, ".agents", "skills");
  writeSkill(join(skillsRoot, ".disabled"), "active-catalog", "Active");
  writeSkill(join(skillsRoot, ".disabled"), "uncataloged-disabled", "Uncataloged Disabled");
  writeSkill(skillsRoot, "disabled-catalog", "Disabled");
  writeSkill(skillsRoot, "uncataloged", "Uncataloged");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["skills", "reset", "--dry-run"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0, text);
  assert.ok(text.includes("Skills Reset Preview"), text);
  assert.ok(text.includes("Activate (1)"), text);
  assert.ok(text.includes("active-catalog"), text);
  assert.ok(text.includes("Disable (2)"), text);
  assert.ok(text.includes("disabled-catalog, uncataloged"), text);
  assert.equal(existsSync(join(skillsRoot, ".disabled", "active-catalog")), true);
  assert.equal(existsSync(join(skillsRoot, "disabled-catalog")), true);
  assert.equal(existsSync(join(skillsRoot, "uncataloged")), true);
  assert.equal(existsSync(join(skillsRoot, ".disabled", "uncataloged-disabled")), true);
});

test("runCli resets shared storage, invocation policy, and profile state", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        { id: "active-catalog", label: "Active", source: "example/skills", args: ["--skill", "active-catalog"], default: false, autoInvocation: true },
        { id: "disabled-catalog", label: "Disabled", source: "example/skills", args: ["--skill", "disabled-catalog"], default: false, autoInvocation: false, startDisabled: true },
        { id: "missing-catalog", label: "Missing", source: "example/skills", args: ["--skill", "missing-catalog"], default: false },
      ],
    },
    "profiles.json": { version: 2, mode: "context", alwaysOn: [], items: [] },
  });
  const skillsRoot = join(homeDir, ".agents", "skills");
  writeSkill(join(skillsRoot, ".disabled"), "active-catalog", "Active");
  writeSkill(join(skillsRoot, ".disabled"), "uncataloged-disabled", "Uncataloged Disabled");
  writeSkill(skillsRoot, "disabled-catalog", "Disabled");
  writeSkill(skillsRoot, "uncataloged", "Uncataloged");
  const statePath = join(homeDir, ".agents", "afk", "state", "skill-profiles.json");
  mkdirSync(join(homeDir, ".agents", "afk", "state"), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify({
    version: 2,
    activations: [{ profileId: "video", mode: "focus" }],
    profileMovedSkills: ["uncataloged"],
    preExistingDisabledSkills: ["active-catalog"],
  }, null, 2)}\n`);
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["skills", "reset", "--yes"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0, text);
  assert.equal(existsSync(join(skillsRoot, "active-catalog")), true);
  assert.equal(existsSync(join(skillsRoot, ".disabled", "disabled-catalog")), true);
  assert.equal(existsSync(join(skillsRoot, ".disabled", "uncataloged")), true);
  assert.equal(existsSync(join(skillsRoot, ".disabled", "uncataloged-disabled")), true);
  assert.match(readFileSync(join(skillsRoot, "active-catalog", "SKILL.md"), "utf8"), /disable-model-invocation: false/);
  assert.match(readFileSync(join(skillsRoot, ".disabled", "disabled-catalog", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  assert.match(readFileSync(join(skillsRoot, "active-catalog", "agents", "openai.yaml"), "utf8"), /allow_implicit_invocation: true/);
  assert.match(readFileSync(join(skillsRoot, ".disabled", "disabled-catalog", "agents", "openai.yaml"), "utf8"), /allow_implicit_invocation: false/);
  assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), {
    version: 2,
    activations: [],
    profileMovedSkills: [],
    preExistingDisabledSkills: [],
  });
  assert.ok(text.includes("missing-catalog"), text);
});

test("runCli enables a profile additively by default", async () => {
  const homeDir = localHomeWithManifests({
    "profiles.json": {
      version: 1,
      alwaysOn: [],
      items: [{ id: "video", name: "Video", skills: ["video"] }],
    },
  });
  writeSkill(join(homeDir, ".agents", "skills"), "baseline", "Baseline");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "video", "Video");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(
    ["skills", "profiles", "enable", "video", "--dry-run"],
    { HOME: homeDir },
  ));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("video (additive)"));
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "baseline")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "video")), true);
});

test("runCli accepts additive as an explicit compatibility alias", async () => {
  const homeDir = localHomeWithManifests({
    "profiles.json": {
      version: 1,
      alwaysOn: [],
      items: [{ id: "video", name: "Video", skills: ["video"] }],
    },
  });
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "video", "Video");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(
    ["skills", "profiles", "enable", "video", "--additive", "--dry-run"],
    { HOME: homeDir },
  ));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("video (additive)"));
});

test("runCli enables a profile in focus mode through the runtime flag", async () => {
  const homeDir = localHomeWithManifests({
    "profiles.json": {
      version: 1,
      alwaysOn: [],
      items: [{ id: "video", name: "Video", skills: ["video"] }],
    },
  });
  writeSkill(join(homeDir, ".agents", "skills"), "baseline", "Baseline");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "video", "Video");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(
    ["skills", "profiles", "enable", "video", "--focus", "--dry-run"],
    { HOME: homeDir },
  ));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("Deactivated (1)"), text);
  assert.ok(text.includes("baseline"), text);
  assert.ok(!text.includes("video (additive)"), text);
});

test("runCli rejects conflicting profile activation modes", async () => {
  const output: string[] = [];

  const code = await withConsole(output, () => runCli([
    "skills",
    "profiles",
    "enable",
    "video",
    "--focus",
    "--additive",
  ]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Use either --focus or --additive"));
});

test("runCli rejects additive mode outside profile enable", async () => {
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["skills", "profiles", "disable", "video", "--additive"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("--additive is only available for afk skills profiles enable"));
});

test("runCli rejects focus mode outside profile enable", async () => {
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["skills", "profiles", "disable", "video", "--focus"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("--focus is only available for afk skills profiles enable"));
});

test("runCli prints contextual catalog profiles help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["profiles", "catalog", "create", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK profiles catalog"));
  assert.ok(text.includes("afk profiles catalog <command>"));
  assert.ok(text.includes("create <profile>"));
  assert.ok(text.includes("--profile-only"));
  assert.ok(text.includes("Use afk skills profiles enable|disable|status"));
});

test("runCli creates local catalog profiles with repeated skill flags", async () => {
  const homeDir = localHomeWithManifests({});
  const cwd = mkdtempSync(join(tmpdir(), "afk-cli-catalog-profile-project-"));
  const output: string[] = [];
  const originalCwd = process.cwd();
  process.chdir(cwd);

  try {
    const code = await withConsole(output, () => runCli(
      [
        "profiles",
        "catalog",
        "create",
        "video",
        "--local",
        "--name",
        "Video",
        "--skill",
        "hyperframes",
        "--skill",
        "tailwind",
        "--always-on",
        "afk-compass",
        "--mode",
        "context",
      ],
      { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
    ));

    assert.equal(code, 0);
    assert.ok(output.join("\n").includes("Profile Create Complete"));
    const catalog = JSON.parse(readFileSync(join(cwd, "afk", "catalog", "profiles.json"), "utf8")) as {
      mode: string;
      alwaysOn: string[];
      items: Array<{ id: string; name: string; skills: string[] }>;
    };
    assert.equal(catalog.mode, "context");
    assert.deepEqual(catalog.alwaysOn, ["afk-compass"]);
    assert.deepEqual(catalog.items, [{ id: "video", name: "Video", catalogSkills: ["hyperframes", "tailwind"], packages: [] }]);
  } finally {
    process.chdir(originalCwd);
  }
});

test("runCli accepts storage filters for catalog profile skill selection", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-cli-catalog-profile-filter-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  mkdirSync(join(homeDir, ".agents", "afk", "catalog"), { recursive: true });
  writeFileSync(join(homeDir, ".agents", "afk", "catalog", "skills.json"), JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [{ id: "disabled-demo", label: "Disabled Demo", source: "", args: [], default: false }],
  }));

  const code = await withConsole(output, () => runCli(
    ["profiles", "catalog", "create", "quiet", "--name", "Quiet", "--disabled", "--skill", "disabled-demo"],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Profile Create Complete"));
});

test("runCli keeps profile definition operations under catalog profiles", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "profiles", "create", "video"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Use afk profiles catalog create instead."));
});

test("runCli keeps runtime profile operations under skills profiles", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["profiles", "catalog", "enable", "video"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Use afk skills profiles enable instead."));
});

test("runCli accepts skills delete catalog-only flag", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "alpha",
          label: "Alpha",
          source: "https://github.com/example/skills",
          args: ["--skill", "alpha"],
          default: true,
        },
      ],
    },
  });
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(
    ["skills", "delete", "beta", "--catalog-only", "--dry-run"],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Skill not found in skills.json catalog: beta"));
});

test("runCli rejects boolean values for skills storage filters", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "list", "--enabled", "false"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Use --enabled or --disabled without a value"));
});

test("runCli rejects skills enabled filter where it is not meaningful", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "enable", "--enabled"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --enabled"));
});

test("runCli rejects shared as an agent because shared is the default", async () => {
  const homeDir = localHomeWithManifests({});
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(
    ["skills", "list", "--agent", "shared"],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --agent value: shared"));
});

test("runCli accepts a custom skill agent with a literal path", async () => {
  const homeDir = localHomeWithManifests({});
  const agentPath = join(homeDir, "my-agent", "skills");
  writeSkill(agentPath, "custom-demo", "Custom Demo");
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(
    ["skills", "list", "--agent", "custom", "--agent-path", agentPath],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("custom-demo"));
});

test("runCli defaults an explicit preset agent to its global root", async () => {
  const homeDir = localHomeWithManifests({});
  const projectDir = mkdtempSync(join(tmpdir(), "afk-skills-preset-scope-"));
  const originalCwd = process.cwd();
  writeSkill(join(homeDir, ".codex", "skills"), "global-demo", "Global Demo");
  writeSkill(join(projectDir, ".codex", "skills"), "project-demo", "Project Demo");
  const output: string[] = [];

  try {
    process.chdir(projectDir);
    const code = await withConsole(output, () => runCli(
      ["skills", "list", "--agent", "codex"],
      { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
    ));
    const text = output.join("\n");

    assert.equal(code, 0);
    assert.ok(text.includes("global-demo"));
    assert.ok(!text.includes("project-demo"));
  } finally {
    process.chdir(originalCwd);
  }
});

test("runCli validates the custom skill agent path contract", async () => {
  const output: string[] = [];
  const missingPathCode = await withConsole(output, () => runCli(["skills", "list", "--agent", "custom"]));
  assert.equal(missingPathCode, 1);
  assert.ok(output.join("\n").includes("--agent custom requires --agent-path <folder>"));

  output.length = 0;
  const missingAgentCode = await withConsole(output, () => runCli(["skills", "list", "--agent-path", "/tmp/my-agent/skills"]));
  assert.equal(missingAgentCode, 1);
  assert.ok(output.join("\n").includes("--agent-path requires --agent custom"));

  output.length = 0;
  const scopeCode = await withConsole(output, () => runCli(["skills", "list", "--agent", "custom", "--agent-path", "/tmp/my-agent/skills", "--scope", "global"]));
  assert.equal(scopeCode, 1);
  assert.ok(output.join("\n").includes("Do not combine --scope with --agent custom"));
});

test("runCli validates skills update scope", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "update", "--scope", "agent"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --scope value: agent"));
});

test("runCli rejects root targeting flags on unrelated skills commands", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "update", "--agent", "codex"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --agent"));
});

test("runCli documents profile-selected skill updates", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "update", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("--profile"));
  assert.ok(text.includes("afk skills update video --profile"));
});

test("runCli routes profile-selected updates through global scope validation", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "update", "video", "--profile", "--scope", "project"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Profile updates use the global skill library"));
});

test("runCli validates skills open app", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "open", "demo", "--app", "vim"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --app value: vim"));
});

test("runCli validates skills categorize runner", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "categorize", "--runner", "sdk"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --runner value: sdk"));
});

test("runCli prints contextual skills add help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "add", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills add"));
  assert.ok(text.includes("afk skills add <source>"));
  assert.ok(text.includes("Forwarded to skills add"));
  assert.ok(text.includes("--profile"));
  assert.ok(text.includes("--profile-only"));
  assert.ok(text.includes("--start-disabled"));
});

test("runCli validates skills add profile-only value", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "add", "owner/skills", "--profile-only"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Missing --profile-only value"));
});

test("runCli prints contextual manifest show help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK show"));
  assert.ok(output.join("\n").includes("--local"));
  assert.ok(output.join("\n").includes("--react"));
  assert.ok(output.join("\n").includes("--visualize"));
  assert.ok(!output.join("\n").includes("--rules"));
  assert.ok(!output.join("\n").includes("--hooks"));
  assert.ok(output.join("\n").includes("afk show skills"));
  assert.ok(output.join("\n").includes("afk show skills --react"));
  assert.ok(output.join("\n").includes("afk show skills --visualize"));
  assert.ok(output.join("\n").includes("afk show skills mcps"));
  assert.ok(!output.join("\n").includes("afk show --rules --skills"));
  assert.ok(!output.join("\n").includes("AFK setup\n"));
});

test("runCli prints contextual show skills help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "skills", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK show skills"));
  assert.ok(text.includes("React-style composition tree"));
  assert.ok(text.includes("--react                          Show skills as a React-style composition tree"));
  assert.ok(text.includes("--visualize                      Write and open a skills composition HTML file"));
  assert.ok(text.includes("afk show skills --source logbookfordevs/ai-field-kit --ref main"));
  assert.ok(!text.includes("afk show skills mcps"));
});

test("runCli prints contextual show category help through old aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "show", "mcps", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK show MCPs"));
  assert.ok(text.includes("Inspect MCP recommendations"));
  assert.ok(text.includes("Usage:\n  afk show mcps [options]"));
});

test("runCli keeps old manifest command forms as aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "show", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK show"));
  assert.ok(text.includes("Usage:\n  afk show [category...] [options]"));
});

test("runCli shows cached manifests by default", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "remote-skill",
            label: "Remote Skill",
            source: "https://github.com/acme/dev-kit",
            args: ["--skill", "remote-skill"],
            default: true,
            autoInvocation: true,
            role: "wrapper",
            composes: ["grilling", "truss-evaluation"],
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const homeDir = localHomeWithManifests({
      "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
      "skills.json": {
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "local-skill",
            label: "Local Skill",
            source: "https://github.com/acme/local-kit",
            args: ["--skill", "local-skill"],
            default: true,
            autoInvocation: true,
          },
        ],
      },
    });
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(["show", "skills"], { HOME: homeDir }));
    const text = output.join("\n");

    assert.equal(code, 0);
    assert.deepEqual(requestedUrls, []);
    assert.ok(text.includes("AFK catalog"));
    assert.ok(text.includes("Cache"));
    assert.ok(text.includes("local-skill"));
    assert.ok(text.includes("auto-invocation: on"));
    assert.ok(!text.includes("remote-skill"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli shows rules dependency sources and destinations", async () => {
  const homeDir = localHomeWithManifests({
    "rules.json": {
      version: 1,
      source: "github",
      url: "https://example.com/AGENTS.md",
      files: [
        {
          source: "https://example.com/artifacts.md",
          destination: "artifacts.md",
        },
      ],
    },
  });
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["show", "rules"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("https://example.com/artifacts.md"));
  assert.ok(text.includes("artifacts.md"));
});

test("runCli shows skills as a React-style composition tree", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response("missing", { status: 404 });
  };

  try {
    const homeDir = localHomeWithManifests({
      "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
      "skills.json": {
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "afk-code-grill",
            label: "AFK - Code Grill",
            source: "https://github.com/acme/local-kit",
            args: ["--skill", "afk-code-grill"],
            default: true,
            autoInvocation: false,
            role: "wrapper",
            composes: ["grilling", "truss-evaluation", "codebase-design"],
          },
          {
            id: "grilling",
            label: "Grilling",
            source: "https://github.com/acme/local-kit",
            args: ["--skill", "grilling"],
            default: true,
            autoInvocation: true,
            role: "primitive",
          },
          {
            id: "truss-evaluation",
            label: "Truss Evaluation",
            source: "https://github.com/acme/local-kit",
            args: ["--skill", "truss-evaluation"],
            default: true,
            autoInvocation: true,
            role: "primitive",
          },
        ],
      },
    });
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(["show", "skills", "--react"], { HOME: homeDir }));
    const text = output.join("\n");

    assert.equal(code, 0);
    assert.deepEqual(requestedUrls, []);
    assert.ok(text.includes("components 3 (2 auto-discoverable, 1 explicit)"));
    assert.ok(text.includes("<AFKSkillTree>"));
    assert.ok(text.includes("<ModelDiscovery>"));
    assert.ok(text.includes("<ExplicitInvocation>"));
    assert.ok(text.includes("<WrapperSkill id=\"afk-code-grill\" autoDiscovery={false} defaultInstalled>"));
    assert.ok(text.includes("<PrimitiveSkill ref=\"grilling\" autoDiscovery defaultInstalled />"));
    assert.ok(text.includes("<ExternalSkill ref=\"codebase-design\" external />"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli treats show --react as the skills React view", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
    "skills.json": { version: 1, defaultSource: "", items: [] },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "--react"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("Skills"));
  assert.ok(!text.includes("MCPs"));
});

test("runCli rejects the React skill view for non-skill catalogs", async () => {
  const homeDir = localHomeWithManifests({
    "mcps.json": { version: 1, items: [] },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "mcps", "--react"], { HOME: homeDir }));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("The React skill view only supports skills."));
});

test("runCli writes a skills visualization HTML file", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "afk-code-grill",
          label: "AFK - Code Grill",
          source: "https://github.com/acme/local-kit",
          args: ["--skill", "afk-code-grill"],
          default: true,
          autoInvocation: false,
          role: "wrapper",
          composes: ["grilling"],
        },
        {
          id: "grilling",
          label: "Grilling",
          source: "https://github.com/acme/local-kit",
          args: ["--skill", "grilling"],
          default: true,
          autoInvocation: true,
          role: "primitive",
        },
      ],
    },
  });
  const cwd = mkdtempSync(join(tmpdir(), "afk-visualize-"));
  const previousCwd = process.cwd();
  const output: string[] = [];

  try {
    process.chdir(cwd);
    const code = await withConsole(output, () => runCli(["show", "skills", "--visualize"], { HOME: homeDir }));
    const htmlPath = join(cwd, "afk-skills.html");
    const html = readFileSync(htmlPath, "utf8");

    assert.equal(code, 0);
    assert.ok(output.join("\n").includes("Skill visualization written:"));
    assert.ok(existsSync(htmlPath));
    assert.ok(html.includes("Skills as a component system."));
    assert.ok(html.includes("afk-code-grill"));
    assert.ok(html.includes("AFKSkillTree"));
    assert.ok(html.includes("jsx-wrapper"));
    assert.ok(html.includes("afk-code-grill"));
    assert.ok(!html.includes("&amp;quot;"));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli includes skill profiles in the visualization HTML", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "hyperframes",
          label: "HyperFrames",
          source: "https://github.com/acme/local-kit",
          args: ["--skill", "hyperframes"],
          default: true,
          autoInvocation: true,
          role: "primitive",
        },
        {
          id: "tailwind",
          label: "Tailwind",
          source: "https://github.com/acme/local-kit",
          args: ["--skill", "tailwind"],
          default: true,
          autoInvocation: true,
          role: "primitive",
        },
      ],
    },
    "profiles.json": {
      version: 1,
      alwaysOn: ["tailwind"],
      items: [
        {
          id: "video",
          name: "Video Editing",
          skills: ["hyperframes", "missing-skill"],
        },
      ],
    },
  });
  const stateDir = join(homeDir, ".agents", "afk", "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "skill-profiles.json"), `${JSON.stringify({
    version: 1,
    enabledProfileIds: ["video"],
    profileMovedSkills: ["other-skill"],
    preExistingDisabledSkills: [],
  }, null, 2)}\n`);
  const cwd = mkdtempSync(join(tmpdir(), "afk-visualize-profiles-"));
  const previousCwd = process.cwd();
  const output: string[] = [];

  try {
    process.chdir(cwd);
    const code = await withConsole(output, () => runCli(["show", "skills", "--visualize"], { HOME: homeDir }));
    const html = readFileSync(join(cwd, "afk-skills.html"), "utf8");

    assert.equal(code, 0);
    assert.ok(html.includes("Focus profiles."));
    assert.ok(html.includes("Video Editing"));
    assert.ok(html.includes("video · enabled focus · 2 skills · 1 missing"));
    assert.ok(html.includes("Always-on skills"));
    assert.ok(html.includes("missing-skill missing"));
    assert.ok(html.includes("FocusProfiles"));
    assert.ok(html.includes("SkillProfile"));
    assert.ok(html.includes("ExternalSkill"));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli treats show --visualize as the skills visualization", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
    "skills.json": { version: 1, defaultSource: "", items: [] },
  });
  const cwd = mkdtempSync(join(tmpdir(), "afk-visualize-shortcut-"));
  const previousCwd = process.cwd();
  const output: string[] = [];

  try {
    process.chdir(cwd);
    const code = await withConsole(output, () => runCli(["show", "--visualize"], { HOME: homeDir }));

    assert.equal(code, 0);
    assert.ok(existsSync(join(cwd, "afk-skills.html")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli rejects the skills visualization for non-skill catalogs", async () => {
  const homeDir = localHomeWithManifests({
    "mcps.json": { version: 1, items: [] },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "mcps", "--visualize"], { HOME: homeDir }));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("The skills visualization only supports skills."));
});

test("runCli shows source manifests when source is explicit", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const name = String(input).split("/").pop();
    const manifests: Record<string, unknown> = {
      "skills.json": { version: 1, defaultSource: "", items: [] },
      "mcps.json": { version: 1, items: [] },
    };
    return new Response(JSON.stringify(manifests[name ?? ""] ?? { version: 1, items: [] }), { status: 200 });
  };

  try {
    const homeDir = localHomeWithManifests({
      "presets.json": { version: 1, defaultsSource: "acme/dev-kit", presets: [] },
    });
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(["show", "skill", "mcp", "--source", "acme/dev-kit"], { HOME: homeDir }));
    const text = output.join("\n");

    assert.equal(code, 0);
    assert.ok(requestedUrls.includes("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/skills.json"));
    assert.ok(requestedUrls.includes("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/mcps.json"));
    assert.ok(text.includes("Skills"));
    assert.ok(text.includes("MCPs"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli shows profile catalog summaries", async () => {
  const homeDir = localHomeWithManifests({
    "profiles.json": {
      version: 1,
      mode: "context",
      alwaysOn: ["afk-doc-craft"],
      items: [{ id: "video", name: "Video", skills: ["hyperframes"] }],
    },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "profiles"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("Profiles"));
  assert.ok(text.includes("mode"));
  assert.ok(text.includes("context"));
  assert.ok(text.includes("always-on"));
});

test("runCli shows explicit preset members", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": {
      version: 1,
      defaultsSource: "acme/dev-kit",
      presets: [
        {
          id: "daily-routine",
          label: "Daily Routine",
          areas: ["rules", "skills", "plugins", "agents"],
          all: true,
        },
        {
          id: "afk-architect",
          label: "AFK Architect",
          areas: ["skills", "agents"],
          selections: {
            skills: ["afk-architect"],
            customAgents: ["afk-cartographer", "afk-builder", "afk-pathfinder"],
          },
        },
      ],
    },
  });
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "presets"], { HOME: homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("skills: afk-architect"));
  assert.ok(text.includes("custom agents: afk-cartographer, afk-builder, afk-pathfinder"));
  assert.ok(text.includes("Daily Routine"));
  assert.ok(text.includes("all items in declared areas"));
});

test("isPromptExit detects Inquirer Ctrl-C exits", () => {
  const error = new Error("User force closed the prompt with SIGINT");
  error.name = "ExitPromptError";

  assert.equal(isPromptExit(error), true);
  assert.equal(isPromptExit(new Error("Different failure")), false);
});

async function withConsole(output: string[], fn: () => Promise<number>): Promise<number> {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message?: unknown) => {
    output.push(String(message));
  };
  console.error = (message?: unknown) => {
    output.push(String(message));
  };

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function localHomeWithManifests(manifests: Record<string, unknown>): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-cli-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  for (const [name, content] of Object.entries(manifests)) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }
  return homeDir;
}

function writeSkill(root: string, folder: string, name: string): void {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} description\n---\n\n# ${name}\n`);
}

function emptyCatalogResponse(input: string | URL | Request): Response {
  const name = String(input).split("/").pop();
  const manifests: Record<string, unknown> = {
    "skills.json": { version: 1, defaultSource: "", items: [] },
    "profiles.json": { version: 1, mode: "context", alwaysOn: [], items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "github", url: "https://example.com/AGENTS.md" },
    "plugins.json": { version: 1, items: [] },
    "hooks.json": { version: 1, items: [] },
  };
  return Response.json(manifests[name ?? ""] ?? {});
}
