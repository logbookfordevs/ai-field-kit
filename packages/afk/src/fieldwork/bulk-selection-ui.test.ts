import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const client = readFileSync(new URL("../../web/client.js", import.meta.url), "utf8");
const selectionScript = client.slice(client.indexOf("let selectedSkills="));
const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
const setScopeScript = html.slice(html.indexOf("function setScope("), html.indexOf("function renderSkillList("));
function fixture() {
  const fields: Record<string, { innerHTML: string; disabled: boolean; focus(): void }> = {
    skillSelection: { innerHTML: "", disabled: false, focus() {} }, scopeSelect: { innerHTML: "", disabled: false, focus() {} },
  };
  const context = createContext({
    scope: "Global", query: "", invocationFilter: "", sourceFilter: "",
    inventory: () => [{ name: "alpha", invocation: { mode: "manual" } }, { name: "beta", invocation: { mode: "auto" } }],
    invocationSummary: (policy: { mode: string }) => policy.mode,
    matchesSkillFilters: (entry: { name: string }) => entry.name.includes(String(context.query)),
    renderSkillList() {}, render() {}, document: { querySelector() { return { focus() {} }; } },
    esc: String, button: (label: string) => label, $: (id: string) => fields[id],
  });
  runInContext(selectionScript + setScopeScript, context);
  return { context, fields };
}
it("selects only shown skills and retains selections while filtering", () => {
  const { context, fields } = fixture();
  runInContext("query='alp';selectShownSkills();query='beta';renderSkillSelection(inventory().filter(skill=>skill.name==='beta'))", context);
  expect(Array.from(runInContext("[...selectedSkills]", context))).toEqual(["alpha"]);
  expect(fields.skillSelection?.innerHTML).toContain("1 selected · 1 hidden by filters");
  runInContext("selectShownSkills()", context);
  expect(Array.from(runInContext("[...selectedSkills]", context))).toEqual(["alpha", "beta"]);
});
it("clears selection when changing scope and when explicitly requested", () => {
  const { context } = fixture();
  runInContext("selectShownSkills();setScope('Demo')", context);
  expect(runInContext("selectedSkills.size", context)).toBe(0);
  runInContext("selectShownSkills();clearSkillSelection()", context);
  expect(runInContext("selectedSkills.size", context)).toBe(0);
});
it("keeps successful non-destructive selections for another action", () => {
  const { context } = fixture();
  context.toast = () => {};
  runInContext("selectShownSkills();showSkillBulkResult({items:[{name:'alpha',ok:true},{name:'beta',ok:true}],completed:2,failed:0},'Global')", context);
  expect(runInContext("selectedSkills.size", context)).toBe(2);
});

function deletionFixture() {
  const { context, fields } = fixture();
  const sheet = { open: false };
  const content = { firstElementChild: {} };
  Object.assign(fields, { sheet, sheetContent: content });
  const dialogs: string[] = [];
  let requests = 0;
  let resolveReview!: (value: unknown) => void;
  context.modal = (title: string) => { dialogs.push(title); sheet.open = true; content.firstElementChild = {}; };
  context.toast = () => {};
  context.request = () => { requests++; return new Promise(resolve => { resolveReview = resolve; }); };
  runInContext("selectShownSkills()", context);
  const result = { scope: "Global", names: ["alpha", "beta"], items: [{ name: "alpha", error: "Blocked" }, { name: "beta", error: "Blocked" }] };
  return { context, sheet, content, dialogs, requests: () => requests, finish: () => resolveReview(result) };
}

it("opens a loading review immediately and ignores repeat clicks while checking deletion", async () => {
  const test = deletionFixture();
  const pending = runInContext("reviewBulkSkillDeletion()", test.context);
  expect(test.dialogs).toEqual(["Review selected deletions"]);
  await runInContext("reviewBulkSkillDeletion()", test.context);
  expect(test.requests()).toBe(1);
  test.finish();
  await pending;
  expect(test.dialogs).toEqual(["Review selected deletions", "Delete selected skills?"]);
  expect(runInContext("skillBulkBusy", test.context)).toBe(false);
});

it("does not reopen a dismissed review or replace a newer dialog after delayed checks", async () => {
  for (const newerDialog of [false, true]) {
    const test = deletionFixture();
    const pending = runInContext("reviewBulkSkillDeletion()", test.context);
    if (newerDialog) test.content.firstElementChild = {};
    else test.sheet.open = false;
    test.finish();
    await pending;
    expect(test.dialogs).toEqual(["Review selected deletions"]);
    expect(runInContext("bulkDeleteReview", test.context)).toBeUndefined();
    expect(runInContext("skillBulkBusy", test.context)).toBe(false);
  }
});
