import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { filterCatalogSelectChoices, inferId, inferLabel, runManifestConfigureWithPrompts, summarizeDraftChange, type ManifestAction, type ManifestConfigurePrompts } from "./manifest-configure.js";
import {
  addManifestItem,
  addRulesLayer,
  emptyEditableManifest,
  removeManifestItem,
  removeRulesLayer,
  serializeEditableManifest,
  toggleManifestItemDefault,
  toggleSkillAutoInvocation,
  updateManifestItem,
  updateRulesLayer,
  validateEditableManifest,
  type EditableManifest,
} from "./manifest-editor.js";
import type { SkillManifest } from "./manifest.js";
import type { SkillProfileMode } from "./types.js";

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

test("filterCatalogSelectChoices searches skill identity and metadata", () => {
  const choices = [
    { name: "alpha", value: "alpha", description: "label: Human Alpha · source: owner/skills", searchAliases: ["manual"] },
    { name: "beta", value: "beta", description: "label: Human Beta · source: other/skills", searchAliases: ["auto"] },
  ];

  assert.deepEqual(filterCatalogSelectChoices(choices, "human alpha manual").map((choice) => choice.value), ["alpha"]);
  assert.deepEqual(filterCatalogSelectChoices(choices, "other/skills").map((choice) => choice.value), ["beta"]);
});

test("emptyEditableManifest creates typed empty manifests", () => {
  assert.deepEqual(emptyEditableManifest("rules"), { version: 2, layers: [] });
  assert.deepEqual(emptyEditableManifest("skills"), { version: 1, defaultSource: "", items: [] });
  assert.deepEqual(emptyEditableManifest("agents"), { version: 1, items: [] });
  assert.deepEqual(emptyEditableManifest("mcps"), { version: 1, items: [] });
  assert.deepEqual(emptyEditableManifest("tools"), { version: 1, items: [] });
  assert.deepEqual(emptyEditableManifest("hooks"), { version: 1, items: [] });
});

test("rules layer operations migrate legacy rules and add, edit, and remove by id", () => {
  const legacy: EditableManifest = {
    version: 1,
    source: "github",
    url: "rules/AGENTS.md",
    files: [{ source: "rules/artifacts.md", destination: "artifacts.md" }],
  };
  const added = addRulesLayer(legacy, {
    id: "personal",
    label: "Personal rules",
    source: "rules/PERSONAL.md",
  });
  const edited = updateRulesLayer(added, "personal", {
    id: "personal",
    label: "Leonardo's rules",
    source: "rules/LEONARDO.md",
  });
  const removed = removeRulesLayer(edited, "legacy");

  assert.equal(added.version, 2);
  assert.deepEqual(added.layers.map((layer) => layer.id), ["legacy", "personal"]);
  assert.deepEqual(added.layers[0]?.files, [{ source: "rules/artifacts.md", destination: "artifacts.md" }]);
  assert.equal(edited.layers[1]?.label, "Leonardo's rules");
  assert.deepEqual(removed.layers.map((layer) => layer.id), ["personal"]);
  assert.throws(
    () => addRulesLayer(added, { id: "personal", label: "Duplicate", source: "duplicate.md" }),
    /Duplicate rules layer id: personal/,
  );
});

test("runManifestConfigureWithPrompts adds a Custom Agent without default metadata", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-agents-"));

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["agents", "finish"],
      actions: ["add", "back"],
      inputs: ["https://example.com/agents/notion-assistant.md", "notion_assistant", "Notion Assistant"],
      confirms: [true],
    }),
  );

  const written = JSON.parse(readFileSync(join(homeDir, ".agents", "afk", "catalog", "agents.json"), "utf8")) as {
    items: Array<Record<string, unknown>>;
  };
  assert.equal(code, 0);
  assert.deepEqual(written.items, [{
    id: "notion_assistant",
    label: "Notion Assistant",
    source: "https://example.com/agents/notion-assistant.md",
  }]);
});

