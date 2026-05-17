import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { extractDescription, planWorkflowSync } from "./workflows.js";

test("extractDescription reads the first paragraph after the title", () => {
  const description = extractDescription("# Title\n\nFirst line.\nSecond line.\n\n## Next\nNope");
  assert.equal(description, "First line. Second line.");
});

test("planWorkflowSync dry-run planning does not require real home config", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-workflows-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  mkdirSync(join(repo, "workflows"), { recursive: true });
  writeFileSync(join(repo, "workflows", "afk-demo.md"), "# Demo\n\nDemo workflow.\n");

  const operations = planWorkflowSync({ agents: ["codex"], homeDir: home, repoDir: repo, cwd: join(root, "project"), setupScope: "global" });
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("SKILL.md")));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith(".ai-field-kit-managed")));
});

test("planWorkflowSync writes project-scoped workflow targets", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-workflows-project-"));
  const repo = join(root, "repo");
  const project = join(root, "project");
  mkdirSync(join(repo, "workflows"), { recursive: true });
  writeFileSync(join(repo, "workflows", "afk-demo.md"), "# Demo\n\nDemo workflow.\n");

  const operations = planWorkflowSync({ agents: ["claude", "codex", "gemini"], homeDir: join(root, "home"), repoDir: repo, cwd: project, setupScope: "project" });

  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target.startsWith(join(project, ".agents", "commands"))));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".agents", "skills"))));
  assert.ok(operations.some((operation) => operation.type === "write" && operation.path.startsWith(join(project, ".gemini", "commands"))));
  assert.ok(operations.some((operation) => operation.type === "symlink" && operation.target.startsWith(join(project, ".claude", "commands"))));
});
