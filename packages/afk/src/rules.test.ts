import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { planRulesSync } from "./rules.js";

test("planRulesSync injects AFK rules into the selected global agent file", () => {
  const operations = planRulesSync(
    {
      agents: ["codex"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "# AFK\n",
    },
  );

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.codex/AGENTS.md"));
  assert.ok(!operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.agents/AFK.md"));
  assert.ok(!operations.some((operation) => operation.type === "symlink"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.codex/AGENTS.md" && operation.content.includes("<!-- AFK:RULES:START -->")));
  assert.ok(!operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.claude/CLAUDE.md"));
});

test("planRulesSync strips markdown imports from the managed rules region", () => {
  const operations = planRulesSync(
    {
      agents: ["codex"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "# AFK\n\n@AFK_WORKFLOW.md\n@RTK.md\n",
    },
  );

  const write = operations.find((operation) => operation.type === "write" && operation.path === "/tmp/home/.codex/AGENTS.md");
  assert.ok(write && write.type === "write");
  assert.ok(!write.content.includes("@AFK_WORKFLOW.md"));
  assert.ok(!write.content.includes("@RTK.md"));
});

test("planRulesSync does not write broad default rule hosts when no agent is selected", () => {
  const operations = planRulesSync(
    {
      agents: [],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "# AFK\n",
    },
  );

  assert.deepEqual(operations, []);
});

test("planRulesSync converts an existing global rules symlink into a real merged file", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-rules-"));
  try {
    const homeDir = join(root, "home");
    const sharedDir = join(homeDir, ".agents");
    const codexDir = join(homeDir, ".codex");
    const sharedRules = join(sharedDir, "AGENTS.md");
    const codexRules = join(codexDir, "AGENTS.md");

    mkdirSync(sharedDir, { recursive: true });
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(sharedRules, "Codex-only note\n");
    symlinkSync(sharedRules, codexRules);

    const operations = planRulesSync(
      {
        agents: ["codex"],
        homeDir,
        cwd: join(root, "project"),
        setupScope: "global",
      },
      {
        afk: "# AFK\n",
      },
    );

    const write = operations.find((operation) => operation.type === "write" && operation.path === codexRules);
    assert.ok(operations.some((operation) => operation.type === "remove" && operation.path === codexRules));
    assert.ok(write && write.type === "write");
    assert.ok(write.content.includes("# AFK"));
    assert.ok(write.content.includes("Codex-only note"));
    assert.ok(!operations.some((operation) => operation.type === "symlink"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("planRulesSync includes Claude-specific host when Claude is selected", () => {
  const operations = planRulesSync(
    {
      agents: ["claude"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "# AFK\n",
    },
  );

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.claude/CLAUDE.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.claude/CLAUDE.md" && operation.content.includes("<!-- AFK:RULES:START -->")));
});

test("planRulesSync includes Pi-specific host when Pi is selected", () => {
  const operations = planRulesSync(
    {
      agents: ["pi"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "# AFK\n",
    },
  );

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.pi/agent/AGENTS.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.pi/agent/AGENTS.md" && operation.content.includes("<!-- AFK:RULES:START -->")));
});

test("planRulesSync writes project rule hosts for project scope", () => {
  const operations = planRulesSync(
    {
      agents: ["antigravity", "claude", "codex", "opencode", "pi"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "project",
    },
    {
      afk: "# AFK\n",
    },
  );

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/project/AGENTS.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/project/CLAUDE.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/project/GEMINI.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/project/.pi/agent/AGENTS.md"));
  assert.equal(operations.filter((operation) => operation.type === "write" && operation.path === "/tmp/project/AGENTS.md").length, 1);
  assert.ok(!operations.some((operation) => operation.type === "symlink"));
});
