import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { applyOperation } from "./fs-utils.js";
import { planHooksSync } from "./hooks.js";
import { localManifestDir } from "./manifest.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("planHooksSync installs hook source and merges Codex Stop hook into existing hooks.json", async () => {
  const homeDir = prepareHome();
  const codexConfig = join(homeDir, ".codex", "hooks.json");
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(
    codexConfig,
    `${JSON.stringify(
      {
        hooks: {
          Stop: [
            {
              matcher: "",
              hooks: [{ type: "command", command: "node existing.js" }],
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );

  const operations = await planHooksSync({
    agents: ["codex"],
    homeDir,
    cwd: "/tmp/project",
    repoDir: repoRoot,
    selectedHookIds: ["afk-typescript-typecheck-stop-check"],
    setupScope: "global",
  });

  for (const operation of operations) {
    applyOperation(operation);
  }

  const next = JSON.parse(readFileSync(codexConfig, "utf8")) as {
    hooks: { Stop: Array<{ matcher: string; hooks: Array<{ command: string }> }> };
  };
  const commands = next.hooks.Stop.flatMap((entry) => entry.hooks.map((hook) => hook.command));
  assert.ok(commands.includes("node existing.js"));
  assert.equal(commands.filter((command) => command.includes("afk-typescript-typecheck-stop-check.js")).length, 1);
  assert.match(readFileSync(join(homeDir, ".codex", "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"), /TypeScript files changed/);
});

test("planHooksSync installs the TypeScript typecheck hook with a matching status message", async () => {
  const homeDir = prepareHome({
    id: "afk-typescript-typecheck-stop-check",
    label: "AFK / TypeScript Typecheck Stop Check",
    source: "hooks/afk-typescript-typecheck-stop-check.js",
  });

  const operations = await planHooksSync({
    agents: ["codex"],
    homeDir,
    cwd: "/tmp/project",
    repoDir: repoRoot,
    selectedHookIds: ["afk-typescript-typecheck-stop-check"],
    setupScope: "global",
  });

  for (const operation of operations) {
    applyOperation(operation);
  }

  const next = JSON.parse(readFileSync(join(homeDir, ".codex", "hooks.json"), "utf8")) as {
    hooks: { Stop: Array<{ matcher: string; hooks: Array<{ command: string; statusMessage: string }> }> };
  };
  const hooks = next.hooks.Stop.flatMap((entry) => entry.hooks);
  const typecheckHook = hooks.find((hook) => hook.command.includes("afk-typescript-typecheck-stop-check.js"));
  assert.ok(typecheckHook);
  assert.equal(typecheckHook.statusMessage, "AFK / TypeScript Typecheck Stop Check");
  assert.match(readFileSync(join(homeDir, ".codex", "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"), /TypeScript files changed/);
});

test("planHooksSync updates the AFK hook without duplicating Cursor hooks", async () => {
  const homeDir = prepareHome();
  const cursorConfig = join(homeDir, ".cursor", "hooks.json");
  mkdirSync(join(homeDir, ".cursor"), { recursive: true });
  writeFileSync(
    cursorConfig,
    `${JSON.stringify(
      {
        version: 1,
        hooks: {
          stop: [
            { command: "python .cursor/hooks/keep.py" },
            { command: "node \"/old/path/afk-typescript-typecheck-stop-check.js\" --agent cursor-local" },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );

  const operations = await planHooksSync({
    agents: ["cursor-local"],
    homeDir,
    cwd: "/tmp/project",
    repoDir: repoRoot,
    selectedHookIds: ["afk-typescript-typecheck-stop-check"],
    setupScope: "global",
  });

  for (const operation of operations) {
    applyOperation(operation);
  }

  const next = JSON.parse(readFileSync(cursorConfig, "utf8")) as { hooks: { stop: Array<{ command: string }> } };
  assert.ok(next.hooks.stop.some((hook) => hook.command === "python .cursor/hooks/keep.py"));
  assert.equal(next.hooks.stop.filter((hook) => hook.command.includes("afk-typescript-typecheck-stop-check.js")).length, 1);
});

test("planHooksSync preserves empty hook target selection as a no-op", async () => {
  const homeDir = prepareHome();

  const operations = await planHooksSync({
    agents: [],
    homeDir,
    cwd: "/tmp/project",
    repoDir: repoRoot,
    selectedHookIds: ["afk-typescript-typecheck-stop-check"],
    setupScope: "global",
  });

  assert.deepEqual(operations, []);
});

test("planHooksSync removes previous managed hooks by installed filename", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://example.com/hooks/company-stop.mjs");
    return new Response("#!/usr/bin/env node\nconsole.log('company hook');\n", { status: 200 });
  };

  try {
    const homeDir = prepareHome({
      id: "company-stop-check",
      source: "https://example.com/hooks/company-stop.mjs",
      agents: ["codex"],
    });
    const codexConfig = join(homeDir, ".codex", "hooks.json");
    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexConfig,
      `${JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                matcher: "",
                hooks: [
                  { type: "command", command: "node keep.js" },
                  { type: "command", command: "node \"/old/global/.codex/hooks/company-stop.mjs\" --agent codex" },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
    );

    const operations = await planHooksSync({
      agents: ["codex"],
      homeDir,
      cwd: "/tmp/project",
      repoDir: "/tmp/repo",
      selectedHookIds: ["company-stop-check"],
      setupScope: "global",
    });

    for (const operation of operations) {
      applyOperation(operation);
    }

    const next = JSON.parse(readFileSync(codexConfig, "utf8")) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = next.hooks.Stop.flatMap((entry) => entry.hooks.map((hook) => hook.command));
    assert.ok(commands.includes("node keep.js"));
    assert.equal(commands.filter((command) => command.includes("company-stop.mjs")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("planHooksSync can install hook source from a remote manifest URL", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://example.com/hooks/company-stop-check.js");
    return new Response("#!/usr/bin/env node\nconsole.log('company hook');\n", { status: 200 });
  };

  try {
    const homeDir = prepareHome({
      id: "company-stop-check",
      source: "https://example.com/hooks/company-stop-check.js",
      agents: ["codex"],
    });

    const operations = await planHooksSync({
      agents: ["codex"],
      homeDir,
      cwd: "/tmp/project",
      repoDir: "/tmp/repo",
      selectedHookIds: ["company-stop-check"],
      setupScope: "global",
    });

    for (const operation of operations) {
      applyOperation(operation);
    }

    assert.equal(readFileSync(join(homeDir, ".codex", "hooks", "company-stop-check.js"), "utf8"), "#!/usr/bin/env node\nconsole.log('company hook');\n");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TypeScript typecheck hook allows when no TypeScript files changed", () => {
  const repo = prepareGitRepo();
  writeFileSync(join(repo, "README.md"), "# Demo\n");

  const result = runTypecheckHook(repo);

  assert.equal(result.continue, true);
});

test("TypeScript typecheck hook blocks when TypeScript changed without a typecheck command", () => {
  const repo = prepareGitRepo();
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "index.ts"), "export const value = 1;\n");

  const result = runTypecheckHook(repo);

  assert.equal(result.decision, "block");
  assert.match(String(result.reason), /no typecheck command was found/);
});

test("TypeScript typecheck hook runs nearest package typecheck and caches a passing signature", () => {
  const repo = prepareGitRepo();
  const packageDir = join(repo, "packages", "demo");
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(join(packageDir, "package.json"), `${JSON.stringify({ scripts: { typecheck: "node check.js" } }, null, 2)}\n`);
  writeFileSync(join(packageDir, "check.js"), "process.exit(0);\n");
  writeFileSync(join(packageDir, "src", "index.ts"), "export const value = 1;\n");

  const first = runTypecheckHook(repo);
  writeFileSync(join(packageDir, "check.js"), "process.exit(1);\n");
  const second = runTypecheckHook(repo);

  assert.equal(first.continue, true);
  assert.equal(second.continue, true);
});

test("TypeScript typecheck hook blocks with command output when typecheck fails", () => {
  const repo = prepareGitRepo();
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "package.json"), `${JSON.stringify({ scripts: { typecheck: "node check.js" } }, null, 2)}\n`);
  writeFileSync(join(repo, "check.js"), "console.error('typecheck exploded'); process.exit(1);\n");
  writeFileSync(join(repo, "src", "index.ts"), "export const value = 1;\n");

  const result = runTypecheckHook(repo);

  assert.equal(result.decision, "block");
  assert.match(String(result.reason), /npm run typecheck/);
  assert.match(String(result.reason), /typecheck exploded/);
});

function prepareHome(overrides: Partial<{ id: string; label: string; source: string; agents: string[] }> = {}): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-hooks-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "hooks.json"),
    `${JSON.stringify(
      {
        version: 1,
        items: [
          {
            id: overrides.id ?? "afk-typescript-typecheck-stop-check",
            label: overrides.label ?? "AFK / TypeScript Typecheck Stop Check",
            description: "Nudge the agent once before final handoff.",
            source: overrides.source ?? "hooks/afk-typescript-typecheck-stop-check.js",
            command: "node",
            args: ["${HOOK_FILE}"],
            events: ["stop"],
            agents: overrides.agents ?? ["codex", "claude", "cursor-local"],
            default: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return homeDir;
}

function prepareGitRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "afk-hook-repo-"));
  git(repo, ["init"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test User"]);
  return repo;
}

function runTypecheckHook(cwd: string): { continue?: boolean; decision?: string; reason?: string } {
  const scriptPath = join(repoRoot, "hooks", "afk-typescript-typecheck-stop-check.js");
  const output = execFileSync("node", [scriptPath], {
    cwd,
    input: JSON.stringify({ cwd }),
    encoding: "utf8",
  });
  return JSON.parse(output) as { continue?: boolean; decision?: string; reason?: string };
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}