test("runManifestConfigureWithPrompts adds a named rules layer", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-rules-"));

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: [],
      actions: [],
      inputs: ["rules/PERSONAL.md", "leonardo-personal", "Leonardo's personal rules"],
      confirms: [true],
    }),
    { area: "rules", action: "add" },
  );

  const written = JSON.parse(readFileSync(join(homeDir, ".agents", "afk", "catalog", "rules.json"), "utf8")) as {
    version: number;
    layers: Array<{ id: string; label: string; source: string }>;
  };
  assert.equal(code, 0);
  assert.equal(written.version, 2);
  assert.deepEqual(written.layers, [{
    id: "leonardo-personal",
    label: "Leonardo's personal rules",
    source: "rules/PERSONAL.md",
  }]);
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
        invocation: "auto",
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
      invocation: "auto",
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
        invocation: "auto",
      },
    ],
  };

  const toggled = toggleSkillAutoInvocation(manifest, "afk-note");

  assert.equal(toggled.items[0]?.invocation, "manual");
  assert.equal(manifest.items[0]?.invocation, "auto");
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
  const unsafeRules: EditableManifest = {
    version: 1,
    source: "github",
    url: "rules/AGENTS.md",
    files: [
      { source: "rules/one.md", destination: "../one.md" },
      { source: "rules/two.md", destination: "same.md" },
      { source: "rules/three.md", destination: "same.md" },
    ],
  };

  assert.deepEqual(validateEditableManifest("skills", duplicateSkills), ["Duplicate skills id: same"]);
  assert.deepEqual(validateEditableManifest("rules", invalidRules), ["Invalid rules manifest shape"]);
  assert.deepEqual(validateEditableManifest("rules", unsafeRules), [
    "Invalid rules file destination: ../one.md",
    "Duplicate rules file destination: same.md",
  ]);
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

test("summarizeDraftChange ignores legacy rules migration metadata", () => {
  const legacyRules: EditableManifest = {
    version: 1,
    source: "github",
    url: "rules/AGENTS.md",
  };
  const layeredRules: EditableManifest = {
    version: 2,
    layers: [
      { id: "legacy", label: "Rules", source: "rules/AGENTS.md" },
      { id: "personal", label: "Personal rules", source: "rules/PERSONAL.md" },
    ],
  };

  assert.equal(summarizeDraftChange("rules", legacyRules, layeredRules), "1 layer added (1 → 2)");
});

test("runManifestConfigureWithPrompts loads existing manifests by default and writes confirmed settings-style toggles", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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
        invocation: "auto",
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
  assert.ok(output.join("\n").includes("Catalog changes"));
});

test("runManifestConfigureWithPrompts previews dry-run edits without writing", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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
  assert.ok(output.join("\n").includes("Catalog changes"));
  assert.ok(output.join("\n").includes("mcps.json: 1 item removed (1 → 0)"));
  assert.ok(!output.join("\n").includes("--- mcps.json ---"));
  assert.ok(!output.join("\n").includes('"items":'));
  assert.ok(output.join("\n").includes("Dry run complete. No catalog files written."));
});

test("runManifestConfigureWithPrompts shows the complete catalog preview in verbose mode", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-verbose-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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
    cliOptions({ homeDir, dryRun: true, verbose: true }),
    scriptedPrompts({
      areas: ["mcps", "finish"],
      actions: ["remove", "back"],
      items: ["stitch"],
      confirms: [true],
    }),
  );

  const text = output.join("\n");
  assert.equal(code, 0);
  assert.ok(text.includes("Catalog changes"));
  assert.ok(text.includes("mcps.json: 1 item removed (1 → 0)"));
  assert.ok(text.includes("Catalog preview"));
  assert.ok(text.includes("--- mcps.json ---"));
  assert.ok(text.includes('"items": []'));
});

test("runManifestConfigureWithPrompts preserves existing skill args during no-op edit", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "https://github.com/logbookfordevs/ai-field-kit",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note", "--global"],
        default: true,
        invocation: "auto",
      },
    ],
  }, null, 2)}\n`);

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["skills", "finish"],
      actions: ["edit", "back"],
      items: ["afk-note"],
      inputs: ["https://github.com/logbookfordevs/ai-field-kit", "afk-note", "afk-note", "AFK / Note"],
      confirms: [true, true, false, true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "skills.json"), "utf8")) as { items: Array<{ args: string[] }> };
  assert.equal(code, 0);
  assert.deepEqual(written.items[0]?.args, ["--skill", "afk-note", "--global"]);
});

test("runManifestConfigureWithPrompts offers setup for an edited skill", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-edit-setup-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "owner/skills",
    items: [{
      id: "alpha",
      label: "Alpha",
      source: "owner/skills",
      args: ["--skill", "alpha"],
      default: true,
      invocation: "auto",
    }],
  }, null, 2)}\n`);
  const spawned: Array<{ command: string; args: string[] }> = [];

  const code = await runManifestConfigureWithPrompts(
    {
      io: captureIo([]),
      spawn: async (command, args) => {
        spawned.push({ command, args });
        return { code: 0 };
      },
    },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: [],
      actions: [],
      items: ["alpha"],
      inputs: ["owner/skills", "alpha", "alpha", "Alpha"],
      confirms: [true, false, false, true, true],
    }),
    { area: "skills", action: "edit" },
  );

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["skills", "add", "owner/skills", "--global", "--yes", "--skill", "alpha", "--agent", "universal"],
  }]);
});

