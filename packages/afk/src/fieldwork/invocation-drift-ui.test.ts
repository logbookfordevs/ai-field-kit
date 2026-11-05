import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
const source = html.slice(html.indexOf("function invocationSummary("), html.indexOf("function renderTools("));
const manual = { claude: "Manual only", codex: "Manual only" };
const automatic = { claude: "Automatic allowed", codex: "Automatic allowed" };

function render(preferences: Record<string, string>, invocation: unknown, name = "wizard") {
  const entries = [{ name, invocation, defaultInvocation: automatic }];
  const button = (label: string, action: string) => `<button data-action="${action}">${label}</button>`;
  const context = createContext({ inventory: () => entries, scope: "Global", preferences, esc: String, button, skillBulkBusy: false });
  runInContext(source, context);
  return runInContext(`({ notice: preferenceDriftNotice('${name}'), hint: preferenceHint('${name}') })`, context) as { notice: string; hint: string };
}

it("warns and offers to reapply when a saved choice is not what the skill files say", () => {
  const { notice, hint } = render({ "Global|wizard": "Manual only" }, automatic);
  expect(notice).toContain("Reapply");
  expect(notice).toContain("setPreference('wizard','Manual only')");
  expect(hint.toLowerCase()).toContain("manual only");
  expect(hint.toLowerCase()).toContain("automatic allowed");
});

it("also catches a choice that only one agent's files carry", () => {
  expect(render({ "Global|wizard": "Manual only" }, { claude: "Manual only", codex: "Automatic allowed" }).notice).toContain("Reapply");
});

it("stays quiet when the files match the saved choice or no choice is saved", () => {
  expect(render({ "Global|wizard": "Manual only" }, manual).notice).toBe("");
  expect(render({}, automatic).notice).toBe("");
  expect(render({ "Global|wizard": "Manual only" }, { claude: "Unknown", codex: "Unknown" }).notice).toBe("");
});
