import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  catalogSkillsLobbyChoices,
  catalogProfilesLobbyChoices,
  compassLobbyChoices,
  renderCompassLobbyIntro,
  routeForCatalogSkillsLobbyChoice,
  routeForCatalogProfilesLobbyChoice,
  routeForLobbyChoice,
  routeForSkillProfilesLobbyChoice,
  routeForSkillsLobbyChoice,
  selectSkillsLobbyRoute,
  skillProfilesLobbyChoices,
  shouldOpenCompassLobby,
  skillsLobbyChoices,
} from "./lobby.js";

const promptState = vi.hoisted(() => ({
  selectResponses: [] as string[],
  inputResponses: [] as string[],
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(async () => promptState.selectResponses.shift() ?? "skills-list"),
  input: vi.fn(async () => promptState.inputResponses.shift() ?? "logbookfordevs/ai-field-kit"),
}));

test("shouldOpenCompassLobby only opens plain afk in an interactive terminal", () => {
  assert.equal(shouldOpenCompassLobby([], {}, { stdin: true, stdout: true }), true);
  assert.equal(shouldOpenCompassLobby(["setup"], {}, { stdin: true, stdout: true }), false);
  assert.equal(shouldOpenCompassLobby([], { CI: "true" }, { stdin: true, stdout: true }), false);
  assert.equal(shouldOpenCompassLobby([], {}, { stdin: false, stdout: true }), false);
  assert.equal(shouldOpenCompassLobby([], {}, { stdin: true, stdout: false }), false);
});

test("renderCompassLobbyIntro frames the root command as a compact field check", () => {
  const text = renderCompassLobbyIntro();

  assert.ok(text.includes("AI FIELD KIT"));
  assert.ok(text.includes("Field check"));
  assert.ok(text.includes("Route preview"));
  assert.ok(text.includes("Pick an intent"));
});

test("compass lobby choices route intents to existing command paths", () => {
  assert.deepEqual(routeForLobbyChoice("setup"), ["setup"]);
  assert.deepEqual(routeForLobbyChoice("source", "acme/dev-kit"), ["refresh", "--default-source", "acme/dev-kit"]);
  assert.deepEqual(routeForLobbyChoice("refresh"), ["refresh"]);
  assert.deepEqual(routeForLobbyChoice("catalog"), ["catalog"]);
  assert.deepEqual(routeForLobbyChoice("skills"), ["setup", "skills"]);
  assert.deepEqual(routeForLobbyChoice("skill-management"), ["skills"]);
  assert.deepEqual(routeForLobbyChoice("mcps"), ["setup", "mcps"]);
  assert.deepEqual(routeForLobbyChoice("plugins"), ["setup", "plugins"]);
  assert.deepEqual(routeForLobbyChoice("hooks"), ["setup", "hooks"]);
  assert.deepEqual(routeForLobbyChoice("inspect"), ["show"]);
  assert.deepEqual(routeForLobbyChoice("skills-react"), ["show", "skills", "--react"]);
  assert.deepEqual(routeForLobbyChoice("skills-visualize"), ["show", "skills", "--visualize"]);
  assert.deepEqual(routeForLobbyChoice("catalog-import"), ["catalog", "skills", "import"]);
  assert.deepEqual(routeForLobbyChoice("help"), ["--help"]);
});

test("skills lobby choices route skill-management intents", () => {
  assert.deepEqual(routeForSkillsLobbyChoice("skills-list"), ["skills", "list"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-show"), ["skills", "show"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-open"), ["skills", "open"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-add"), ["skills", "add"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-add", {
    source: "logbookfordevs/ai-field-kit",
    mode: "normal",
  }), ["skills", "add", "logbookfordevs/ai-field-kit"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-add", {
    source: "logbookfordevs/ai-field-kit",
    mode: "start-disabled",
  }), ["skills", "add", "logbookfordevs/ai-field-kit", "--start-disabled"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-add", {
    source: "logbookfordevs/ai-field-kit",
    mode: "profile",
    profileId: "video",
  }), ["skills", "add", "logbookfordevs/ai-field-kit", "--profile", "video"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-add", {
    source: "logbookfordevs/ai-field-kit",
    mode: "profile-only",
    profileId: "video",
  }), ["skills", "add", "logbookfordevs/ai-field-kit", "--profile-only", "video"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-disable"), ["skills", "disable"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-enable"), ["skills", "enable"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-invocation"), ["skills", "invocation"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-delete"), ["skills", "delete"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-upgrade"), ["skills", "upgrade"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-categorize"), ["skills", "categorize"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-catalog-import"), ["catalog", "skills", "import"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-profiles"), ["skills", "profiles"]);
  assert.deepEqual(routeForSkillsLobbyChoice("skills-profile-status"), ["skills", "profiles", "status"]);
});

test("skills lobby prompts for a source before routing add skill", async () => {
  promptState.selectResponses = ["skills-add", "normal"];
  promptState.inputResponses = ["logbookfordevs/ai-field-kit"];

  const route = await selectSkillsLobbyRoute({
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  });

  assert.deepEqual(route, ["skills", "add", "logbookfordevs/ai-field-kit"]);
});

