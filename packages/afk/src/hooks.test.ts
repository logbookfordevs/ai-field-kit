import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyOperation } from "./fs-utils.js";
import { planHooksSync } from "./hooks.js";
import { localManifestDir } from "./manifest.js";

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
    repoDir: "/Users/leonardo/codes/ai-rules-workflows",
    selectedHookIds: ["afk-execution-tracking-stop-check"],
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
  assert.equal(commands.filter((command) => command.includes("afk-execution-tracking-stop-check.js")).length, 1);
  assert.match(readFileSync(join(homeDir, ".codex", "hooks", "afk-execution-tracking-stop-check.js"), "utf8"), /Implementation files changed/);
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
            { command: "node \"/old/path/afk-execution-tracking-stop-check.js\" --agent cursor-local" },
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
    repoDir: "/Users/leonardo/codes/ai-rules-workflows",
    selectedHookIds: ["afk-execution-tracking-stop-check"],
    setupScope: "global",
  });

  for (const operation of operations) {
    applyOperation(operation);
  }

  const next = JSON.parse(readFileSync(cursorConfig, "utf8")) as { hooks: { stop: Array<{ command: string }> } };
  assert.ok(next.hooks.stop.some((hook) => hook.command === "python .cursor/hooks/keep.py"));
  assert.equal(next.hooks.stop.filter((hook) => hook.command.includes("afk-execution-tracking-stop-check.js")).length, 1);
  assert.ok(next.hooks.stop.some((hook) => hook.command.includes("--agent cursor-local")));
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

function prepareHome(overrides: Partial<{ id: string; source: string; agents: string[] }> = {}): string {
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
            id: overrides.id ?? "afk-execution-tracking-stop-check",
            label: "AFK / Execution Tracking Stop Check",
            description: "Nudge the agent once before final handoff.",
            source: overrides.source ?? "hooks/afk-execution-tracking-stop-check.js",
            command: "node",
            args: ["${HOOK_FILE}", "--agent", "${AGENT}"],
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
