import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { parsePortableAgentFile, renderClaudeAgent, renderCodexAgent, renderPiAgent, syncCustomAgents } from "./custom-agents.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions, Runtime } from "./types.js";

test("parsePortableAgentFile reads portable metadata and exact harness model pins", () => {
  const agent = parsePortableAgentFile(portableAgent({
    models: { codex: "gpt-5.6-luna", claude: "claude-sonnet-5", pi: "openai/gpt-5.6" },
    effort: { codex: "medium", claude: "high", pi: "medium" },
    nicknames: ["Notion Scout", "Workspace Librarian", "Ledger Keeper"],
    skills: ["notion-cli", "logbook-notion-context"],
    access: "read-only",
    capabilities: { required: ["read", "search"], optional: ["web"] },
  }));

  assert.equal(agent.name, "notion_assistant");
  assert.equal(agent.models.codex, "gpt-5.6-luna");
  assert.equal(agent.models.claude, "claude-sonnet-5");
  assert.equal(agent.models.pi, "openai/gpt-5.6");
  assert.equal(agent.effort.codex, "medium");
  assert.equal(agent.effort.claude, "high");
  assert.equal(agent.effort.pi, "medium");
  assert.deepEqual(agent.nicknames, ["Notion Scout", "Workspace Librarian", "Ledger Keeper"]);
  assert.deepEqual(agent.skills, ["notion-cli", "logbook-notion-context"]);
  assert.equal(agent.access, "read-only");
  assert.deepEqual(agent.capabilities.required, ["read", "search"]);
  assert.deepEqual(agent.capabilities.optional, ["web"]);
});

test("harness renderers omit model settings when no Model Pin is declared", () => {
  const agent = parsePortableAgentFile(portableAgent());

  assert.ok(!renderCodexAgent(agent, "/tmp/skills").includes("model ="));
  assert.ok(!renderClaudeAgent(agent, []).includes("model:"));
  assert.ok(!renderPiAgent(agent, [], "/tmp/skills").includes("model:"));
});

test("Custom Agent skills map to native Codex, Claude, and Pi configuration", () => {
  const agent = parsePortableAgentFile(portableAgent({
    skills: ["notion-cli", "logbook-notion-context"],
  }));
  const skillsRoot = "/tmp/afk-skills";

  const codex = renderCodexAgent(agent, skillsRoot);
  assert.ok(codex.includes(`path = ${JSON.stringify(join(skillsRoot, "notion-cli", "SKILL.md"))}`));
  assert.ok(codex.includes(`path = ${JSON.stringify(join(skillsRoot, "logbook-notion-context", "SKILL.md"))}`));

  const claude = renderClaudeAgent(agent, []);
  assert.match(claude, /skills:\n  - notion-cli\n  - logbook-notion-context/);

  const pi = renderPiAgent(agent, [], skillsRoot);
  assert.match(pi, /skills:\n  - notion-cli\n  - logbook-notion-context/);
  assert.ok(pi.includes(join(skillsRoot, "notion-cli", "SKILL.md")));
  assert.ok(pi.includes(join(skillsRoot, "logbook-notion-context", "SKILL.md")));
});

test("Codex rendering preserves Notion Assistant skill configuration without checking availability", async () => {
  const homeDir = localHome();
  const cwd = mkdtempSync(join(tmpdir(), "afk-notion-agent-"));
  const source = join(cwd, "notion-assistant.md");
  const description = "Notion workspace assistant for Leonardo's Logbook for Devs workspace. Use this agent for Notion research, querying, organization, content migration, datasource routing, page/database updates, and audit ledgers using the Notion CLI.";
  const instructions = "You are Leonardo's Notion Assistant for the Logbook for Devs workspace.\n\nUse the Notion CLI skill and the `ntn` command for Notion work. Prefer direct Notion API reads and datasource queries over browser scraping.";
  writeFileSync(source, portableAgent({
    description,
    instructions,
    models: { codex: "gpt-5.6-luna" },
    effort: { codex: "medium" },
    nicknames: ["Notion Scout", "Workspace Librarian", "Ledger Keeper"],
    skills: ["notion-cli", "logbook-notion-context"],
  }));
  writeAgentCatalog(homeDir, source);

  const code = await syncCustomAgents(runtime([]), options(homeDir, cwd, ["codex"]));
  const generated = readFileSync(join(homeDir, ".codex", "agents", "notion_assistant.toml"), "utf8");

  assert.equal(code, 0);
  assert.ok(generated.includes(`description = ${JSON.stringify(description)}`));
  assert.ok(generated.includes('model = "gpt-5.6-luna"'));
  assert.ok(generated.includes('model_reasoning_effort = "medium"'));
  assert.ok(generated.includes(`developer_instructions = ${JSON.stringify(instructions)}`));
  assert.ok(generated.includes('nickname_candidates = ["Notion Scout", "Workspace Librarian", "Ledger Keeper"]'));
  assert.ok(generated.includes(`path = ${JSON.stringify(join(homeDir, ".agents", "skills", "notion-cli", "SKILL.md"))}`));
  assert.ok(generated.includes(`path = ${JSON.stringify(join(homeDir, ".agents", "skills", "logbook-notion-context", "SKILL.md"))}`));
  assert.equal((generated.match(/\[\[skills\.config\]\]/g) ?? []).length, 2);
});