test("runManifestConfigureWithPrompts writes startDisabled for skill items", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [],
  }, null, 2)}\n`);

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["skills", "finish"],
      actions: ["add", "back"],
      inputs: ["https://github.com/example/skills", "quiet-skill", "quiet-skill", "Quiet Skill"],
      confirms: [true, true, true, true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "skills.json"), "utf8")) as { items: Array<{ startDisabled?: boolean }> };
  assert.equal(code, 0);
  assert.equal(written.items[0]?.startDisabled, true);
});

test("runManifestConfigureWithPrompts defaults automatic model invocation off for new skills", async () => {
  const confirmPrompts: Array<{ message: string; defaultValue: boolean }> = [];

  await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ dryRun: true }),
    scriptedPrompts({
      areas: ["skills", "finish"],
      actions: ["add", "back"],
      inputs: ["https://github.com/example/skills", "manual-skill", "manual-skill", "Manual Skill"],
      confirms: [true, false, false],
      onConfirm: (message, defaultValue) => confirmPrompts.push({ message, defaultValue }),
    }),
  );

  assert.ok(confirmPrompts.some(({ message, defaultValue }) => (
    message === "Use automatic model invocation? (default: off)" && defaultValue === false
  )));
});

test("runManifestConfigureWithPrompts can finish and review from a catalog submenu", async () => {
  const actionLabels: string[] = [];
  const output: string[] = [];

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ dryRun: true }),
    scriptedPrompts({
      areas: ["skills"],
      actions: ["add", "finish"],
      inputs: ["https://github.com/example/skills", "manual-skill", "manual-skill", "Manual Skill"],
      confirms: [true, false, false],
      onSelectActionChoices: (choices) => actionLabels.push(...choices.map((choice) => choice.name)),
    }),
  );

  assert.equal(code, 0);
  assert.ok(actionLabels.includes("Finish and review"));
  assert.ok(actionLabels.includes("Back to manage other catalogs"));
  assert.ok(output.join("\n").includes("Catalog changes"));
});

test("runManifestConfigureWithPrompts offers review before Ctrl-C discards unsaved changes", async () => {
  const confirmMessages: string[] = [];
  const output: string[] = [];
  const prompts = scriptedPrompts({
    areas: ["skills"],
    actions: ["add"],
    inputs: ["https://github.com/example/skills", "manual-skill", "manual-skill", "Manual Skill"],
    confirms: [true, false, false, true],
    onConfirm: (message) => confirmMessages.push(message),
  });
  const selectAction = prompts.selectAction;
  let actionCount = 0;
  prompts.selectAction = async (...args) => {
    actionCount += 1;
    if (actionCount === 2) {
      const error = new Error("User force closed the prompt with SIGINT");
      error.name = "ExitPromptError";
      throw error;
    }
    return selectAction(...args);
  };

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ dryRun: true }),
    prompts,
  );

  assert.equal(code, 0);
  assert.ok(confirmMessages.includes("Finish and review changes before exiting?"));
  assert.ok(output.join("\n").includes("Catalog changes"));
});

test("runManifestConfigureWithPrompts toggles profile alwaysOn skills", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      { id: "alpha", label: "Alpha", source: "owner/skills", args: ["--skill", "alpha"], default: true },
      { id: "beta", label: "Beta", source: "owner/skills", args: ["--skill", "beta"], default: false },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "profiles.json"), `${JSON.stringify({
    version: 1,
    alwaysOn: ["beta"],
    items: [],
  }, null, 2)}\n`);
  const output: string[] = [];
  const seenToggleValues: string[] = [];
  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["profiles", "finish"],
      actions: ["toggle-always-on", "back"],
      toggleValues: [{ alpha: true, beta: false }],
      confirms: [true],
      onToggleChoices: (choices) => {
        seenToggleValues.push(...choices.map((choice) => choice.value));
      },
    }),
  );

  assert.equal(code, 0);
  assert.deepEqual(seenToggleValues, ["alpha", "beta"]);
  const written = JSON.parse(readFileSync(join(manifestDir, "profiles.json"), "utf8")) as { alwaysOn: string[] };
  assert.deepEqual(written.alwaysOn, ["alpha"]);
});

test("runManifestConfigureWithPrompts bulk edits invocation and always-on policy", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-bulk-edit-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      { id: "alpha", label: "Alpha", source: "owner/skills", args: ["--skill", "alpha"], default: true, invocation: "auto" },
      { id: "beta", label: "Beta", source: "owner/skills", args: ["--skill", "beta"], default: false, invocation: "auto" },
      { id: "gamma", label: "Gamma", source: "owner/skills", args: ["--skill", "gamma"], default: false, invocation: "auto" },
    ],
  }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "profiles.json"), `${JSON.stringify({
    version: 1,
    mode: "context",
    alwaysOn: ["gamma"],
    items: [],
  }, null, 2)}\n`);
  const settingMessages: string[] = [];
  const bulkChoices: Array<{ name: string; value: string; description?: string }> = [];
  const confirmMessages: string[] = [];
  const spawned: Array<{ command: string; args: string[] }> = [];

  const code = await runManifestConfigureWithPrompts(
    {
      io: captureIo([]),
      spawn: async (command, args) => {
        spawned.push({ command, args });
        return { code: 0 };
      },
    },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: [],
      actions: [],
      selectedItems: [["alpha", "beta"]],
      bulkSkillSettings: ["off", "on"],
      confirms: [true, true],
      onSelectItemsChoices: (choices) => bulkChoices.push(...choices),
      onSelectBulkSkillSetting: (message) => settingMessages.push(message),
      onConfirm: (message) => confirmMessages.push(message),
    }),
    { area: "skills", action: "bulk-edit" },
  );

  const skills = JSON.parse(readFileSync(join(manifestDir, "skills.json"), "utf8")) as {
    items: Array<{ id: string; invocation: "auto" | "manual" | "source" }>;
  };
  const profiles = JSON.parse(readFileSync(join(manifestDir, "profiles.json"), "utf8")) as { alwaysOn: string[] };
  assert.equal(code, 0);
  assert.deepEqual(skills.items.map((item) => [item.id, item.invocation]), [
    ["alpha", "manual"],
    ["beta", "manual"],
    ["gamma", "auto"],
  ]);
  assert.deepEqual(profiles.alwaysOn, ["alpha", "beta", "gamma"]);
  assert.deepEqual(settingMessages, [
    "Set invocation mode for selected skills",
    "Set always-on for selected skills",
  ]);
  assert.deepEqual(bulkChoices.map((choice) => choice.name), ["alpha", "beta", "gamma"]);
  assert.ok(bulkChoices[0]?.description?.includes("label: Alpha"));
  assert.ok(bulkChoices[0]?.description?.includes("invocation: auto"));
  assert.ok(bulkChoices[0]?.description?.includes("always-on: off"));
  assert.ok(confirmMessages.includes("Run setup for 2 affected skills now?"));
  assert.equal(spawned.length, 1);
  assert.deepEqual(spawned[0], {
    command: "npx",
    args: ["skills", "add", "owner/skills", "--global", "--yes", "--skill", "alpha", "beta", "--agent", "universal"],
  });
});

test("runManifestConfigureWithPrompts sets profile mode", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "profiles.json"), `${JSON.stringify({
    version: 1,
    alwaysOn: [],
    items: [],
  }, null, 2)}\n`);

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: ["profiles", "finish"],
      actions: ["set-profile-mode", "back"],
      profileModes: ["context"],
      confirms: [true],
    }),
  );

  assert.equal(code, 0);
  const written = JSON.parse(readFileSync(join(manifestDir, "profiles.json"), "utf8")) as { mode: string };
  assert.equal(written.mode, "context");
});

test("runManifestConfigureWithPrompts can enter one catalog area directly", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-area-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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
  const selectedAreas: string[] = [];

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    {
      ...scriptedPrompts({
        areas: ["finish"],
        actions: ["toggle-default", "back"],
        toggleValues: [{ stitch: false }],
        confirms: [true],
      }),
      selectArea: async (choices) => {
        selectedAreas.push(...choices.map((choice) => choice.value));
        return "finish";
      },
    },
    { area: "mcps" },
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "mcps.json"), "utf8")) as { items: Array<{ id: string; default: boolean }> };
  assert.equal(code, 0);
  assert.deepEqual(selectedAreas, []);
  assert.equal(written.items[0]?.default, false);
});

test("runManifestConfigureWithPrompts does not dump catalog entries before the action prompt", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-menu-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      { id: "alpha", label: "Alpha", source: "owner/skills", args: ["--skill", "alpha"], default: true },
      { id: "beta", label: "Beta", source: "owner/skills", args: ["--skill", "beta"], default: false },
    ],
  }, null, 2)}\n`);
  const output: string[] = [];

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    scriptedPrompts({
      areas: [],
      actions: ["back"],
    }),
    { area: "skills" },
  );

  const text = output.join("\n");
  assert.equal(code, 0);
  assert.ok(!text.includes("Skills entries"));
  assert.ok(!text.includes("- Alpha [default]"));
  assert.ok(!text.includes("- Beta"));
});

