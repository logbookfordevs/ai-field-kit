import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const client = readFileSync(new URL("../../web/client.js", import.meta.url), "utf8");
const source = client.slice(client.indexOf("let toolBatch;"), client.indexOf("runTool=(id,update)"));

function harness(request: (path: string, data: { id: number; update: boolean }) => Promise<unknown>) {
  const context = createContext({ tools: [{ id: 1, name: "One", install: "install-one", update: "update-one" }, { id: 2, name: "Two", install: "install-two", update: "" }], toolRuns: {}, section: "Tools", afkHome: "/sandbox", request, $: () => null, esc: String, modal() {}, button() {}, renderTools() {}, refresh: async () => {}, toast() {} });
  runInContext(source, context);
  return { context, evaluate: <T>(code: string): T => runInContext(code, context) as T };
}

it("reviews update commands with install fallback and continues after a failed tool", async () => {
  const calls: unknown[] = [];
  const app = harness(async (_path, data) => { calls.push(data); return { code: data.id === 1 ? 1 : 0, output: "result" }; });
  app.evaluate("runAllTools(true)");
  expect(app.evaluate<string[]>("toolBatch.items.map(item=>item.command)")).toEqual(["update-one", "install-two"]);
  await app.evaluate<Promise<void>>("executeToolBatch()");
  expect(calls).toEqual([{ id: 1, update: true }, { id: 2, update: true }]);
  expect(app.evaluate<number[]>("toolBatch.items.map(item=>item.code)")).toEqual([1, 0]);
  expect(app.evaluate<boolean>("toolBatch.pending")).toBe(false);
});

it("does not duplicate a batch and runs commands sequentially even when another bulk action is opened", async () => {
  let complete: (value: unknown) => void = () => {};
  const first = new Promise(resolve => { complete = resolve; });
  const calls: unknown[] = [];
  const app = harness(async (_path, data) => { calls.push(data); return data.id === 1 ? first : { code: 0, output: "done" }; });
  app.evaluate("runAllTools(false)");
  const batch = app.evaluate<Promise<void>>("executeToolBatch()");
  app.evaluate("runAllTools(true)");
  await app.evaluate<Promise<void>>("executeToolBatch()");
  expect(calls).toEqual([{ id: 1, update: false }]);
  complete({ code: 0, output: "done" });
  await batch;
  expect(calls).toEqual([{ id: 1, update: false }, { id: 2, update: false }]);
});

it("skips already-running tools without blocking the others", async () => {
  const calls: number[] = [];
  const app = harness(async (_path, data) => { calls.push(data.id); return { code: 0, output: "done" }; });
  app.evaluate("toolRuns[1]={pending:true};runAllTools(false)");
  await app.evaluate<Promise<void>>("executeToolBatch()");
  expect(calls).toEqual([2]);
  expect(app.evaluate<string>("toolBatch.items[0].status")).toBe("Skipped · already running");
});
