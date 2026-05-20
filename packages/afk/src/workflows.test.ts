import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { extractDescription, planWorkflowSync, syncWorkflows } from "./workflows.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions } from "./types.js";

const workflowFiles = [
  {
    filename: "afk-demo.md",
    content: "# Demo\n\nDemo workflow.\n",
  },
];

test("extractDescription reads the first paragraph after the title", () => {
  const description = extractDescription("# Title\n\nFirst line.\nSecond line.\n\n## Next\nNope");
  assert.equal(description, "First line. Second line.");
});

test("planWorkflowSync dry-run planning does not require real home config", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-workflows-"));
  const home = join(root, "home");
  const operations = planWorkflowSync({ agents: ["codex"], homeDir: home, cwd: join(root, "project"), setupScope: "global" }, workflowFiles);
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("SKILL.md")));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith(".ai-field-kit-managed")));
});

test("planWorkflowSync writes project-scoped workflow targets", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-workflows-project-"));
  const project = join(root, "project");
  const operations = planWorkflowSync({ agents: ["claude", "codex", "gemini"], homeDir: join(root, "home"), cwd: project, setupScope: "project" }, workflowFiles);

  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".agents", "commands"))));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".agents", "skills"))));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".gemini", "commands"))));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".claude", "commands"))));
  assert.ok(!operations.some((operation) => operation.type === "symlink"));
});

test("syncWorkflows honors selected workflow ids", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-workflows-selected-"));
  const homeDir = join(root, "home");
  const repoDir = join(root, "repo");
  mkdirSync(join(repoDir, "workflows"), { recursive: true });
  mkdirSync(localManifestDir(homeDir), { recursive: true });
  writeFileSync(join(repoDir, "workflows", "one.md"), "# One\n\nFirst workflow.\n");
  writeFileSync(join(repoDir, "workflows", "two.md"), "# Two\n\nSecond workflow.\n");
  writeFileSync(join(localManifestDir(homeDir), "workflows.json"), JSON.stringify({
    version: 1,
    source: "local",
    items: [
      { id: "one", label: "One", url: "workflows/one.md", default: true },
      { id: "two", label: "Two", url: "workflows/two.md", default: true },
    ],
  }));

  const output: string[] = [];
  await syncWorkflows({
    io: {
      stdout: (message) => output.push(message),
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  }, {
    agents: ["claude"],
    setupScope: "global",
    scopeExplicit: true,
    dryRun: true,
    yes: false,
    includeExternal: false,
    selectedSkillIds: [],
    selectedWorkflowIds: ["one"],
    selectedMcpIds: [],
    selectedUtilIds: [],
    rulesRef: "main",
    rulesSource: "local",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    homeDir,
    repoDir,
    cwd: join(root, "project"),
  } satisfies CliOptions);

  const text = output.join("\n");
  assert.match(text, /one\.md/);
  assert.doesNotMatch(text, /two\.md/);
});
