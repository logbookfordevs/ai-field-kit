import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { detectSetupTargets } from "./agent-detection.js";

test("detectSetupTargets returns installed compatible global targets", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-detect-"));
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  mkdirSync(join(homeDir, ".claude"), { recursive: true });
  mkdirSync(join(homeDir, ".cursor"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");
  writeFileSync(join(homeDir, ".claude", "settings.json"), "{}\n");
  writeFileSync(join(homeDir, ".cursor", "hooks.json"), "{}\n");

  const detected = detectSetupTargets({
    homeDir,
    cwd: "/tmp/project",
    setupScope: "global",
  });

  assert.deepEqual(detected.agents, ["claude", "codex"]);
  assert.deepEqual(detected.hookAgents, ["codex", "claude", "cursor-local"]);
  assert.deepEqual(detected.skillAgents, ["claude-code"]);
});

test("detectSetupTargets keeps project detection scoped to the project", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-detect-project-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");
  writeFileSync(join(cwd, "AGENTS.md"), "# Project agents\n");

  const detected = detectSetupTargets({
    homeDir,
    cwd,
    setupScope: "project",
  });

  assert.deepEqual(detected.agents, ["codex", "opencode"]);
  assert.deepEqual(detected.hookAgents, []);
});

test("detectSetupTargets honors local custom agent path evidence outside presets", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-detect-custom-"));
  mkdirSync(join(homeDir, ".agents", "afk"), { recursive: true });
  mkdirSync(join(homeDir, "company", "opencode"), { recursive: true });
  writeFileSync(join(homeDir, "company", "opencode", "AGENTS.md"), "# Team OpenCode\n");
  writeFileSync(join(homeDir, ".agents", "afk", "setup-targets.json"), `${JSON.stringify({
    version: 1,
    customAgentPaths: {
      opencode: ["company/opencode/AGENTS.md"],
      "kiro-cli": ["company/missing-kiro-skills"],
    },
  }, null, 2)}\n`);

  const detected = detectSetupTargets({
    homeDir,
    cwd: "/tmp/project",
    setupScope: "global",
  });

  assert.deepEqual(detected.agents, ["opencode"]);
  assert.deepEqual(detected.skillAgents, []);
});
