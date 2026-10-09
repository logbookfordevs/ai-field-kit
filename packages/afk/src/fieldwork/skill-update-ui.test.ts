import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";
const source = readFileSync(new URL("../../web/client.js", import.meta.url), "utf8");
const render = source.slice(source.indexOf("function renderSkillUpdate("), source.indexOf("async function pollSkillUpdate("));
it("keeps the output disclosure open across new logs and completion, and honors closing it", () => {
  const output = {
    dataset: {} as Record<string, string>,
    initialized: false,
    details: { open: false },
    summary: { innerHTML: "" },
    log: { textContent: "" },
    set innerHTML(_value: string) { this.initialized = true; this.details = { open: false }; },
    querySelector(selector: string) {
      if (!this.initialized) return null;
      if (selector === "[data-update-summary]") return this.summary;
      if (selector === "pre") return this.log;
      return this.details;
    },
  };
  const context = createContext({ scope: "Global", $: () => output, esc: String });
  runInContext(render, context);
  const refresh = (pending: boolean, text: string): void => {
    context.result = { scope: "Global", pending, phase: pending ? "Updating through Skills CLI" : "Updated; availability preserved", output: text, ...(pending ? {} : { code: 0, updated: 1 }) };
    runInContext("renderSkillUpdate(result)", context);
  };
  refresh(true, "First log");
  output.details.open = true;
  const details = output.details;
  refresh(true, "Second log");
  expect(output.details).toBe(details);
  expect(output.details.open).toBe(true);
  expect(output.log.textContent).toBe("Second log");
  refresh(false, "Finished");
  expect(output.details.open).toBe(true);
  output.details.open = false;
  refresh(false, "Final output");
  expect(output.details.open).toBe(false);
});

it("reviews and updates only the selected skills, including selections hidden by filters", async () => {
  const requests: { operation: string; data: Record<string, unknown> }[] = [];
  let review = "";
  const context = createContext({
    scope: "Demo", esc: String, $: (id: string) => id === "sheetContent" ? { querySelector: () => null } : null,
    modal: (_title: string, body: string) => { review = body; },
    button: (label: string) => label,
    request: async (operation: string, data: Record<string, unknown>) => {
      requests.push({ operation, data });
      return operation === "skills/update" ? { scope: "Demo", code: 0, updated: 2 } : null;
    },
    refresh: async () => {}, toast() {}, setTimeout: () => 1, clearTimeout() {},
  });
  runInContext(source.slice(source.indexOf("let skillUpdateRunning=")), context);
  runInContext("const selected=['alpha','beta'];showSkillUpdate(selected);selected.push('unselected')", context);
  expect(review).toContain("2 selected skills");
  expect(review).toContain("alpha"); expect(review).toContain("beta"); expect(review).not.toContain("unselected");
  runInContext("renderSkillUpdate=()=>{}", context);
  await runInContext("executeSkillUpdate()", context);
  expect(requests.find(request => request.operation === "skills/update")?.data).toEqual({ scope: "Demo", names: ["alpha", "beta"] });
});

it("keeps updating all tracked skills distinct from updating a selection", async () => {
  const requests: Record<string, unknown>[] = [];
  const context = createContext({ scope: "Global", esc: String, $: (id: string) => id === "sheetContent" ? { querySelector: () => null } : null, modal() {}, button: String,
    request: async (operation: string, data: Record<string, unknown>) => { if (operation === "skills/update") requests.push(data); return null; },
    refresh: async () => {}, toast() {}, setTimeout: () => 1, clearTimeout() {},
  });
  runInContext(source.slice(source.indexOf("let skillUpdateRunning=")), context);
  runInContext("showSkillUpdate();renderSkillUpdate=()=>{}", context);
  await runInContext("executeSkillUpdate()", context);
  expect(requests).toEqual([{ scope: "Global" }]);
});
