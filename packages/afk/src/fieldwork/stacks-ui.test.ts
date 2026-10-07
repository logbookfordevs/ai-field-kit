import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";

const script = readFileSync(new URL("../../web/stacks.js", import.meta.url), "utf8");
const stack = { manifest: { version: 1, id: "studio", name: "Studio", sources: [{ name: "Video", source: "owner/video", skills: ["render"] }] }, origin: "https://example.com/stack.json" };
let context: Context;
let calls: { path: string; data: unknown }[];
let fields: Record<string, { value: string; textContent: string; hidden: boolean; disabled: boolean; open: boolean; firstElementChild?: { isConnected: boolean } }>;
let response: unknown;
function evaluate<T>(code: string): T { return runInContext(code, context) as T; }
beforeEach(() => {
  fields = {}; calls = []; response = { stack, expected: null };
  context = createContext({
    currentSettings: { stacks: [stack] }, favoriteSources: [{ name: "Some", source: "owner/video", skills: ["render"] }, { name: "All", source: "owner/all" }],
    installScope: "Studio", installAgent: "codex",
    $: (id: string) => fields[id] ??= { value: "", textContent: "", hidden: false, disabled: false, open: true },
    esc: (value: unknown) => String(value).replaceAll("<", "&lt;"), button: (label: string) => `<button>${label}</button>`,
    modal: (_title: string, body: string) => { context.dialog = body; },
    request: async (path: string, data: unknown) => { calls.push({ path, data }); return response; },
    saveForm: (action: () => Promise<unknown>) => action(), copyText: async (value: string) => { context.copied = value; }, toast: (value: string) => { context.notice = value; },
  });
  runInContext(script, context);
});
describe("stack management interface", () => {
  it("shows skills grouped by their original source, with remote refresh separate from installation", () => {
    const html = evaluate<string>("renderStacks()");
    expect(html).toContain("owner/video"); expect(html).toContain("render"); expect(html).toContain("Refresh manifest"); expect(html).toContain("Copy install script");
  });
  it("imports pasted JSON and URL through the same explicit review without saving", async () => {
    evaluate("importStack();$('stackJson')"); fields.stackJson!.value = JSON.stringify(stack.manifest);
    await evaluate<Promise<void>>("previewStackInput(stackDialogVersion)");
    expect(calls).toEqual([{ path: "stack/preview", data: { manifest: JSON.stringify(stack.manifest) } }]);
    expect(evaluate("stackDraft")).toEqual(response);
    expect(calls.some(call => call.path === "stack/save")).toBe(false);
    evaluate("importStack();setStackInput('url');$('stackUrl')"); fields.stackUrl!.value = stack.origin;
    await evaluate<Promise<void>>("previewStackInput(stackDialogVersion)");
    expect(calls.at(-1)).toEqual({ path: "stack/preview", data: { origin: stack.origin } });
  });
  it("saves only the reviewed proposal and preserves exact stale-change expectations", async () => {
    response = { stack: { ...stack, manifest: { ...stack.manifest, name: "Changed" } }, expected: stack };
    context.proposal = response; evaluate("reviewStack(proposal)");
    expect(context.dialog).toContain("Currently saved"); expect(context.dialog).toContain("Proposed");
    await evaluate<Promise<void>>("saveReviewedStack()");
    expect(calls).toEqual([{ path: "stack/save", data: response }]);
  });
  it("copies a stack script for the selected destination and agent without running it", async () => {
    response = { script: "#!/bin/sh\nnpx skills add 'owner/video' --skill 'render'" };
    await evaluate<Promise<void>>("copyStack(0)");
    expect(calls).toEqual([{ path: "stack/script", data: { id: "studio", scope: "Studio", agent: "codex" } }]);
    expect(context.copied).toBe((response as { script: string }).script);
  });
  it("keeps local edits unchanged during remote review", async () => {
    response = { stack: { ...stack, manifest: { ...stack.manifest, name: "Remote" } }, expected: stack };
    await evaluate<Promise<void>>("refreshStack(0)");
    expect(calls).toEqual([{ path: "stack/preview", data: { id: "studio", origin: stack.origin } }]);
    expect(evaluate<string>("savedStacks()[0].manifest.name")).toBe("Studio");
  });
  it("ignores a late response after another dialog replaces the importing form", async () => {
    evaluate("importStack();$('stackJson');$('sheetContent')"); fields.stackJson!.value = JSON.stringify(stack.manifest);
    const body = { isConnected: true }; fields.sheetContent!.firstElementChild = body;
    let resolve!: (value: unknown) => void;
    context.request = () => new Promise(accept => { resolve = accept; });
    const pending = evaluate<Promise<void>>("previewStackInput(stackDialogVersion)");
    body.isConnected = false; context.dialog = "Other dialog";
    resolve({ stack, expected: null }); await pending;
    expect(context.dialog).toBe("Other dialog");
  });
  it("offers every saved bookmark for stack selection", () => {
    evaluate("createStack()");
    expect(evaluate("stackDraft.choices")).toEqual([{ name: "Some", source: "owner/video", skills: ["render"] }, { name: "All", source: "owner/all", skills: [] }]);
  });
});