test("skills lobby prompts for a profile id before routing profile-only add skill", async () => {
  promptState.selectResponses = ["skills-add", "profile-only"];
  promptState.inputResponses = ["logbookfordevs/ai-field-kit", "video"];

  const route = await selectSkillsLobbyRoute({
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  });

  assert.deepEqual(route, ["skills", "add", "logbookfordevs/ai-field-kit", "--profile-only", "video"]);
});

test("skill profiles lobby choices route runtime intents", () => {
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-enable"), ["skills", "profiles", "enable"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-disable"), ["skills", "profiles", "disable"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-status"), ["skills", "profiles", "status"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-manage-definitions"), ["catalog", "profiles"]);
});

test("catalog skills lobby choices route catalog intents", () => {
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-import"), ["catalog", "skills", "import"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-import-status"), ["catalog", "skills", "import-status"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-add"), ["catalog", "skills", "add"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-edit"), ["catalog", "skills", "edit"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-remove"), ["catalog", "skills", "remove"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-toggle-default"), ["catalog", "skills", "toggle-default"]);
  assert.deepEqual(routeForCatalogSkillsLobbyChoice("catalog-skills-toggle-auto"), ["catalog", "skills", "toggle-auto"]);
});

test("catalog profiles lobby choices route definition intents", () => {
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-set-mode"), ["catalog", "profiles", "set-mode"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-toggle-always-on"), ["catalog", "profiles", "toggle-always-on"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-list"), ["catalog", "profiles", "list"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-show"), ["catalog", "profiles", "show"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-create"), ["catalog", "profiles", "create"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-edit"), ["catalog", "profiles", "edit"]);
  assert.deepEqual(routeForCatalogProfilesLobbyChoice("profiles-delete"), ["catalog", "profiles", "delete"]);
});

test("compass lobby labels stay intent-oriented while descriptions teach commands", () => {
  const labels = compassLobbyChoices.map((choice) => choice.name);
  const descriptions = compassLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Prepare this machine for agent work"));
  assert.ok(!labels.includes("Build or edit a custom field kit"));
  assert.ok(labels.includes("Change default catalog source"));
  assert.ok(labels.includes("Refresh the local catalog"));
  assert.ok(labels.includes("Edit local catalog"));
  assert.ok(labels.includes("Install skills"));
  assert.ok(labels.includes("Manage installed skills"));
  assert.ok(labels.includes("View skills as React composition"));
  assert.ok(labels.includes("Open the skills visual map"));
  assert.ok(labels.includes("Import installed skills into a catalog"));
  assert.ok(descriptions.some((description) => description.includes("afk setup skills")));
  assert.ok(descriptions.some((description) => description.includes("afk refresh --default-source")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --react")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --visualize")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import")));
  assert.ok(descriptions.some((description) => description.includes("afk show")));
});

test("skills lobby labels include catalog and profile management", () => {
  const labels = skillsLobbyChoices.map((choice) => choice.name);
  const descriptions = skillsLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Add a skill"));
  assert.ok(labels.includes("Get skill instructions"));
  assert.ok(labels.includes("Change invocation policy"));
  assert.ok(labels.includes("Import installed skills into the catalog"));
  assert.ok(labels.includes("Manage skill profiles"));
  assert.ok(labels.includes("Show profile status"));
  assert.ok(descriptions.some((description) => description.includes("afk skills add")));
  assert.ok(descriptions.some((description) => description.includes("afk skills get")));
  assert.ok(descriptions.some((description) => description.includes("afk skills invocation")));
  assert.ok(descriptions.some((description) => description.includes("Open profile list")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import")));
});

test("skill profiles lobby labels include profile actions", () => {
  const labels = skillProfilesLobbyChoices.map((choice) => choice.name);
  const descriptions = skillProfilesLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Use a profile for this request"));
  assert.ok(labels.includes("Enable a profile"));
  assert.ok(labels.includes("Disable a profile"));
  assert.ok(labels.includes("Show profile status"));
  assert.ok(labels.includes("Manage profile definitions"));
  assert.ok(descriptions.some((description) => description.includes("afk skills profiles use")));
  assert.ok(descriptions.some((description) => description.includes("afk skills profiles enable")));
  assert.ok(descriptions.some((description) => description.includes("afk skills profiles status")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog profiles")));
});

test("catalog profiles lobby labels include definition actions", () => {
  const labels = catalogProfilesLobbyChoices.map((choice) => choice.name);
  const descriptions = catalogProfilesLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Create a profile definition"));
  assert.ok(labels.includes("Edit a profile definition"));
  assert.ok(labels.includes("Delete a profile definition"));
  assert.ok(labels.includes("Set profile mode"));
  assert.ok(labels.includes("Toggle always-on skills"));
  assert.ok(descriptions.some((description) => description.includes("afk catalog profiles create")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog profiles set-mode")));
});

test("catalog skills lobby labels include catalog actions", () => {
  const labels = catalogSkillsLobbyChoices.map((choice) => choice.name);
  const descriptions = catalogSkillsLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Import installed skills"));
  assert.ok(labels.includes("Check import status"));
  assert.ok(labels.includes("Add a skill catalog item"));
  assert.ok(labels.includes("Toggle skill autoInvocation"));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import-status")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills toggle-auto")));
});
