import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";

const script = readFileSync(new URL("../../web/stacks.js", import.meta.url), "utf8");
const stack = { manifest: { version: 1, id: "studio", name: "Studio", sources: [{ name: "Video", source: "owner/video", skills: ["render"] }] }, origin: "https://example.com/stack.json" };
let context: Context;
let calls: { path: string; data: unknown }[];
let fields: Record<string, { value: string; textContent: string; innerHTML: string; checked: boolean; dataset: Record<string, string>; hidden: boolean; disabled: boolean; open: boolean; firstElementChild?: { isConnected: boolean } }>;
let response: unknown;
function evaluate<T>(code: string): T { return runInContext(code, context) as T; }
beforeEach(() => {
  fields = {}; calls = []; response = { stack, expected: null };
  context = createContext({
    currentSettings: { stacks: [stack] }, favoriteSources: [{ name: "Some", source: "owner/video", skills: ["render"] }, { name: "All", source: "owner/all" }],
    installScope: "Studio", installAgent: "codex",
    $: (id: string) => fields[id] ??= { value: "", textContent: "", innerHTML: "", checked: false, dataset: {}, hidden: false, disabled: false, open: true },
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
  describe("install plan", () => {
    const planStack = { manifest: { version: 1, id: "plan", name: "Plan", sources: [
      { name: "One", source: "owner/one", skills: ["a", "b"] },
      { name: "Two", source: "owner/two", skills: ["c"] },
    ] } };
    function open(installed: { name: string; available: boolean }[]) {
      context.currentSettings = { stacks: [planStack] };
      context.inventories = { Studio: installed };
      context.installationRunning = false;
      context.installationTarget = { kind: "stack", id: "plan", scope: "Studio" };
      fields.startInstallation = { ...(fields.startInstallation ?? { value: "", textContent: "", innerHTML: "", checked: false, dataset: {}, hidden: false, open: true }), disabled: false };
      evaluate("renderStackInstallPlan(true)");
      return { target: context.installationTarget as { onlyMissing: boolean }, html: () => fields.installationPlan!.innerHTML };
    }
    it("defaults to only what is missing and skips sources that are complete", () => {
      const plan = open([{ name: "a", available: true }, { name: "b", available: false }]);
      expect(plan.target.onlyMissing).toBe(true);
      expect(fields.startInstallation!.textContent).toBe("Install 1 missing skill");
      expect(fields.installationOnlyMissing!.checked).toBe(true);
      expect(plan.html()).toContain("Installed · off"); expect(plan.html()).toContain("Skipped"); expect(plan.html()).toContain("Will install");
    });
    it("switches to replacing everything on request and back again", () => {
      const plan = open([{ name: "a", available: true }]);
      evaluate("setInstallationMode(false)");
      expect(plan.target.onlyMissing).toBe(false);
      expect(fields.startInstallation!.textContent).toBe("Install all 3 skills");
      expect(plan.html()).toContain("Will replace"); expect(plan.html()).not.toContain("Skipped");
      evaluate("setInstallationMode(true)");
      expect(fields.startInstallation!.textContent).toBe("Install 2 missing skills");
    });
    it("offers no choice when nothing is installed", () => {
      const plan = open([]);
      expect(plan.target.onlyMissing).toBe(false);
      expect(fields.installationOnlyMissing!.disabled).toBe(true); expect(fields.installationAll!.disabled).toBe(true);
      expect(fields.startInstallation!.textContent).toBe("Install 3 skills");
    });
    it("blocks installing when everything is already present unless replacing is chosen", () => {
      open([{ name: "a", available: true }, { name: "b", available: true }, { name: "c", available: true }]);
      expect(fields.startInstallation!.disabled).toBe(true); expect(fields.startInstallation!.textContent).toBe("Nothing to install");
      expect(evaluate("stackInstallBlocked()")).toBe(true);
      evaluate("setInstallationMode(false)");
      expect(fields.startInstallation!.disabled).toBe(false); expect(evaluate("stackInstallBlocked()")).toBe(false);
    });
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
  describe("adding a source to a stack", () => {
    function choose(value?: string) {
      context.document = { querySelector: () => (value === undefined ? null : { value }) };
      context.renderMembers = () => {};
      const base = context.$ as (id: string) => Record<string, unknown>;
      context.$ = (id: string) => Object.assign(base(id), { appendChild() {}, setAttribute() {} });
      response = { names: ["render", "cut"] };
    }
    it("opens the new-stack form with the source's skill picker when no stacks exist", () => {
      context.currentSettings = {};
      choose();
      evaluate("addSourceToStack(1)");
      expect(evaluate("stackDraft.activeSource")).toBe(1);
      expect(fields["stackSource-1"]!.checked).toBe(true);
      expect(evaluate("$('stackId').readOnly")).toBe(false);
      expect(evaluate("stackDraft.existing")).toBeUndefined();
    });
    it("asks which stack to use, flagging stacks that already include the source or come from a remote origin", () => {
      choose();
      evaluate("addSourceToStack(0)");
      expect(context.dialog).toContain("Studio");
      expect(context.dialog).toContain("Already includes this source");
      expect(context.dialog).toContain("Remote");
      expect(context.dialog).toContain("New stack");
    });
    it("requires a choice before continuing", () => {
      choose();
      evaluate("addSourceToStack(1)");
      evaluate("continueAddToStack(stackDraft.version)");
      expect(fields.stackError!.textContent).not.toBe("");
      expect(evaluate("stackDraft.existing")).toBeUndefined();
    });
    it("edits the chosen stack with the source preselected, without saving or touching the bookmark", () => {
      choose("0");
      evaluate("addSourceToStack(1)");
      evaluate("continueAddToStack(stackDraft.version)");
      expect(evaluate("stackDraft.existing.manifest.id")).toBe("studio");
      expect(evaluate("stackDraft.activeSource")).toBe(1);
      expect(fields["stackSource-1"]!.checked).toBe(true);
      expect(evaluate("favoriteSources[1]")).toEqual({ name: "All", source: "owner/all" });
      expect(calls.some(call => call.path === "stack/save")).toBe(false);
    });
    it("starts a new stack with the source preselected when New stack is chosen", () => {
      choose("new");
      evaluate("addSourceToStack(1)");
      evaluate("continueAddToStack(stackDraft.version)");
      expect(evaluate("stackDraft.existing")).toBeUndefined();
      expect(evaluate("stackDraft.activeSource")).toBe(1);
    });
  });
  it("builds stack groups from described bookmarks without bookmark-only fields", async () => {
    context.favoriteSources = [{ name: "Described", source: "owner/described", description: "Notes for me", skills: ["draw"] }];
    context.currentSettings = {};
    context.document = { querySelectorAll: () => [{ dataset: { stackSource: "0" } }] };
    evaluate("createStack();$('sheetContent').firstElementChild={isConnected:true}");
    fields.stackName!.value = "Art";
    fields.stackId!.value = "art";
    await evaluate<Promise<void>>("previewNewStack(stackDraft.version)");
    expect(calls).toEqual([{ path: "stack/preview", data: { manifest: { version: 1, id: "art", name: "Art", sources: [{ name: "Described", source: "owner/described", skills: ["draw"] }] } } }]);
  });
  it("offers every saved bookmark for stack selection", () => {
    evaluate("createStack()");
    expect(evaluate("stackDraft.choices")).toEqual([{ name: "Some", source: "owner/video", skills: ["render"] }, { name: "All", source: "owner/all", skills: [] }]);
  });
});
