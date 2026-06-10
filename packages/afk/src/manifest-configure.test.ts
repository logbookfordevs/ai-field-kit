import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { inferId, inferLabel, runManifestConfigureWithPrompts, type ManifestAction, type ManifestConfigurePrompts } from "./manifest-configure.js";
import {
  addManifestItem,
  emptyEditableManifest,
  removeManifestItem,
  serializeEditableManifest,
  toggleManifestItemDefault,
  toggleSkillAutoInvocation,
  updateManifestItem,
  validateEditableManifest,
  type EditableManifest,
} from "./manifest-editor.js";
import type { SkillManifest } from "./manifest.js";

test("inferId prefers URL filename stems", () => {
  assert.equal(
    inferId("https://raw.githubusercontent.com/me/dev-kit/main/skills/review-pr.md"),
    "review-pr",
  );
});

test("inferId normalizes free-form names", () => {
  assert.equal(inferId("My Fancy Skill!!"), "my-fancy-skill");
  assert.equal(inferId("git@github.com:acme/foo-bar.git"), "foo-bar");
});

test("inferLabel creates editable title defaults", () => {
  assert.equal(inferLabel("afk-pr-story-flow-mermaid"), "AFK / PR Story Flow Mermaid");
  assert.equal(inferLabel("stitch-mcp"), "Stitch MCP");
});

test("emptyEditableManifest creates typed empty manifests", () => {
  assert.deepEqual(emptyEditableManifest("rules"), { version: 1, source: "github", url: "" });
  assert.deepEqual(emptyEditableManifest("skills"), { version: 1, defaultSource: "", items: [] });
  assert.deepEqual(emptyEditableManifest("mcps"), { version: 1, items: [] });
  assert.deepEqual(emptyEditableManifest("utils"), { version: 1, items: [] });
  assert.deepEqual(emptyEditableManifest("hooks"), { version: 1, items: [] });
});

test("addManifestItem rejects duplicate ids", () => {
  const manifest: EditableManifest = {
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note"],
        default: true,
        autoInvocation: true,
      },
    ],
  };

  assert.throws(
    () => addManifestItem("skills", manifest, {
      id: "afk-note",
      label: "AFK / Note Copy",
      source: "https://github.com/logbookfordevs/ai-field-kit",
      args: ["--skill", "afk-note"],
      default: false,
      autoInvocation: true,
    }),
    /Duplicate skills id: afk-note/,
  );
});

test("item operations add, edit, remove, and toggle without mutating input", () => {
  const manifest: EditableManifest = { version: 1, items: [] };
  const withItem = addManifestItem("mcps", manifest, {
    id: "stitch",
    label: "Stitch MCP",
    source: "https://stitch.googleapis.com/mcp",
    args: ["--name", "stitchmcp"],
    default: true,
  });
  const edited = updateManifestItem("mcps", withItem, "stitch", {
    id: "stitch",
    label: "Stitch",
    source: "https://stitch.googleapis.com/mcp",
    args: ["--name", "stitch"],
    default: true,
  });
  const toggled = toggleManifestItemDefault("mcps", edited, "stitch");
  const removed = removeManifestItem("mcps", toggled, "stitch");

  assert.deepEqual(manifest, { version: 1, items: [] });
  assert.equal(edited.items[0]?.label, "Stitch");
  assert.equal(toggled.items[0]?.default, false);
  assert.deepEqual(removed.items, []);
});

test("toggleSkillAutoInvocation toggles only skills", () => {
  const manifest: SkillManifest = {
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note"],
        default: true,
        autoInvocation: true,
      },
    ],
  };

  const toggled = toggleSkillAutoInvocation(manifest, "afk-note");

  assert.equal(toggled.items[0]?.autoInvocation, false);
  assert.equal(manifest.items[0]?.autoInvocation, true);
});

test("validateEditableManifest catches duplicate ids and invalid shapes", () => {
  const duplicateSkills: EditableManifest = {
    version: 1,
    defaultSource: "",
    items: [
      { id: "same", label: "One", source: "https://example.com", args: [], default: true },
      { id: "same", label: "Two", source: "https://example.com", args: [], default: false },
    ],
  };
  const invalidRules: EditableManifest = { version: 1, source: "ftp", url: "" };

  assert.deepEqual(validateEditableManifest("skills", duplicateSkills), ["Duplicate skills id: same"]);
  assert.deepEqual(validateEditableManifest("rules", invalidRules), ["Invalid rules manifest shape"]);
});

test("serializeEditableManifest formats JSON with trailing newline", () => {
  const content = serializeEditableManifest("rules", {
    version: 1,
    source: "github",
    url: "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/rules/AGENTS.md",
  });

  assert.ok(content.endsWith("\n"));
  assert.equal(JSON.parse(content).source, "github");
});

