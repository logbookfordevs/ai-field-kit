import assert from "node:assert/strict";
import { test } from "vitest";
import { buildUiSkillsCommand, runUiCommand } from "./ui.js";
import type { CliOptions, Runtime } from "./types.js";

test("buildUiSkillsCommand delegates plain ui to ui-skills", () => {
  assert.deepEqual(buildUiSkillsCommand(["ui"], { cwd: "/tmp/project", uiCategory: "" }), {
    label: "UI Skills",
    command: "npx",
    args: ["--yes", "ui-skills"],
    cwd: "/tmp/project",
  });
});

test("buildUiSkillsCommand maps supported ui-skills commands", () => {
  assert.deepEqual(buildUiSkillsCommand(["ui", "start"], { cwd: "/tmp/project", uiCategory: "" }).args, ["--yes", "ui-skills", "start"]);
  assert.deepEqual(buildUiSkillsCommand(["ui", "categories"], { cwd: "/tmp/project", uiCategory: "" }).args, ["--yes", "ui-skills", "categories"]);
  assert.deepEqual(buildUiSkillsCommand(["ui", "list"], { cwd: "/tmp/project", uiCategory: "motion" }).args, [
    "--yes",
    "ui-skills",
    "list",
    "--category",
    "motion",
  ]);
  assert.deepEqual(buildUiSkillsCommand(["ui", "get", "baseline-ui"], { cwd: "/tmp/project", uiCategory: "" }).args, [
    "--yes",
    "ui-skills",
    "get",
    "baseline-ui",
  ]);
});

test("buildUiSkillsCommand validates get target and unknown commands", () => {
  assert.throws(() => buildUiSkillsCommand(["ui", "get"], { cwd: "/tmp/project", uiCategory: "" }), /Missing skill slug/);
  assert.throws(() => buildUiSkillsCommand(["ui", "install"], { cwd: "/tmp/project", uiCategory: "" }), /Unknown ui command/);
});

test("runUiCommand dry-run prints delegated command without spawning", async () => {
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      throw new Error("spawn should not run during dry-run");
    },
  };

  const code = await runUiCommand(["ui", "list"], runtime, {
    ...baseOptions("/tmp/project"),
    dryRun: true,
    uiCategory: "motion",
  });

  assert.equal(code, 0);
  assert.deepEqual(output, [
    "UI Skills delegation",
    "$ npx --yes ui-skills list --category motion",
  ]);
});

test("runUiCommand delegates with inherited upstream output", async () => {
  const spawned: Array<{ command: string; args: string[]; cwd?: string; verbose?: boolean }> = [];
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async (command, args, cwd, behavior) => {
      spawned.push({
        command,
        args,
        ...(cwd ? { cwd } : {}),
        ...(behavior?.verbose === undefined ? {} : { verbose: behavior.verbose }),
      });
      return { code: 0 };
    },
  };

  const code = await runUiCommand(["ui", "get", "baseline-ui"], runtime, baseOptions("/tmp/project"));

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["--yes", "ui-skills", "get", "baseline-ui"],
    cwd: "/tmp/project",
    verbose: true,
  }]);
});

function baseOptions(cwd: string): CliOptions {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: false,
    dryRun: false,
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    startDisabledSkills: false,
    selectedMcpIds: [],
    selectedPluginIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    defaultsSourceExplicit: false,
    defaultSourceUpdate: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    manifestShowReact: false,
    manifestShowVisualize: false,
    selectedManifestCategories: [],
    homeDir: "/tmp/home",
    repoDir: "/tmp/repo",
    cwd,
  };
}
