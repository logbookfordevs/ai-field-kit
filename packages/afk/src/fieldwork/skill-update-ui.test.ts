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