test("runManifestConfigureWithPrompts can run one catalog action directly", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-action-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "profiles.json"), `${JSON.stringify({
    version: 1,
    mode: "strict",
    alwaysOn: [],
    items: [],
  }, null, 2)}\n`);
  const selectedActions: string[] = [];

  const code = await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir }),
    {
      ...scriptedPrompts({
        areas: ["finish"],
        actions: ["back"],
        profileModes: ["context"],
        confirms: [true],
      }),
      selectAction: async (_area, choices) => {
        selectedActions.push(...choices.map((choice) => choice.value));
        return "back";
      },
    },
    { area: "profiles", action: "set-profile-mode" },
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "profiles.json"), "utf8")) as { mode: string };
  assert.equal(code, 0);
  assert.deepEqual(selectedActions, []);
  assert.equal(written.mode, "context");
});

test("runManifestConfigureWithPrompts edits project manifests for local configure", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "afk-configure-project-"));
  const manifestDir = join(cwd, "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "rules.json"), `${JSON.stringify({
    version: 1,
    source: "github",
    url: "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/rules/AGENTS.md",
    files: [
      { source: "rules/artifacts.md", destination: "artifacts.md" },
    ],
  }, null, 2)}\n`);

  const output: string[] = [];
  const code = await runManifestConfigureWithPrompts(
    { io: captureIo(output), spawn: async () => ({ code: 0 }) },
    cliOptions({ cwd, manifestConfigureLocal: true, manifestConfigureFromCurrent: true }),
    scriptedPrompts({
      areas: ["rules", "finish"],
      actions: ["edit", "back"],
      items: ["legacy"],
      inputs: ["./AGENTS.md", "project-rules", "Project rules"],
      confirms: [true],
    }),
  );

  const written = JSON.parse(readFileSync(join(manifestDir, "rules.json"), "utf8")) as {
    version: number;
    layers: Array<{
      id: string;
      label: string;
      source: string;
      files: Array<{ source: string; destination: string }>;
    }>;
  };
  assert.equal(code, 0);
  assert.equal(written.version, 2);
  assert.equal(written.layers[0]?.id, "project-rules");
  assert.equal(written.layers[0]?.label, "Project rules");
  assert.equal(written.layers[0]?.source, "./AGENTS.md");
  assert.deepEqual(written.layers[0]?.files, [
    { source: "rules/artifacts.md", destination: "artifacts.md" },
  ]);
  assert.ok(output.join("\n").includes("Catalog changes"));
  assert.ok(output.join("\n").includes("rules.json: 1 layer added, 1 layer removed (1 → 1)"));
});

test("runManifestConfigureWithPrompts loads default hooks from the configured defaults source", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        version: 1,
        items: [
          {
            id: "remote-hook",
            label: "Remote Hook",
            description: "Loaded from defaults source.",
            source: "https://example.com/hooks/remote-hook.js",
            command: "node",
            args: ["${HOOK_FILE}"],
            events: ["stop"],
            agents: ["codex"],
            default: true,
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const output: string[] = [];
    const code = await runManifestConfigureWithPrompts(
      { io: captureIo(output), spawn: async () => ({ code: 0 }) },
      cliOptions({
        dryRun: true,
        verbose: true,
        rulesSource: "github",
        defaultsSource: "acme/dev-kit",
        defaultsSourceExplicit: true,
      }),
      scriptedPrompts({
        areas: ["hooks", "finish"],
        actions: ["add", "back"],
        confirms: [true],
      }),
    );

    const text = output.join("\n");
    assert.equal(code, 0);
    assert.ok(requestedUrls.includes("https://raw.githubusercontent.com/acme/dev-kit/main/afk/catalog/hooks.json"));
    assert.ok(text.includes("remote-hook"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runManifestConfigureWithPrompts shows boolean state in toggle choices", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-configure-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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
        invocation: "manual",
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
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
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

test("runManifestConfigureWithPrompts presents skill edit choices with branded identity and metadata", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-skill-edit-picker-"));
  const manifestDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "owner/skills",
    items: [
      {
        id: "alpha",
        label: "Alpha",
        source: "owner/skills",
        args: ["--skill", "alpha"],
        default: false,
        invocation: "manual",
        startDisabled: true,
      },
    ],
  }, null, 2)}\n`);
  const choices: Array<{ name: string; value: string; description?: string }> = [];

  await runManifestConfigureWithPrompts(
    { io: captureIo([]), spawn: async () => ({ code: 0 }) },
    cliOptions({ homeDir, dryRun: true }),
    scriptedPrompts({
      areas: [],
      actions: [],
      items: ["alpha"],
      inputs: ["owner/skills", "alpha", "alpha", "Alpha"],
      confirms: [false, false, true],
      onSelectItemChoices: (nextChoices) => choices.push(...nextChoices),
    }),
    { area: "skills", action: "edit" },
  );

  assert.equal(choices[0]?.name, "alpha");
  assert.ok(choices[0]?.description?.includes("label: Alpha"));
  assert.ok(choices[0]?.description?.includes("invocation: manual"));
  assert.ok(choices[0]?.description?.includes("startDisabled: on"));
  assert.ok(choices[0]?.description?.includes("owner/skills"));
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
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false,
    selectedMcpIds: [],
    selectedToolIds: [],
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
    homeDir: mkdtempSync(join(tmpdir(), "afk-configure-home-")),
    repoDir: process.cwd(),
    cwd: process.cwd(),
    ...overrides,
  };
}

