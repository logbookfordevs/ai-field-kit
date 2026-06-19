import assert from "node:assert/strict";
import { test } from "vitest";
import { compassLobbyChoices, renderCompassLobbyIntro, routeForLobbyChoice, shouldOpenCompassLobby } from "./lobby.js";

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
  assert.deepEqual(routeForLobbyChoice("skills"), ["setup", "skills"]);
  assert.deepEqual(routeForLobbyChoice("mcps"), ["setup", "mcps"]);
  assert.deepEqual(routeForLobbyChoice("plugins"), ["setup", "plugins"]);
  assert.deepEqual(routeForLobbyChoice("hooks"), ["setup", "hooks"]);
  assert.deepEqual(routeForLobbyChoice("inspect"), ["show"]);
  assert.deepEqual(routeForLobbyChoice("skills-react"), ["show", "skills", "--react"]);
  assert.deepEqual(routeForLobbyChoice("skills-visualize"), ["show", "skills", "--visualize"]);
  assert.deepEqual(routeForLobbyChoice("catalog-import"), ["catalog", "import"]);
  assert.deepEqual(routeForLobbyChoice("help"), ["--help"]);
});

test("compass lobby labels stay intent-oriented while descriptions teach commands", () => {
  const labels = compassLobbyChoices.map((choice) => choice.name);
  const descriptions = compassLobbyChoices.map((choice) => choice.description ?? "");

  assert.ok(labels.includes("Prepare this machine for agent work"));
  assert.ok(!labels.includes("Build or edit a custom field kit"));
  assert.ok(labels.includes("Change default catalog source"));
  assert.ok(labels.includes("Refresh the local catalog"));
  assert.ok(labels.includes("View skills as React composition"));
  assert.ok(labels.includes("Open the skills visual map"));
  assert.ok(labels.includes("Import installed skills into a catalog"));
  assert.ok(descriptions.some((description) => description.includes("afk setup skills")));
  assert.ok(descriptions.some((description) => description.includes("afk refresh --default-source")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --react")));
  assert.ok(descriptions.some((description) => description.includes("afk show skills --visualize")));
  assert.ok(descriptions.some((description) => description.includes("afk catalog import")));
  assert.ok(descriptions.some((description) => description.includes("afk show")));
});
