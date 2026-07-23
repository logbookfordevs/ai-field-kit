import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  defaultsManifestBaseUrl,
  defaultsManifestBaseUrls,
  ensureLocalManifests,
  loadSourceManifestContents,
  loadPluginManifest,
  localManifestDir,
  planRememberedDefaultsSourceUpdate,
  projectManifestDir,
  readRememberedDefaultsSource,
  type SkillManifest,
} from "./manifest.js";

type PluginManifestFile = {
  items: Array<{
    id: string;
    install: {
      command: string;
      args: string[];
    };
  }>;
};

test("ensureLocalManifests migrates the old Stitch header default", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-manifest-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "mcps.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        items: [
          {
            id: "stitch",
            label: "Stitch MCP",
            source: "https://stitch.googleapis.com/mcp",
            args: ["--header", "X-Goog-Api-Key: KEY_STITCH", "--name", "stitchmcp"],
            default: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const operations = await ensureLocalManifests({
    homeDir,
    repoDir: "/tmp/repo",
    rulesRef: "main",
    rulesSource: "local",
    empty: false,
    refreshDefaults: false,
    manifestLocal: false,
    defaultsSource: "",
    dryRun: false,
  });

  const write = operations.find((operation) => operation.type === "write" && operation.path === manifestPath);
  assert.ok(write && write.type === "write");
  assert.ok(!write.content.includes("X-Goog-Api-Key"));
  assert.ok(write.content.includes("\"--name\""));

  writeFileSync(write.path, write.content);
  const next = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: number; items: Array<{ args: string[] }> };
  assert.equal(next.version, 2);
  assert.deepEqual(next.items[0]?.args, ["--name", "stitchmcp"]);
});

