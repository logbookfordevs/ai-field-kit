import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { applyOperation } from "./fs-utils.js";
import { planHooksSync } from "./hooks.js";
import { localManifestDir } from "./manifest.js";

const repoRoot = mkdtempSync(join(tmpdir(), "afk-hook-source-"));
mkdirSync(join(repoRoot, "hooks"));
writeFileSync(join(repoRoot, "hooks", "afk-typescript-typecheck-stop-check.js"), "process.exit(0);\n");

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
  assert.equal(readFileSync(join(homeDir, ".codex", "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"), readFileSync(join(repoRoot, "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"));
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
  assert.equal(readFileSync(join(homeDir, ".codex", "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"), readFileSync(join(repoRoot, "hooks", "afk-typescript-typecheck-stop-check.js"), "utf8"));
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
