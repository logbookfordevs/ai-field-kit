import assert from "node:assert/strict";
import { test } from "vitest";
import {
  filterSearchableCheckboxChoices,
  normalizeSearchableCheckboxChoices,
  selectedSearchableCheckboxValues,
  toggleSearchableCheckboxChoice,
} from "./searchable-checkbox.js";

test("filterSearchableCheckboxChoices filters by name, short label, and description", () => {
  const choices = normalizeSearchableCheckboxChoices([
    { name: "Alpha Skill", short: "alpha", description: "Docs helper", value: "alpha" },
    { name: "Beta Skill", short: "beta", description: "Review helper", value: "beta" },
  ]);

  assert.deepEqual(filterSearchableCheckboxChoices(choices, "docs").map((choice) => choice.value), ["alpha"]);
  assert.deepEqual(filterSearchableCheckboxChoices(choices, "beta skill").map((choice) => choice.value), ["beta"]);
});

test("toggleSearchableCheckboxChoice keeps selection state outside filtered results", () => {
  const choices = normalizeSearchableCheckboxChoices([
    { name: "Alpha Skill", description: "Docs helper", value: "alpha" },
    { name: "Beta Skill", description: "Review helper", value: "beta" },
  ]);
  const selectedAlpha = toggleSearchableCheckboxChoice(choices, 0);
  const betaOnly = filterSearchableCheckboxChoices(selectedAlpha, "review");

  assert.deepEqual(betaOnly.map((choice) => choice.value), ["beta"]);
  assert.deepEqual(selectedSearchableCheckboxValues(selectedAlpha), ["alpha"]);
});

test("toggleSearchableCheckboxChoice ignores disabled choices", () => {
  const choices = normalizeSearchableCheckboxChoices([
    { name: "Disabled Skill", value: "disabled", disabled: true },
  ]);

  assert.deepEqual(selectedSearchableCheckboxValues(toggleSearchableCheckboxChoice(choices, 0)), []);
});