test("ensureLocalManifests migrates existing skills to invocation policy metadata", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-skills-manifest-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "skills.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        defaultSource: "https://github.com/logbookfordevs/ai-field-kit",
        items: [
          {
            id: "afk-note",
            label: "AFK / Note",
            source: "https://github.com/logbookfordevs/ai-field-kit",
            args: ["--skill", "afk-note", "--global"],
            default: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const operations = await ensureLocalManifests({
    homeDir,
    repoDir: "/tmp/repo",
    rulesRef: "main",
    rulesSource: "local",
    empty: false,
    refreshDefaults: false,
    manifestLocal: false,
    defaultsSource: "",
    dryRun: false,
  });

  const write = operations.find((operation) => operation.type === "write" && operation.path === manifestPath);
  assert.ok(write && write.type === "write");
  const next = JSON.parse(write.content) as { items: Array<{ id: string; autoInvocation?: boolean }> };
  assert.equal(next.items.find((item) => item.id === "afk-note")?.autoInvocation, true);
  assert.equal(next.items.some((item) => item.id === "afk-typecheck"), false);
});

test("packaged plugin manifests keep npx installs non-interactive", () => {
  const manifest = JSON.parse(readFileSync(new URL("../catalog/plugins.json", import.meta.url), "utf8")) as PluginManifestFile;
  const interactiveNpxItems = manifest.items
    .filter((item) => usesNpx(item.install.command, item.install.args) && !usesNonInteractiveNpx(item.install.command, item.install.args))
    .map((item) => item.id);

  assert.deepEqual(interactiveNpxItems, []);
});

test("plugin manifests reject shell control tokens outside shell commands", () => {
  assert.throws(
    () => loadPluginManifest({
      homeDir: "/tmp/home",
      manifestContents: {
        "plugins.json": JSON.stringify({
          version: 1,
          items: [
            {
              id: "bad-plugin",
              label: "Bad Plugin",
              description: "Invalid direct shell chaining.",
              install: { command: "npx", args: ["--yes", "bad-plugin", "&&", "npx", "--yes", "bad-plugin", "update"] },
              default: true,
            },
          ],
        }),
      },
    }),
    /Invalid AFK catalog file from setup source: plugins\.json/,
  );

  assert.doesNotThrow(() => loadPluginManifest({
    homeDir: "/tmp/home",
    manifestContents: {
      "plugins.json": JSON.stringify({
        version: 1,
        items: [
          {
            id: "shell-plugin",
            label: "Shell Plugin",
            description: "Valid explicit shell command.",
            install: { command: "sh", args: ["-c", "install-plugin && update-plugin"] },
            default: true,
          },
        ],
      }),
    },
  }));
});

test("defaultsManifestBaseUrl resolves GitHub shorthand to the AFK manifest convention", () => {
  assert.equal(
    defaultsManifestBaseUrl("acme/dev-kit", "main"),
    "https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog",
  );
});

test("defaultsManifestBaseUrls falls back to the package manifest convention", () => {
  assert.deepEqual(
    defaultsManifestBaseUrls("acme/dev-kit", "main"),
    [
      "https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog",
      "https://raw.githubusercontent.com/acme/dev-kit/main/packages/afk/catalog",
    ],
  );
});

test("defaultsManifestBaseUrl preserves GitHub tree paths as manifest directories", () => {
  assert.equal(
    defaultsManifestBaseUrl("https://github.com/acme/dev-kit/tree/v1/custom/manifests", "main"),
    "https://raw.githubusercontent.com/acme/dev-kit/v1/custom/manifests",
  );
});

test("loadSourceManifestContents falls back to a credential-aware GitHub checkout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  const checkoutRoot = mkdtempSync(join(tmpdir(), "afk-private-source-"));
  const catalogDir = join(checkoutRoot, "afk", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(
    join(catalogDir, "skills.json"),
    `${JSON.stringify({
      version: 1,
      defaultSource: "acme/private-kit",
      items: [
        {
          id: "private-skill",
          label: "Private Skill",
          source: "acme/private-kit",
          args: ["--skill", "private-skill"],
          default: true,
        },
      ],
    })}\n`,
  );
  let checkoutCount = 0;
  let cleanupCount = 0;
  let checkoutSource: { cloneUrl: string; ref: string; catalogDirs: string[] } | null = null;

  try {
    const options: Parameters<typeof loadSourceManifestContents>[0] = {
      homeDir: mkdtempSync(join(tmpdir(), "afk-private-home-")),
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github" as const,
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/private-kit",
      defaultsSourceExplicit: true,
      dryRun: true,
      selectedManifestCategories: ["skills" as const],
      cloneGithubSource: async (source) => {
        checkoutCount += 1;
        checkoutSource = source;
        return {
          rootDir: checkoutRoot,
          cleanup: () => {
            cleanupCount += 1;
          },
        };
      },
    };

    const contents = await loadSourceManifestContents(options);
    const skills = JSON.parse(contents["skills.json"] ?? "{}") as SkillManifest;

    assert.equal(skills.items[0]?.id, "private-skill");
    assert.equal(checkoutCount, 1);
    assert.equal(cleanupCount, 1);
    assert.deepEqual(checkoutSource, {
      cloneUrl: "https://github.com/acme/private-kit.git",
      ref: "main",
      catalogDirs: ["afk/catalog", "packages/afk/catalog"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readRememberedDefaultsSource reads global and project-local presets", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-read-defaults-home-"));
  const globalManifestDir = localManifestDir(homeDir);
  mkdirSync(globalManifestDir, { recursive: true });
  writeFileSync(join(globalManifestDir, "presets.json"), `${JSON.stringify({ version: 1, defaultsSource: "acme/global-kit", presets: [] }, null, 2)}\n`);

  const cwd = mkdtempSync(join(tmpdir(), "afk-read-defaults-project-"));
  const localProjectManifestDir = projectManifestDir(cwd);
  mkdirSync(localProjectManifestDir, { recursive: true });
  writeFileSync(join(localProjectManifestDir, "presets.json"), `${JSON.stringify({ version: 1, defaultsSource: "acme/project-kit", presets: [] }, null, 2)}\n`);

  assert.equal(readRememberedDefaultsSource({ homeDir, manifestLocal: false }), "acme/global-kit");
  assert.equal(readRememberedDefaultsSource({ homeDir, cwd, manifestLocal: true }), "acme/project-kit");
});

test("planRememberedDefaultsSourceUpdate creates and preserves presets manifest shape", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-save-defaults-"));
  const operations = planRememberedDefaultsSourceUpdate({ homeDir, manifestLocal: false }, "acme/dev-kit");
  const manifestDir = localManifestDir(homeDir);
  const write = operations.find((operation) => operation.type === "write" && operation.path === join(manifestDir, "presets.json"));

  assert.ok(operations.some((operation) => operation.type === "mkdir" && operation.path === manifestDir));
  assert.ok(write && write.type === "write");
  assert.deepEqual(JSON.parse(write.content), { version: 1, defaultsSource: "acme/dev-kit", presets: [] });

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "presets.json"),
    `${JSON.stringify({ version: 2, defaultsSource: "old/source", presets: [{ id: "all", label: "All", areas: ["rules"] }] }, null, 2)}\n`,
  );

  const updateOperations = planRememberedDefaultsSourceUpdate({ homeDir, manifestLocal: false }, "acme/next-kit");
  const updateWrite = updateOperations.find((operation) => operation.type === "write" && operation.path === join(manifestDir, "presets.json"));
  assert.ok(updateWrite && updateWrite.type === "write");
  assert.deepEqual(JSON.parse(updateWrite.content), {
    version: 2,
    defaultsSource: "acme/next-kit",
    presets: [{ id: "all", label: "All", areas: ["rules"] }],
  });
});