test("runManifestConfigureWithPrompts loads existing manifests by default and writes confirmed settings-style toggles", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "manifests");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "https://github.com/logbookfordevs/ai-field-kit",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note"],
        default: true,
        autoInvocation: true,
      },
    ],
  }, null, 2)}\n`);

  const output: string[] = [];
  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["skills", "finish"],
      actions: ["toggle-default", "back"],
      toggleValues: [{ "afk-note": false }],
      confirms: [true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "skills.json"), "utf8")) as { items: Array<{ id: string; default: boolean }> };
  assert.equal(code, 0);
  assert.equal(written.items[0]?.default, false);
  assert.ok(output.join("\n").includes("Manifest preview"));
});

test("runManifestConfigureWithPrompts previews dry-run edits without writing", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "manifests");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "mcps.json"), `${JSON.stringify({
    version: 1,
    items: [
      {
        id: "stitch",
        label: "Stitch MCP",
        source: "https://stitch.googleapis.com/mcp",
        args: ["--name", "stitchmcp"],
        default: true,
      },
    ],
  }, null, 2)}\n`);

  const output: string[] = [];
  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir, dryRun: true }),
    scriptedPrompts({
      areas: ["mcps", "finish"],
      actions: ["remove", "back"],
      items: ["stitch"],
      confirms: [true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "mcps.json"), "utf8")) as { items: Array<{ id: string }> };
  assert.equal(code, 0);
  assert.equal(written.items.length, 1);
  assert.ok(output.join("\n").includes("Dry run complete. No manifests written."));
});

test("runManifestConfigureWithPrompts edits project manifests for local configure", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "afk-configure-project-"));
  const manifestDir = join(cwd, "afk", "manifests");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "rules.json"), `${JSON.stringify({
    version: 1,
    source: "github",
    url: "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/rules/AGENTS.md",
  }, null, 2)}\n`);

  const output: string[] = [];
  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ cwd, manifestConfigureLocal: true, manifestConfigureFromCurrent: true }),
    scriptedPrompts({
      areas: ["rules", "finish"],
      actions: ["edit-rules", "back"],
      inputs: ["./AGENTS.md"],
      confirms: [true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "rules.json"), "utf8")) as { source: string; url: string };
  assert.equal(code, 0);
  assert.equal(written.source, "local");
  assert.equal(written.url, "./AGENTS.md");
  assert.ok(output.join("\n").includes("Manifest preview"));
});

test("runManifestConfigureWithPrompts shows boolean state in toggle choices", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "manifests");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "https://github.com/logbookfordevs/ai-field-kit",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note"],
        default: true,
        autoInvocation: false,
      },
    ],
  }, null, 2)}\n`);

  const toggleChoiceLabels: string[] = [];
  await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir, dryRun: true }),
    scriptedPrompts({
      areas: ["skills", "finish"],
      actions: ["toggle-auto", "back"],
      toggleValues: [{ "afk-note": true }],
      onToggleChoices: (choices) => {
        toggleChoiceLabels.push(...choices.map((choice) => choice.name));
      },
    }),
  );

  assert.ok(toggleChoiceLabels.some((label) => label.includes("[off]")));
  assert.ok(toggleChoiceLabels.some((label) => label.includes("AFK / Note")));
});

test("runManifestConfigureWithPrompts shows current boolean state in edit prompts", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "manifests");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "mcps.json"), `${JSON.stringify({
    version: 1,
    items: [
      {
        id: "stitch",
        label: "Stitch MCP",
        source: "https://stitch.googleapis.com/mcp",
        args: ["--name", "stitchmcp"],
        default: false,
      },
    ],
  }, null, 2)}\n`);

  const confirmMessages: string[] = [];
  await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir, dryRun: true }),
    scriptedPrompts({
      areas: ["mcps", "finish"],
      actions: ["edit", "back"],
      items: ["stitch"],
      inputs: ["https://stitch.googleapis.com/mcp", "stitch", "Stitch MCP", "--name stitchmcp"],
      confirms: [false],
      onConfirm: (message) => confirmMessages.push(message),
    }),
  );

  assert.ok(confirmMessages.includes("Selected by default? (current: off)"));
});

function captureIo(output: string[]) {
  return {
    stdout: (message: string) => output.push(message),
    stderr: (message: string) => output.push(message),
  };
}

function cliOptions(overrides: Partial<Parameters<typeof runManifestConfigureWithPrompts>[1]> = {}): Parameters<typeof runManifestConfigureWithPrompts>[1] {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: false,
    dryRun: false,
    yes: false,
    includeExternal: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    selectedMcpIds: [],
    selectedUtilIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    selectedManifestCategories: [],
    homeDir: mkdtempSync(join(tmpdir(), "afk-configure-home-")),
    repoDir: process.cwd(),
    cwd: process.cwd(),
    ...overrides,
  };
}

function scriptedPrompts(script: {
  areas: Array<"rules" | "skills" | "mcps" | "utils" | "hooks" | "finish">;
  actions: ManifestAction[];
  items?: string[];
  inputs?: string[];
  confirms?: boolean[];
  toggleValues?: Array<Record<string, boolean>>;
  onSelectItemChoices?: (choices: Array<{ name: string; value: string; description?: string }>) => void;
  onToggleChoices?: (choices: Array<{ name: string; value: string; enabled: boolean; description?: string }>) => void;
  onConfirm?: (message: string) => void;
}): ManifestConfigurePrompts {
  const areas = [...script.areas];
  const actions = [...script.actions];
  const items = [...(script.items ?? [])];
  const inputs = [...(script.inputs ?? [])];
  const confirms = [...(script.confirms ?? [])];
  const toggleValues = [...(script.toggleValues ?? [])];

  return {
    selectArea: async () => nextValue(areas, "area"),
    selectAction: async () => nextValue(actions, "action"),
    selectItem: async (_area, choices) => {
      script.onSelectItemChoices?.(choices);
      return nextValue(items, "item");
    },
    toggleBooleans: async (_area, choices) => {
      script.onToggleChoices?.(choices);
      return nextValue(toggleValues, "toggle values");
    },
    input: async () => nextValue(inputs, "input"),
    confirm: async (message) => {
      script.onConfirm?.(message);
      return nextValue(confirms, "confirm");
    },
  };
}

function nextValue<T>(values: T[], label: string): T {
  const value = values.shift();
  if (value === undefined) {
    throw new Error(`Missing scripted ${label}`);
  }

  return value;
}
