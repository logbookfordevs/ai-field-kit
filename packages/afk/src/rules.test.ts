import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { planRulesSync } from "./rules.js";
import type { CliOptions } from "./types.js";

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

test("planRulesSync installs shared global rule files and expands their directory placeholder", () => {
  const operations = planRulesSync(
    {
      agents: ["codex", "claude"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "global",
    },
    {
      afk: "Read `{{AFK_RULES_DIR}}/artifacts.md` when choosing an artifact destination.\n",
      files: [
        {
          destination: "artifacts.md",
          content: "# Artifact conventions\n",
        },
      ],
    },
  );

  const dependencyWrites = operations.filter((operation) => (
    operation.type === "write" &&
    operation.path === "/tmp/home/.agents/afk/rules/artifacts.md"
  ));
  assert.equal(dependencyWrites.length, 1);
  assert.equal(dependencyWrites[0]?.type === "write" ? dependencyWrites[0].content : "", "# Artifact conventions\n");

  const hostWrites = operations.filter((operation) => (
    operation.type === "write" &&
    (operation.path === "/tmp/home/.codex/AGENTS.md" || operation.path === "/tmp/home/.claude/CLAUDE.md")
  ));
  assert.equal(hostWrites.length, 2);
  for (const operation of hostWrites) {
    assert.ok(operation.type === "write");
    assert.ok(operation.content.includes("/tmp/home/.agents/afk/rules/artifacts.md"));
    assert.ok(!operation.content.includes("{{AFK_RULES_DIR}}"));
  }
});

test("planRulesSync installs project rule files inside the project-owned AFK directory", () => {
  const operations = planRulesSync(
    {
      agents: ["codex"],
      homeDir: "/tmp/home",
      cwd: "/tmp/project",
      setupScope: "project",
    },
    {
      afk: "Read `{{AFK_RULES_DIR}}/artifacts.md`.\n",
      files: [
        {
          destination: "artifacts.md",
          content: "# Artifact conventions\n",
        },
      ],
    },
  );

  assert.ok(operations.some((operation) => (
    operation.type === "write" &&
    operation.path === "/tmp/project/.agents/afk/rules/artifacts.md"
  )));
  const hostWrite = operations.find((operation) => (
    operation.type === "write" &&
    operation.path === "/tmp/project/AGENTS.md"
  ));
  assert.ok(hostWrite && hostWrite.type === "write");
  assert.ok(hostWrite.content.includes("/tmp/project/.agents/afk/rules/artifacts.md"));
});

test("planRulesSync rejects unsafe and duplicate dependency destinations", () => {
  const options: Pick<CliOptions, "agents" | "homeDir" | "cwd" | "setupScope"> = {
    agents: ["codex"],
    homeDir: "/tmp/home",
    cwd: "/tmp/project",
    setupScope: "global",
  };

  assert.throws(
    () => planRulesSync(options, {
      afk: "# AFK\n",
      files: [{ destination: "../outside.md", content: "unsafe\n" }],
    }),
    /Invalid rules file destination: \.\.\/outside\.md/,
  );
  assert.throws(
    () => planRulesSync(options, {
      afk: "# AFK\n",
      files: [
        { destination: "same.md", content: "one\n" },
        { destination: "same.md", content: "two\n" },
      ],
    }),
    /Duplicate rules file destination: same\.md/,
  );
});

test("planRulesSync removes only stale files recorded in the managed dependency inventory", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-rules-files-"));
  try {
    const homeDir = join(root, "home");
    const dependencyRoot = join(homeDir, ".agents", "afk", "rules");
    mkdirSync(dependencyRoot, { recursive: true });
    writeFileSync(join(dependencyRoot, "old.md"), "old\n");
    writeFileSync(join(dependencyRoot, "unmanaged.md"), "keep\n");
    writeFileSync(
      join(dependencyRoot, ".ai-field-kit-managed"),
      `${JSON.stringify({ version: 1, files: ["old.md"] }, null, 2)}\n`,
    );

    const operations = planRulesSync(
      {
        agents: ["codex"],
        homeDir,
        cwd: "/tmp/project",
        setupScope: "global",
      },
      {
        afk: "# AFK\n",
        files: [
          { destination: "current.md", content: "current\n" },
        ],
      },
    );

    assert.ok(operations.some((operation) => (
      operation.type === "remove" &&
      operation.path === join(dependencyRoot, "old.md")
    )));
    assert.ok(!operations.some((operation) => (
      operation.type === "remove" &&
      operation.path === join(dependencyRoot, "unmanaged.md")
    )));
    const inventoryWrite = operations.find((operation) => (
      operation.type === "write" &&
      operation.path === join(dependencyRoot, ".ai-field-kit-managed")
    ));
    assert.ok(inventoryWrite && inventoryWrite.type === "write");
    assert.deepEqual(JSON.parse(inventoryWrite.content), {
      version: 1,
      files: ["current.md"],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