function scriptedPrompts(script: {
  areas: Array<"rules" | "skills" | "profiles" | "agents" | "mcps" | "tools" | "hooks" | "finish">;
  actions: ManifestAction[];
  items?: string[];
  inputs?: string[];
  confirms?: boolean[];
  profileModes?: SkillProfileMode[];
  selectedItems?: string[][];
  bulkSkillSettings?: Array<"on" | "off" | "unchanged">;
  toggleValues?: Array<Record<string, boolean>>;
  onSelectItemChoices?: (choices: Array<{ name: string; value: string; description?: string }>) => void;
  onSelectItemsChoices?: (choices: Array<{ name: string; value: string; description?: string }>) => void;
  onSelectActionChoices?: (choices: Array<{ name: string; value: ManifestAction; description?: string }>) => void;
  onToggleChoices?: (choices: Array<{ name: string; value: string; enabled: boolean; description?: string }>) => void;
  onSelectBulkSkillSetting?: (message: string, onLabel: string, offLabel: string) => void;
  onConfirm?: (message: string, defaultValue: boolean) => void;
}): ManifestConfigurePrompts {
  const areas = [...script.areas];
  const actions = [...script.actions];
  const items = [...(script.items ?? [])];
  const inputs = [...(script.inputs ?? [])];
  const confirms = [...(script.confirms ?? [])];
  const profileModes = [...(script.profileModes ?? [])];
  const selectedItems = [...(script.selectedItems ?? [])];
  const bulkSkillSettings = [...(script.bulkSkillSettings ?? [])];
  const toggleValues = [...(script.toggleValues ?? [])];

  return {
    selectArea: async () => nextValue(areas, "area"),
    selectAction: async (_area, choices) => {
      script.onSelectActionChoices?.(choices);
      return nextValue(actions, "action");
    },
    selectItem: async (_area, choices) => {
      script.onSelectItemChoices?.(choices);
      return nextValue(items, "item");
    },
    selectItems: async (_area, choices) => {
      script.onSelectItemsChoices?.(choices);
      return nextValue(selectedItems, "selected items");
    },
    selectBulkSkillSetting: async (message, onLabel, offLabel) => {
      script.onSelectBulkSkillSetting?.(message, onLabel, offLabel);
      return nextValue(bulkSkillSettings, "bulk skill setting");
    },
    selectProfileMode: async () => nextValue(profileModes, "profile mode"),
    toggleBooleans: async (_area, choices) => {
      script.onToggleChoices?.(choices);
      return nextValue(toggleValues, "toggle values");
    },
    input: async () => nextValue(inputs, "input"),
    confirm: async (message, defaultValue) => {
      script.onConfirm?.(message, defaultValue);
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
