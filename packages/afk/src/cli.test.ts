import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  assert.ok(output.join("\n").includes("afk refresh [category...] [options]"));
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes("afk setup mcps [options]"));
  assert.ok(output.join("\n").includes("afk setup plugins [options]"));
  assert.ok(output.join("\n").includes("afk setup hooks [options]"));
  assert.ok(output.join("\n").includes("afk ui <command> [options]"));
  assert.ok(output.join("\n").includes("afk catalog import [options]"));
  assert.ok(!output.join("\n").includes("afk setup utils"));
  assert.ok(output.join("\n").includes("afk show [category...] [options]"));
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

test("runCli prints contextual refresh help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["refresh", "skills", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK refresh"));
  assert.ok(output.join("\n").includes("afk refresh skills"));
  assert.ok(output.join("\n").includes("Refresh cached AFK catalog"));
  assert.ok(output.join("\n").includes("Use refresh when you want the local catalog cache to change."));
  assert.ok(!output.join("\n").includes("--refresh-defaults"));
});

test("runCli prints contextual catalog import help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["catalog", "import", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK catalog import"));
  assert.ok(text.includes("afk catalog import --local"));
  assert.ok(text.includes("Backfill missing skills catalog entries"));
  assert.ok(text.includes("original source can be recovered"));
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
  assert.ok(text.includes("Use this when you want AFK to prepare agent-facing surfaces"));
  assert.ok(text.includes("Subcommands:"));
  assert.ok(!text.includes("afk setup refresh"));
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
  assert.ok(text.includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(text.includes("--verbose                         Show delegated installer output"));
  assert.ok(text.includes("--yes, -y                         Accept defaults and skip prompts"));
  assert.ok(text.includes("--agent <agent>                   Override detected targets; repeatable"));
  assert.ok(!text.includes("--default-source <source>"));
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
  globalThis.fetch = async () => new Response("missing", { status: 404 });
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
    return new Response("missing", { status: 404 });
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
  assert.ok(output.join("\n").includes("Use afk show to inspect the local catalog, or afk show --source <source> to inspect a source directly."));
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

test("runCli prints contextual skills delete help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "delete", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills delete"));
  assert.ok(text.includes("--manifest-only"));
});

test("runCli prints contextual skills profiles help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "profiles", "enable", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK skills profiles"));
  assert.ok(text.includes("enable <profile>"));
  assert.ok(text.includes("--local"));
  assert.ok(text.includes("--always-on <skill>"));
});

test("runCli creates local skill profiles with repeated skill flags", async () => {
  const homeDir = localHomeWithManifests({});
  const cwd = mkdtempSync(join(tmpdir(), "afk-cli-profile-project-"));
  const output: string[] = [];
  const originalCwd = process.cwd();
  process.chdir(cwd);

  try {
    const code = await withConsole(output, () => runCli(
      [
        "skills",
        "profiles",
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
      ],
      { HOME: homeDir, AI_RULES_REPO: resolve(new URL("../../..", import.meta.url).pathname) },
    ));

    assert.equal(code, 0);
    assert.ok(output.join("\n").includes("Profile Create Complete"));
    const catalog = JSON.parse(readFileSync(join(cwd, "afk", "catalog", "profiles.json"), "utf8")) as {
      alwaysOn: string[];
      items: Array<{ id: string; name: string; skills: string[] }>;
    };
    assert.deepEqual(catalog.alwaysOn, ["afk-compass"]);
    assert.deepEqual(catalog.items, [{ id: "video", name: "Video", skills: ["hyperframes", "tailwind"] }]);
  } finally {
    process.chdir(originalCwd);
  }
});

test("runCli accepts skills delete manifest-only flag", async () => {
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
    ["skills", "delete", "beta", "--manifest-only", "--dry-run"],
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
            profiles: ["engineering"],
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
    assert.ok(html.includes("video · enabled · 2 skills · 1 missing"));
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