test("ensureLocalManifests can refresh defaults from a custom source", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const hookManifest = JSON.stringify({ version: 1, items: [] });
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": hookManifest,
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-custom-defaults-"));
    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("skills.json")));
    assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("profiles.json")));
    const presetsWrite = operations.find((operation) => operation.type === "write" && operation.path.endsWith("presets.json"));
    assert.ok(presetsWrite && presetsWrite.type === "write");
    assert.ok(presetsWrite.content.includes("\"defaultsSource\": \"acme/dev-kit\""));
    assert.ok(requestedUrls.every((url) => url.startsWith("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/")));
    assert.ok(requestedUrls.some((url) => url.endsWith("/rules.json")));
    assert.ok(requestedUrls.some((url) => url.endsWith("/profiles.json")));
    assert.ok(requestedUrls.some((url) => url.endsWith("/hooks.json")));
    assert.ok(!requestedUrls.some((url) => url.endsWith("/workflows.json")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests reuses remembered defaults source during refresh", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const hookManifest = JSON.stringify({ version: 1, items: [] });
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": hookManifest,
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-remembered-defaults-"));
    const manifestDir = localManifestDir(homeDir);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "presets.json"), `${JSON.stringify({ version: 1, defaultsSource: "acme/dev-kit", presets: [] }, null, 2)}\n`);

    await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "",
      dryRun: true,
    });

    assert.ok(requestedUrls.every((url) => url.startsWith("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests can refresh project-local catalog", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": JSON.stringify({ version: 1, items: [] }),
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const cwd = mkdtempSync(join(tmpdir(), "afk-project-defaults-"));
    const manifestDir = projectManifestDir(cwd);
    const operations = await ensureLocalManifests({
      homeDir: "/tmp/home",
      repoDir: "/tmp/repo",
      cwd,
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: true,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    assert.ok(operations.some((operation) => operation.type === "mkdir" && operation.path === manifestDir));
    assert.ok(operations.some((operation) => operation.type === "write" && operation.path === join(manifestDir, "skills.json")));
    assert.ok(operations.some((operation) => operation.type === "write" && operation.path === join(manifestDir, "profiles.json")));
    assert.ok(requestedUrls.every((url) => url.startsWith("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests preserves imported skills that are absent from refreshed source", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "source-skill",
            label: "Source Skill",
            source: "acme/dev-kit",
            args: ["--skill", "source-skill"],
            default: true,
          },
        ],
      }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": JSON.stringify({ version: 1, items: [] }),
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-preserve-imported-"));
    const manifestDir = localManifestDir(homeDir);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "skills.json"),
      `${JSON.stringify({
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "local-skill",
            label: "Local Skill",
            source: "acme/local-kit",
            args: ["--skill", "local-skill"],
            default: false,
            imported: true,
          },
        ],
      }, null, 2)}\n`,
    );

    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    const skillsWrite = operations.find((operation) => operation.type === "write" && operation.path.endsWith("skills.json"));
    assert.ok(skillsWrite && skillsWrite.type === "write");
    const next = JSON.parse(skillsWrite.content) as SkillManifest;
    assert.equal(next.items.find((item) => item.id === "source-skill")?.imported, false);
    assert.equal(next.items.find((item) => item.id === "local-skill")?.imported, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests preserves local profiles absent from refreshed source", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "profiles.json": JSON.stringify({
        version: 2,
        mode: "context",
        alwaysOn: ["source-always"],
        items: [{ id: "source", name: "Fresh Source", skills: ["source-skill"] }],
      }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://example.com/rules" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": JSON.stringify({ version: 1, items: [] }),
    };
    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-preserve-profiles-"));
    const manifestDir = localManifestDir(homeDir);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(manifestDir, "profiles.json"), `${JSON.stringify({
      version: 1,
      mode: "strict",
      alwaysOn: ["local-always"],
      items: [
        { id: "source", name: "Stale Source", skills: ["old-skill"] },
        { id: "local", name: "Local", skills: ["local-skill"] },
      ],
    }, null, 2)}\n`);

    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    const profilesWrite = operations.find((operation) => operation.type === "write" && operation.path.endsWith("profiles.json"));
    assert.ok(profilesWrite && profilesWrite.type === "write");
    const next = JSON.parse(profilesWrite.content) as {
      version: number;
      mode: string;
      alwaysOn: string[];
      items: Array<{ id: string; name: string; skills: string[] }>;
    };
    assert.equal(next.version, 2);
    assert.equal(next.mode, "context");
    assert.deepEqual(next.alwaysOn, ["source-always"]);
    assert.deepEqual(next.items, [
      { id: "source", name: "Fresh Source", skills: ["source-skill"] },
      { id: "local", name: "Local", skills: ["local-skill"] },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests turns imported skills into source skills when refreshed source includes them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "local-skill",
            label: "Upstream Local Skill",
            source: "acme/dev-kit",
            args: ["--skill", "local-skill"],
            default: true,
          },
        ],
      }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": JSON.stringify({ version: 1, items: [] }),
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-adopt-imported-"));
    const manifestDir = localManifestDir(homeDir);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "skills.json"),
      `${JSON.stringify({
        version: 1,
        defaultSource: "",
        items: [
          {
            id: "local-skill",
            label: "Local Skill",
            source: "acme/local-kit",
            args: ["--skill", "local-skill"],
            default: false,
            imported: true,
          },
        ],
      }, null, 2)}\n`,
    );

    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    const skillsWrite = operations.find((operation) => operation.type === "write" && operation.path.endsWith("skills.json"));
    assert.ok(skillsWrite && skillsWrite.type === "write");
    const next = JSON.parse(skillsWrite.content) as SkillManifest;
    assert.equal(next.items.length, 1);
    assert.equal(next.items[0]?.id, "local-skill");
    assert.equal(next.items[0]?.label, "Upstream Local Skill");
    assert.equal(next.items[0]?.imported, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests falls back to remote package manifest convention when compact manifests are missing", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const hookManifest = JSON.stringify({ version: 1, items: [] });
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("/main/afk/catalog/")) {
      return new Response("missing", { status: 404 });
    }

    const name = url.split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "profiles.json": JSON.stringify({ version: 1, mode: "context", alwaysOn: [], items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "plugins.json": JSON.stringify({ version: 1, items: [] }),
      "hooks.json": hookManifest,
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-fallback-defaults-"));
    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("plugins.json")));
    assert.ok(requestedUrls.some((url) => url.includes("/afk/catalog/skills.json")));
    assert.ok(requestedUrls.some((url) => url.includes("/packages/afk/catalog/skills.json")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests keeps existing files when a custom source omits a manifest", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 404 });

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-partial-defaults-"));
    const manifestDir = localManifestDir(homeDir);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "plugins.json"),
      `${JSON.stringify(
        {
          version: 1,
          items: [
            {
              id: "keep-me",
              label: "Keep Me",
              description: "Keep existing plugin manifest.",
              install: { command: "sh", args: ["-c", "keep-me"] },
              default: true,
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      manifestLocal: false,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
      cloneGithubSource: emptyGithubCheckout,
    });

    const pluginOperation = operations.find((operation) => "path" in operation && operation.path.endsWith("plugins.json"));
    assert.equal(pluginOperation?.type, "skip");
    assert.equal(readFileSync(join(manifestDir, "plugins.json"), "utf8").includes("keep-me"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function usesNpx(command: string, args: string[]): boolean {
  return command === "npx" || commandLineIncludesNpx([command, ...args].join(" "));
}

function usesNonInteractiveNpx(command: string, args: string[]): boolean {
  if (command === "npx") {
    return args[0] === "--yes" || args[0] === "-y";
  }

  return /(^|[\s;&|()])npx\s+(--yes|-y)(\s|$)/.test([command, ...args].join(" "));
}

function commandLineIncludesNpx(commandLine: string): boolean {
  return /(^|[\s;&|()])npx(\s|$)/.test(commandLine);
}

async function emptyGithubCheckout(): Promise<{ rootDir: string; cleanup: () => void }> {
  const rootDir = mkdtempSync(join(tmpdir(), "afk-empty-source-"));
  return {
    rootDir,
    cleanup: () => {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}
