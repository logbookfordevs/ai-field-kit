import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import type { FavoriteSource } from "./settings.js";

const scripts = ["members.js", "sources.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

interface Field {
  value: string;
  innerHTML: string;
  textContent: string;
  disabled: boolean;
  hidden: boolean;
  open: boolean;
  attributes: Record<string, string>;
  focus(): void;
  setAttribute(name: string, value: string): void;
}

let context: Context;
let fields: Map<string, Field>;
let sources: FavoriteSource[];
let patch: unknown;
let discoverRequest: (data: unknown) => Promise<unknown>;
function field(id: string): Field {
  let value = fields.get(id);
  if (!value) {
    value = { value: "", innerHTML: "", textContent: "", disabled: false, hidden: false, open: false, attributes: {}, focus() {}, setAttribute(name, text) { this.attributes[name] = text; } };
    fields.set(id, value);
  }
  return value;
}
function evaluate<T>(code: string): T { return runInContext(code, context) as T; }

beforeEach(() => {
  fields = new Map();
  sources = [
    { name: "Selected", source: "owner/toolkit", skills: ["review"] },
    { name: "All", source: "owner/other" },
  ];
  patch = undefined;
  discoverRequest = async () => ({ names: ["review", "video"], descriptions: { video: "Render demo clips" } });
  context = createContext({
    $: field, favoriteSources: sources, currentSettings: { favoriteSources: sources },
    installScope: "Global", installAgent: "interactive", projects: [{ name: "Studio", path: "/work/demo studio" }], inventories: {},
    esc: (text: unknown) => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
    button: () => "", request: (_path: string, data: unknown) => discoverRequest(data),
    savePatch: async (value: unknown) => { patch = value; }, saveForm: async (action: () => Promise<void>) => action(),
    modal: () => { field("sheet").open = true; },
  });
  runInContext(scripts, context);
});

describe("favorite-source UI and copied commands", () => {
  it("generates specific names for selected bookmarks and wildcard only for all-skill bookmarks", () => {
    expect(evaluate<string>("installCommand('owner/toolkit','Global','codex',['review','video'])")).toBe("npx skills add 'owner/toolkit' --skill 'review' --skill 'video' -g --agent 'codex'");
    expect(evaluate<string>("installCommand('owner/other')")).toBe("npx skills add 'owner/other' --skill '*' -g");
    const script = evaluate<string>("installScript()");
    expect(script).toContain("'owner/toolkit' --skill 'review'");
    expect(script).toContain("'owner/other' --skill '*'");
    expect(script).not.toContain("'owner/toolkit' --skill '*'");
  });

  it("keeps project and agent targets while quoting shell-sensitive source values", () => {
    const command = evaluate<string>("installCommand(\"owner/repo'$(touch ignored)\",'Studio','claude-code',['review'])");
    expect(command).toBe("cd -- '/work/demo studio' && npx skills add 'owner/repo'\"'\"'$(touch ignored)' --skill 'review' --agent 'claude-code'");
    expect(command).not.toContain(" -g");
  });

  it.each([[], ["*"], ["review", "review"], ["--all"], ["../review"]].map(skills => ({ skills })))("never broadens an invalid selection: $skills", ({ skills }) => {
    context.badSelection = skills;
    expect(() => evaluate("installCommand('owner/toolkit','Global','interactive',badSelection)")).toThrow();
  });

  it("retains selections across name and description filtering", async () => {
    evaluate("editSource(0)"); field("sourceLink").value = "owner/toolkit";
    await evaluate<Promise<void>>("discoverSourceSkills()");
    evaluate("memberPicker.query='demo';renderMemberList();memberChanged({value:'video',checked:true})");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review", "video"]);
    expect(evaluate<string[]>("visibleMembers()")).toEqual(["video"]);
    evaluate("memberPicker.query='review';renderMemberList()");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review", "video"]);
  });

  it("groups original folders, searches their paths, and preserves selection and open folders across filtering", async () => {
    discoverRequest = async () => ({ names: ["review", "video"], descriptions: {}, paths: {
      review: "agent-skills/codex/review", video: "agent-skills/media/video",
    } });
    evaluate("editSource(0)"); field("sourceLink").value = "owner/toolkit";
    await evaluate<Promise<void>>("discoverSourceSkills()");
    expect(evaluate<string[]>("memberPicker.renderedFolders.map(folder=>folder.path)")).toEqual([
      "agent-skills", "agent-skills/codex", "agent-skills/media",
    ]);
    evaluate("memberFolderToggled(2,{isConnected:true,open:true,dataset:{folderPath:'agent-skills/media'}})");
    evaluate("memberPicker.query='agent-skills/media';renderMemberList()");
    expect(evaluate<string[]>("visibleMembers()")).toEqual(["video"]);
    evaluate("selectShownMembers();memberPicker.query='';renderMemberList()");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review", "video"]);
    expect(evaluate<boolean>("memberPicker.openFolders.get('agent-skills/media')")).toBe(true);
    expect(evaluate<string[]>("memberPicker.renderedFolders[0].members")).toEqual(["review", "video"]);
    const before=field("memberFolderCount-2").textContent;
    evaluate("memberChanged({value:'video',checked:false})");
    expect(field("memberFolderCount-2").textContent).not.toBe(before);
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review"]);
  });

  it("keeps missing paths flat and stores only selected names, without persisting discovery folders", async () => {
    discoverRequest = async () => ({ names: ["review", "video", "root"], descriptions: {}, paths: {
      video: "agent-skills/media/video", root: ".",
    } });
    evaluate("editSource(0)"); field("sourceName").value="Toolkit";field("sourceLink").value="owner/toolkit";
    await evaluate<Promise<void>>("discoverSourceSkills()");
    expect(evaluate<string[]>("memberTree(visibleMembers()).names")).toEqual(["review", "root"]);
    evaluate("memberChanged({value:'video',checked:true})");
    await evaluate<Promise<void>>("saveSource(0)");
    expect(patch).toEqual({favoriteSources:[{name:"Toolkit",source:"owner/toolkit",skills:["review","video"]},sources[1]]});
    field("sourceLink").value="owner/changed";evaluate("sourceLinkChanged()");
    expect(evaluate("sourcePicker.paths")).toEqual({});
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual([]);
  });

  it("saves only source references and selected names, without changing inventory or profiles", async () => {
    evaluate("editSource(0)"); field("sourceName").value = "Toolkit"; field("sourceLink").value = "owner/toolkit";
    await evaluate<Promise<void>>("saveSource(0)");
    expect(patch).toEqual({ favoriteSources: [{ name: "Toolkit", source: "owner/toolkit", skills: ["review"] }, sources[1]] });
    expect(sources[0]?.name).toBe("Selected");
    expect(evaluate("inventories")).toEqual({});
  });

  it("clears a selection when the source changes, and omits it when All skills is chosen", async () => {
    evaluate("editSource(0)");field("sourceLink").value = "owner/new";field("sourceName").value = "New";
    evaluate("sourceLinkChanged()");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual([]);
    expect(field("saveSource").disabled).toBe(true);
    await evaluate<Promise<void>>("saveSource(0)");expect(patch).toBeUndefined();
    evaluate("setSourceMode('all')");await evaluate<Promise<void>>("saveSource(0)");
    expect(patch).toEqual({ favoriteSources: [{ name: "New", source: "owner/new" }, sources[1]] });
  });

  it("keeps missing saved names explicit after discovery, instead of replacing them with all skills", async () => {
    discoverRequest = async () => ({ names: ["video"], descriptions: {} });
    evaluate("editSource(0)");field("sourceLink").value = "owner/toolkit";
    await evaluate<Promise<void>>("discoverSourceSkills()");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review"]);
    expect(evaluate<boolean>("sourcePicker.unavailable.has('review')")).toBe(true);
    evaluate("setSourceMode('all');setSourceMode('selected')");
    expect(evaluate<boolean>("sourcePicker.unavailable.has('review')")).toBe(true);
  });

  it("retains a saved selection when discovery fails", async () => {
    discoverRequest = async () => { throw new Error("Offline"); };
    evaluate("editSource(0)");field("sourceLink").value = "owner/toolkit";
    await evaluate<Promise<void>>("discoverSourceSkills()");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual(["review"]);
    expect(field("sourceError").textContent).toBe("Offline");
    expect(field("saveSource").disabled).toBe(false);
  });

  it.each(["success", "failure"])("ignores a late discovery %s after a newer source dialog opens", async outcome => {
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    discoverRequest = () => new Promise((accept, decline) => { resolve = accept; reject = decline; });
    evaluate("editSource(0)");field("sourceLink").value = "owner/toolkit";
    const pending = evaluate<Promise<void>>("discoverSourceSkills()");
    evaluate("editSource(1)");const before = field("sourceDiscovery").innerHTML;
    if(outcome === "success")resolve({ names: ["late"], descriptions: {} });else reject(new Error("Late failure"));
    await pending;
    expect(evaluate<string>("sourcePicker.source")).toBe("owner/other");
    expect(evaluate<string[]>("[...sourcePicker.selected]")).toEqual([]);
    expect(field("sourceDiscovery").innerHTML).toBe(before);
    expect(field("sourceError").textContent).toBe("");
  });
});