test("Claude and Pi map portable effort to native fields", () => {
  const agent = parsePortableAgentFile(portableAgent({
    effort: { claude: "high", pi: "medium" },
  }));

  assert.match(renderClaudeAgent(agent, []), /effort: high/);
  assert.match(renderPiAgent(agent, [], "/tmp/skills"), /thinking: medium/);
});

test("syncCustomAgents overwrites native targets and renders per-harness formats", async () => {
  const homeDir = localHome();
  const cwd = mkdtempSync(join(tmpdir(), "afk-agent-project-"));
  const source = join(cwd, "notion-assistant.md");
  writeFileSync(source, portableAgent({
    models: { codex: "gpt-5.6-luna", claude: "claude-sonnet-5", pi: "openai/gpt-5.6" },
    access: "workspace-write",
    capabilities: { required: ["read"], optional: ["write"] },
  }));
  writeAgentCatalog(homeDir, source);
  installPiSubagents(homeDir);

  const codexPath = join(homeDir, ".codex", "agents", "notion_assistant.toml");
  mkdirSync(join(homeDir, ".codex", "agents"), { recursive: true });
  writeFileSync(codexPath, "manual edit that setup should replace\n");

  const output: string[] = [];
  const code = await syncCustomAgents(runtime(output), options(homeDir, cwd, ["codex", "claude", "pi"]));

  assert.equal(code, 0);
  assert.match(readFileSync(codexPath, "utf8"), /model = "gpt-5.6-luna"/);
  assert.ok(!readFileSync(codexPath, "utf8").includes("manual edit"));
  assert.match(readFileSync(join(homeDir, ".claude", "agents", "notion-assistant.md"), "utf8"), /model: claude-sonnet-5/);
  assert.match(readFileSync(join(homeDir, ".pi", "agent", "agents", "notion_assistant.md"), "utf8"), /model: openai\/gpt-5.6/);
  assert.ok(output.some((line) => line.includes("Wrote codex")));
});

test("syncCustomAgents blocks missing required capabilities but reports optional omissions", async () => {
  const homeDir = localHome();
  const cwd = mkdtempSync(join(tmpdir(), "afk-agent-project-"));
  const source = join(cwd, "notion-assistant.md");
  writeFileSync(source, portableAgent({ capabilities: { required: ["browser-control"], optional: ["web"] } }));
  writeAgentCatalog(homeDir, source);
  installPiSubagents(homeDir);

  const output: string[] = [];
  const code = await syncCustomAgents(runtime(output), options(homeDir, cwd, ["pi"]));

  assert.equal(code, 1);
  assert.ok(output.some((line) => line.includes("missing required capabilities: browser-control")));
  assert.equal(existsSync(join(homeDir, ".pi", "agent", "agents", "notion_assistant.md")), false);

  writeFileSync(source, portableAgent({ capabilities: { optional: ["web"] } }));
  output.length = 0;
  const optionalCode = await syncCustomAgents(runtime(output), options(homeDir, cwd, ["pi"]));
  assert.equal(optionalCode, 0);
  assert.ok(output.some((line) => line.includes("Optional capabilities omitted: web")));
});

test("syncCustomAgents suggests pi-subagents and asks the user to rerun setup", async () => {
  const homeDir = localHome();
  const cwd = mkdtempSync(join(tmpdir(), "afk-agent-project-"));
  const source = join(cwd, "notion-assistant.md");
  writeFileSync(source, portableAgent());
  writeAgentCatalog(homeDir, source);

  const output: string[] = [];
  const code = await syncCustomAgents(runtime(output), options(homeDir, cwd, ["pi"]));

  assert.equal(code, 0);
  assert.ok(output.some((line) => line.includes("pi install npm:pi-subagents")));
  assert.ok(output.some((line) => line.includes("Run afk setup agents again")));
});

