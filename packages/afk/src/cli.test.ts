import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";
import { isPromptExit, runCli } from "./cli.js";
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
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes("afk setup refresh [options]"));
  assert.ok(output.join("\n").includes("afk setup mcps [options]"));
  assert.ok(output.join("\n").includes("afk setup plugins [options]"));
  assert.ok(output.join("\n").includes("afk setup hooks [options]"));
  assert.ok(output.join("\n").includes("afk ui <command> [options]"));
  assert.ok(!output.join("\n").includes("afk setup utils"));
  assert.ok(output.join("\n").includes("afk show [options]"));
  assert.ok(!output.join("\n").includes("afk configure [options]"));
  assert.ok(!output.join("\n").includes("afk manifests configure [options]"));
  assert.ok(!output.join("\n").includes("afk manifests show [options]"));
  assert.ok(!output.join("\n").includes("afk setup mcps install [options]"));
  assert.ok(output.join("\n").includes("afk --version"));
  assert.ok(output.join("\n").includes('Run "afk <command> --help"'));
});

test("runCli keeps plain afk as help in non-interactive output", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli([]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk setup [options]"));
});

test("runCli prints contextual setup refresh help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "refresh", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup refresh"));
  assert.ok(output.join("\n").includes("afk setup refresh --local"));
  assert.ok(output.join("\n").includes("Refresh ./afk/manifests"));
  assert.ok(!output.join("\n").includes("--refresh-defaults"));
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
  assert.ok(text.includes("Subcommands:"));
  assert.ok(text.includes("afk setup refresh"));
  assert.ok(text.includes("afk setup mcps"));
  assert.ok(text.includes("afk setup plugins"));
  assert.ok(text.includes("afk setup hooks"));
  assert.ok(!text.includes("afk setup utils"));
  assert.ok(text.includes("--verbose"));
  assert.ok(!text.includes("afk setup mcps install"));
  assert.ok(text.includes("--default-source <source>"));
  assert.ok(text.includes("--all"));
  assert.ok(text.includes("afk setup --default-source your-org/dev-kit"));
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
  assert.ok(text.includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(text.includes("--verbose                         Show delegated installer output"));
  assert.ok(text.includes("--yes, -y                         Accept defaults and skip prompts"));
  assert.ok(text.includes("--agent <agent>                   Override detected targets; repeatable"));
  assert.ok(text.includes("--default-source <source>         Save a default setup source and exit"));
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

test("runCli accepts default-source aliases", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-default-source-alias-"));
  const repoDir = resolve(new URL("../../..", import.meta.url).pathname);

  const output: string[] = [];
  const code = await withConsole(output, () => runCli(
    ["setup", "--default-source", "acme/dev-kit"],
    { HOME: homeDir, AI_RULES_REPO: repoDir },
  ));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Default setup source updated to acme/dev-kit"));

  output.length = 0;
  const aliasCode = await withConsole(output, () => runCli(
    ["setup", "--defaults-source", "acme/legacy-kit"],
    { HOME: homeDir, AI_RULES_REPO: repoDir },
  ));

  assert.equal(aliasCode, 0);
  assert.ok(output.join("\n").includes("Default setup source updated to acme/legacy-kit"));
});

test("runCli keeps --source github mapped to the built-in AFK defaults source", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response("missing", { status: 404 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-source-github-"));
    const output: string[] = [];
    const code = await withConsole(output, () => runCli(
      ["setup", "refresh", "--dry-run", "--source", "github"],
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
  assert.ok(text.includes("--agent claude-code"));
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

test("runCli explains configure is not available for source-backed setup yet", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["configure"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("AFK configure is not available for source-backed setup yet."));
  assert.ok(output.join("\n").includes("Use afk show to inspect the active setup source."));
  assert.ok(!output.join("\n").includes("afk configure --local"));
});

test("runCli explains configure retirement instead of showing command help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "configure", "--help"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("AFK configure is not available for source-backed setup yet."));
  assert.ok(!output.join("\n").includes("Usage:\n  afk configure"));
});

test("runCli prints contextual skills help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "list", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK skills list"));
  assert.ok(output.join("\n").includes("--scope global|project|all"));
  assert.ok(output.join("\n").includes("--category <id-or-label>"));
  assert.ok(!output.join("\n").includes("AFK setup skills install"));
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
});

test("runCli prints contextual skills upgrade help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "upgrade", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills upgrade"));
  assert.ok(text.includes("--scope global|project|all"));
  assert.ok(text.includes("--all"));
  assert.ok(!text.includes("AFK skills check"));
});

test("runCli prints contextual skills trash help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "trash", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills trash"));
  assert.ok(text.includes("--manifest-only"));
});

test("runCli accepts skills trash manifest-only flag", async () => {
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
    ["skills", "trash", "beta", "--manifest-only", "--dry-run"],
    { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
  ));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Skill not found in skills.json manifest: beta"));
});

test("runCli validates skills upgrade scope", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "upgrade", "--scope", "agent"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --scope value: agent"));
});

test("runCli validates skills open app", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "open", "demo", "--app", "vim"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --app value: vim"));
});

test("runCli validates skills agent metadata", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "rename", "demo", "Demo", "--agent-metadata", "claude"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --agent-metadata value: claude"));
});

test("runCli validates skills categorize runner", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "categorize", "--runner", "sdk"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --runner value: sdk"));
});

test("runCli prints contextual manifest show help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["show", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK show"));
  assert.ok(output.join("\n").includes("--local"));
  assert.ok(output.join("\n").includes("--rules"));
  assert.ok(output.join("\n").includes("--hooks"));
  assert.ok(output.join("\n").includes("afk show --rules --skills"));
  assert.ok(!output.join("\n").includes("afk manifests show --rules --skills"));
  assert.ok(!output.join("\n").includes("AFK setup\n"));
});

test("runCli keeps old manifest command forms as aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "show", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK show"));
  assert.ok(text.includes("Usage:\n  afk show [options]"));
});

test("runCli shows manifests from the remembered setup source", async () => {
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
    const code = await withConsole(output, () => runCli(["show", "--skills"], { HOME: homeDir }));
    const text = output.join("\n");

    assert.equal(code, 0);
    assert.ok(requestedUrls.includes("https://raw.githubusercontent.com/acme/dev-kit/main/afk/manifests/skills.json"));
    assert.ok(text.includes("AFK manifests"));
    assert.ok(text.includes("Source"));
    assert.ok(text.includes("remote-skill"));
    assert.ok(!text.includes("local-skill"));
  } finally {
    globalThis.fetch = originalFetch;
  }
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
