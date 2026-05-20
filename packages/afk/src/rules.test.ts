import assert from "node:assert/strict";
import test from "node:test";
import { planRulesSync } from "./rules.js";

test("planRulesSync injects AFK rules into the shared host file", () => {
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

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.agents/AGENTS.md"));
  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target === "/tmp/home/.codex/AGENTS.md" && operation.source === "/tmp/home/.agents/AGENTS.md"));
  assert.ok(!operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.agents/AFK.md"));
  assert.ok(!operations.some((operation) => operation.type === "symlink" && operation.target === "/tmp/home/.codex/AFK.md"));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path === "/tmp/home/.agents/AGENTS.md" && operation.content.includes("<!-- AFK:RULES:START -->")));
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

  const write = operations.find((operation) => operation.type === "write" && operation.path === "/tmp/home/.agents/AGENTS.md");
  assert.ok(write && write.type === "write");
  assert.ok(!write.content.includes("@AFK_WORKFLOW.md"));
  assert.ok(!write.content.includes("@RTK.md"));
});

test("planRulesSync links all default agent rule hosts when no agent is selected", () => {
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

  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target === "/tmp/home/.codex/AGENTS.md"));
  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target === "/tmp/home/.gemini/GEMINI.md"));
  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target === "/tmp/home/.config/opencode/AGENTS.md"));
  assert.equal(operations.filter((operation) => operation.type === "symlink").length, 3);
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

test("planRulesSync writes project rule hosts for project scope", () => {
  const operations = planRulesSync(
    {
      agents: ["antigravity", "claude", "codex", "opencode"],
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
  assert.equal(operations.filter((operation) => operation.type === "write" && operation.path === "/tmp/project/AGENTS.md").length, 1);
  assert.ok(!operations.some((operation) => operation.type === "symlink"));
});