test("syncCustomAgents writes project-scoped native targets", async () => {
  const homeDir = localHome();
  const cwd = mkdtempSync(join(tmpdir(), "afk-agent-project-"));
  const source = join(cwd, "notion-assistant.md");
  writeFileSync(source, portableAgent());
  writeAgentCatalog(homeDir, source);

  const projectOptions = { ...options(homeDir, cwd, ["codex", "claude"]), setupScope: "project" as const };
  const code = await syncCustomAgents(runtime([]), projectOptions);

  assert.equal(code, 0);
  assert.equal(existsSync(join(cwd, ".codex", "agents", "notion_assistant.toml")), true);
  assert.equal(existsSync(join(cwd, ".claude", "agents", "notion-assistant.md")), true);
});

test("syncCustomAgents reports an unknown explicit catalog id", async () => {
  const homeDir = localHome();
  const output: string[] = [];
  const unknownOptions = options(homeDir, process.cwd(), ["codex"]);
  unknownOptions.selectedCustomAgentIds = ["missing"];
  writeAgentCatalog(homeDir, "/tmp/not-used.md");

  const code = await syncCustomAgents(runtime(output), unknownOptions);

  assert.equal(code, 1);
  assert.ok(output.some((line) => line.includes("Unknown Custom Agent id: missing")));
});

function portableAgent(overrides: {
  description?: string;
  instructions?: string;
  models?: Record<string, string>;
  effort?: Record<string, string>;
  nicknames?: string[];
  skills?: string[];
  access?: string;
  capabilities?: { required?: string[]; optional?: string[] };
} = {}): string {
  const lines = [
    "---",
    "name: notion_assistant",
    `description: ${JSON.stringify(overrides.description ?? "Works with Notion content.")}`,
  ];
  if (overrides.models) {
    lines.push("models:", ...Object.entries(overrides.models).map(([key, value]) => `  ${key}: ${value}`));
  }
  if (overrides.effort) {
    lines.push("effort:", ...Object.entries(overrides.effort).map(([key, value]) => `  ${key}: ${value}`));
  }
  if (overrides.nicknames) {
    lines.push("nicknames:", ...overrides.nicknames.map((value) => `  - ${value}`));
  }
  if (overrides.skills) {
    lines.push("skills:", ...overrides.skills.map((value) => `  - ${value}`));
  }
  if (overrides.access) {
    lines.push(`access: ${overrides.access}`);
  }
  if (overrides.capabilities) {
    lines.push("capabilities:");
    if (overrides.capabilities.required) {
      lines.push("  required:", ...overrides.capabilities.required.map((value) => `    - ${value}`));
    }
    if (overrides.capabilities.optional) {
      lines.push("  optional:", ...overrides.capabilities.optional.map((value) => `    - ${value}`));
    }
  }
  lines.push("---", "", overrides.instructions ?? "Use the Notion CLI and preserve existing content.", "");
  return lines.join("\n");
}

function localHome(): string {
  return mkdtempSync(join(tmpdir(), "afk-agent-home-"));
}

function writeAgentCatalog(homeDir: string, source: string): void {
  const directory = localManifestDir(homeDir);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "agents.json"), `${JSON.stringify({
    version: 1,
    items: [{ id: "notion_assistant", label: "Notion Assistant", source }],
  }, null, 2)}\n`);
}

function installPiSubagents(homeDir: string): void {
  const path = join(homeDir, ".pi", "agent", "settings.json");
  mkdirSync(join(homeDir, ".pi", "agent"), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ packages: ["npm:pi-subagents"] }, null, 2)}\n`);
}

function options(homeDir: string, cwd: string, agents: CliOptions["agents"]): CliOptions {
  return {
    agents,
    setupScope: "global",
    scopeExplicit: true,
    dryRun: false,
    verbose: false,
    yes: true,
    allSkills: false,
    allCustomAgents: false,
    selectedSkillIds: [],
    selectedCustomAgentIds: ["notion_assistant"],
    selectedSkillAgentIds: [],
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false,
    selectedMcpIds: [],
    selectedPluginIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "local",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    defaultsSourceExplicit: false,
    defaultSourceUpdate: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    manifestShowReact: false,
    manifestShowVisualize: false,
    selectedManifestCategories: [],
    homeDir,
    repoDir: cwd,
    cwd,
  };
}

function runtime(output: string[]): Runtime {
  return {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => ({ code: 0 }),
  };
}
