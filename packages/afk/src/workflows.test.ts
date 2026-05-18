import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { extractDescription, planWorkflowSync } from "./workflows.js";

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
