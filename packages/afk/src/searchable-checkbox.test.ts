import assert from "node:assert/strict";
import { test } from "vitest";
import {
  filterSearchableCheckboxChoices,
  filterSearchableCheckboxChoicesByTerms,
  normalizeSearchableCheckboxChoices,
  renderSearchableCheckboxBody,
  selectedSearchableCheckboxValues,
  toggleAllVisibleSearchableCheckboxChoices,
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

test("filterSearchableCheckboxChoices filters by aliases and combined terms", () => {
  const choices = normalizeSearchableCheckboxChoices([
    { name: "Alpha Skill", value: "alpha", searchAliases: ["auto:on", "default:on"] },
    { name: "Beta Skill", value: "beta", searchAliases: ["auto:off", "default:off"] },
  ]);

  assert.deepEqual(filterSearchableCheckboxChoices(choices, "auto:on").map((choice) => choice.value), ["alpha"]);
  assert.deepEqual(filterSearchableCheckboxChoicesByTerms(choices, ["default:on", "auto:on"]).map((choice) => choice.value), ["alpha"]);
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

test("toggleAllVisibleSearchableCheckboxChoices selects and clears shown enabled choices", () => {
  const choices = normalizeSearchableCheckboxChoices([
    { name: "Selected Docs Skill", value: "selected", checked: true },
    { name: "Visible Review Skill", value: "visible" },
    { name: "Hidden Browser Skill", value: "hidden", checked: true },
    { name: "Disabled Review Skill", value: "disabled", disabled: true },
  ]);
  const visibleChoices = filterSearchableCheckboxChoices(choices, "review");

  const selected = toggleAllVisibleSearchableCheckboxChoices(choices, visibleChoices);
  assert.deepEqual(selectedSearchableCheckboxValues(selected), ["selected", "visible", "hidden"]);

  const cleared = toggleAllVisibleSearchableCheckboxChoices(selected, filterSearchableCheckboxChoices(selected, "review"));
  assert.deepEqual(selectedSearchableCheckboxValues(cleared), ["selected", "hidden"]);
});

test("renderSearchableCheckboxBody lets description metadata touch help text", () => {
  assert.equal(
    renderSearchableCheckboxBody({
      page: "□ alpha\n◆ □ beta",
      description: [
        "Beta helps with browser automation.",
        "",
        "Status: active · Invocation: auto",
      ].join("\n"),
      helpLine: "Use space to toggle, enter to continue.",
    }),
    [
      "□ alpha\n◆ □ beta",
      "",
      "Beta helps with browser automation.",
      "",
      "Status: active · Invocation: auto",
      "Use space to toggle, enter to continue.",
    ].join("\n"),
  );
});
