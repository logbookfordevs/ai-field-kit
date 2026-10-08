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
  it("prefills the shared form with stack selections rather than bookmark selections", () => {
    context.currentSettings = { stacks: [{ ...stack, manifest: { ...stack.manifest, description: "Creative tools", sources: [
      { name: "Video", source: "owner/video", skills: ["edit"] },
      { name: "Unbookmarked", source: "owner/extra", skills: ["draw"] },
    ] } }] };
    evaluate("editStack(0)");
    expect(fields.stackName!.value).toBe("Studio");
    expect(fields.stackId!.value).toBe("studio");
    expect(fields.stackDescription!.value).toBe("Creative tools");
    expect(evaluate("$('stackId').readOnly")).toBe(true);
    expect(evaluate("stackDraft.choices")).toEqual([
      { name: "Video", source: "owner/video", skills: ["edit"] },
      { name: "Unbookmarked", source: "owner/extra", skills: ["draw"] },
      { name: "All", source: "owner/all", skills: [] },
    ]);
    evaluate("stackDraft.choices[0].skills.push('new')");
    expect(evaluate("savedStacks()[0].manifest.sources[0].skills")).toEqual(["edit"]);
    expect(evaluate("favoriteSources[0].skills")).toEqual(["render"]);
  });
  it("reviews form edits as a replacement and retains identity, schema and refresh origin", async () => {
    const existing = { ...stack, manifest: { ...stack.manifest, $schema: "https://example.com/schema.json", description: "Old description" } };
    context.currentSettings = { stacks: [existing] };
    context.document = { querySelectorAll: () => [{ dataset: { stackSource: "1" } }] };
    response = { stack: { manifest: { ...existing.manifest, name: "Changed" } }, expected: existing };
    evaluate("editStack(0)");
    fields.stackName!.value = "Changed";
    fields.stackId!.value = "ignored";
    fields.stackDescription!.value = "";
    evaluate("stackDraft.choices[1].skills=['new-skill'];$('sheetContent').firstElementChild={isConnected:true}");
    await evaluate<Promise<void>>("previewNewStack(stackDraft.version)");
    expect(calls).toEqual([{ path: "stack/preview", data: { id: "studio", manifest: {
      version: 1, id: "studio", name: "Changed", $schema: "https://example.com/schema.json",
      sources: [{ name: "All", source: "owner/all", skills: ["new-skill"] }],
    } } }]);
    expect(evaluate("stackDraft.stack.origin")).toBe(stack.origin);
    expect(evaluate("savedStacks()[0]")).toEqual(existing);
    expect(calls.some(call => call.path === "stack/save")).toBe(false);
  });
  it("keeps the JSON editor available and preserves the origin during its review", async () => {
    evaluate("editStackJson(0);$('stackJson');$('sheetContent').firstElementChild={isConnected:true}");
    fields.stackJson!.value = JSON.stringify(stack.manifest);
    response = { stack: { manifest: stack.manifest }, expected: stack };
    await evaluate<Promise<void>>("previewStackEdit(stackDraft.version)");
    expect(calls).toEqual([{ path: "stack/preview", data: { id: "studio", manifest: JSON.stringify(stack.manifest) } }]);
    expect(evaluate("stackDraft.stack.origin")).toBe(stack.origin);
    expect(evaluate<string>("renderStacks()")).toContain("Edit JSON");
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
