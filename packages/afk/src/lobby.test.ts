import assert from "node:assert/strict";
import { test } from "vitest";
import {
  catalogProfilesLobbyChoices,
  compassLobbyChoices,
  renderCompassLobbyIntro,
  routeForCatalogProfilesLobbyChoice,
  routeForLobbyChoice,
  routeForSkillProfilesLobbyChoice,
  routeForSkillsLobbyChoice,
  skillProfilesLobbyChoices,
  shouldOpenCompassLobby,
  skillsLobbyChoices,
} from "./lobby.js";

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
  assert.deepEqual(routeForLobbyChoice("configure"), ["config"]);
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

test("skill profiles lobby choices route runtime intents", () => {
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-enable"), ["skills", "profiles", "enable"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-disable"), ["skills", "profiles", "disable"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-status"), ["skills", "profiles", "status"]);
  assert.deepEqual(routeForSkillProfilesLobbyChoice("profiles-manage-definitions"), ["catalog", "profiles"]);
});

test("catalog profiles lobby choices route definition intents", () => {
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
  assert.ok(descriptions.some((description) => description.includes("afk config")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --react")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --visualize")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import")));
  assert.ok(descriptions.some((description) => description.includes("afk show")));
});

test("skills lobby labels include catalog and profile management", () => {
  const labels = skillsLobbyChoices.map((choice) => choice.name);
  const descriptions = skillsLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Add a skill"));
  assert.ok(labels.includes("Change invocation policy"));
  assert.ok(labels.includes("Import installed skills into the catalog"));
  assert.ok(labels.includes("Manage skill profiles"));
  assert.ok(labels.includes("Show profile status"));
  assert.ok(descriptions.some((description) => description.includes("afk skills add")));
  assert.ok(descriptions.some((description) => description.includes("afk skills invocation")));
  assert.ok(descriptions.some((description) => description.includes("Open profile list")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog skills import")));
});

test("skill profiles lobby labels include profile actions", () => {
  const labels = skillProfilesLobbyChoices.map((choice) => choice.name);
  const descriptions = skillProfilesLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Enable a profile"));
  assert.ok(labels.includes("Disable a profile"));
  assert.ok(labels.includes("Show profile status"));
  assert.ok(labels.includes("Manage profile definitions"));
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
  assert.ok(descriptions.some((description) => description.includes("afk catalog profiles create")));
});
