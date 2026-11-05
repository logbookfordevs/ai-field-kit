import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const script = ["members.js", "sources.js", "packs.js", "install.js", "kit.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

interface Field { value: string; textContent: string; innerHTML: string; hidden: boolean; disabled: boolean; open: boolean; checked: boolean; dataset: Record<string, string>; focus(): void; setAttribute(): void; insertAdjacentHTML(_where: string, html: string): void; querySelector(): null }

let context: Context;
let fields: Map<string, Field>;
let requests: { path: string; data: Record<string, unknown> }[];
let stored: string | null;
let dialog: string;
let preview: unknown;

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }
function field(id: string): Field {
  let value = fields.get(id);
  if (!value) {
    const created: Field = { value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, open: true, checked: false, dataset: {}, focus() {}, setAttribute() {}, insertAdjacentHTML(_where, html) { created.innerHTML += html; }, querySelector() { return null; } };
    value = created;
    fields.set(id, value);
  }
  return value;
}

const candidates = [
  { name: "fresh", description: "New one", state: "new" },
  { name: "taken", description: "Elsewhere", state: "conflict", installedFrom: "someone/else" },
  { name: "owned", description: "By a tool", state: "tool", tool: "Waypoint" },
];

beforeEach(() => {
  fields = new Map(); requests = []; stored = null; dialog = ""; preview = { candidates };
  context = createContext({
    $: field, esc: String, button: (label: string) => label, scopeOptions: () => "", profiles: [{ id: "art", name: "Art", skills: [] }], projects: [], favoriteSources: [], inventories: {}, tools: [],
    modal: (_title: string, body: string) => { dialog = body; },
    localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } },
    request: async (path: string, data: Record<string, unknown>) => { requests.push({ path, data }); return path === "kit/install-preview" ? preview : { ok: true, to: data.to, status: {} }; },
    refresh: async () => {}, toast: () => {}, setInterval: () => 0, clearInterval: () => {},
  });
  runInContext(script, context);
  field("sheet").open = true;
});

async function open(options = "{source:'me/repo'}"): Promise<void> {
  field("installSource").value = "me/repo";
  await evaluate(`showInstallSkills(${options});findInstallSkills()`);
}

describe("the install dialog", () => {
  it("asks for a destination the first time instead of assuming one", async () => {
    await open();

    expect(dialog).not.toMatch(/name="installTo" value="\w+" checked/);
    evaluate("memberPicker.selected.add('fresh');updateInstallationSelection()");
    expect(field("startInstall").textContent).toBe("Choose where it goes");
    expect(field("startInstall").disabled).toBe(true);
  });

  it("remembers the last destination for next time", async () => {
    await open();

    evaluate("setInstallDestination('machine')");
    await open();

    expect(dialog).toMatch(/name="installTo" value="machine" checked/);
  });

  it("leaves tool skills out and says why, and never preselects a conflict", async () => {
    await open("{source:'me/repo',to:'core',selected:['taken','fresh']}");

    expect(evaluate("memberPicker.names.join()")).toBe("fresh,taken");
    expect(field("installSkipped").textContent).toContain("owned (Waypoint)");
    expect(evaluate("[...memberPicker.selected].join()")).toBe("fresh");
  });

  it("warns that a conflict would be replaced, and lets you read any skill first", async () => {
    await open("{source:'me/repo',to:'core'}");

    const row = evaluate<string>("installRowExtra('taken')");

    expect(row).toContain("Installed from someone/else. Installing replaces it.");
    expect(row).toContain("readInstallSkill");
  });

  it("names exactly what the button will do", async () => {
    await open("{source:'me/repo',to:'core'}");
    evaluate("memberPicker.selected.add('fresh');updateInstallationSelection()");
    expect(field("startInstall").textContent).toBe("Install 1 skill to Core");

    evaluate("setInstallDestination('machine')");
    expect(field("startInstall").textContent).toBe("Install 1 skill here");

    evaluate("setInstallDestination('pack')");
    expect(field("startInstall").textContent).toBe("Choose a pack");
    evaluate("setInstallPack('art')");
    expect(field("startInstall").textContent).toBe("Add 1 skill to the pack");
    expect(field("startInstall").disabled).toBe(false);
  });

  it("can bookmark a whole repository without choosing skills", async () => {
    field("installSource").value = "me/repo";
    evaluate("showInstallSkills({to:'later'})");

    expect(field("startInstall").textContent).toBe("Bookmark repository");
    expect(field("startInstall").disabled).toBe(false);
  });

  it("approves replacing only the conflicts you ticked", async () => {
    await open("{source:'me/repo',to:'core'}");
    evaluate("memberPicker.selected.add('fresh');memberPicker.selected.add('taken');updateInstallationSelection()");

    await evaluate("applyInstallSkills()");

    expect(requests.at(-1)).toEqual({ path: "kit/install", data: { source: "me/repo", names: ["fresh", "taken"], to: "core", agent: "universal", replace: ["taken"] } });
  });

  it("sends the chosen pack, and a new pack's name", async () => {
    await open("{source:'me/repo',to:'pack'}");
    evaluate("memberPicker.selected.add('fresh');setInstallPack('new-pack')");
    field("installPackName").value = "Fresh";
    evaluate("updateInstallationSelection()");

    await evaluate("applyInstallSkills()");

    expect(requests.at(-1)?.data).toEqual({ source: "me/repo", names: ["fresh"], to: "new-pack", packName: "Fresh" });
  });

  it("clears stale results when the repository changes", async () => {
    await open("{source:'me/repo',to:'core'}");
    evaluate("memberPicker.selected.add('fresh');updateInstallationSelection()");

    evaluate("installSourceChanged()");

    expect(field("startInstall").disabled).toBe(true);
    expect(field("startInstall").textContent).toBe("Choose skills");
  });

  it("ignores a slower answer from a repository you moved on from", async () => {
    let finish: (value: unknown) => void = () => {};
    context.request = async () => await new Promise(resolve => { finish = resolve; });
    field("installSource").value = "me/repo";
    evaluate("showInstallSkills({to:'core'})");
    const pending = evaluate<Promise<void>>("findInstallSkills()");

    evaluate("installSourceChanged()");
    finish({ candidates });
    await pending;

    expect(evaluate("installDialog.found")).toBe(false);
  });

  it("opens from a Try later bookmark with its repository and saved selection, and still asks where it goes", async () => {
    stored = JSON.stringify({ to: "later" });
    evaluate("favoriteSources=[{name:'repo',source:'me/repo',skills:['fresh','taken']}]");
    field("installSource").value = "me/repo";

    evaluate("installFromSource(0)");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(dialog).toContain('value="me/repo"');
    expect(dialog).not.toMatch(/name="installTo" value="\w+" checked/);
    expect(evaluate("[...memberPicker.selected].join()")).toBe("fresh");
    expect(field("startInstall").textContent).toBe("Choose where it goes");
    expect(field("startInstall").disabled).toBe(true);
  });

  it("keeps the destination a bookmark menu item names, such as Add to Core", async () => {
    evaluate("favoriteSources=[{name:'repo',source:'me/repo',skills:['fresh']}]");
    field("installSource").value = "me/repo";

    evaluate("installFromSource(0,'core')");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(dialog).toMatch(/name="installTo" value="core" checked/);
  });
});
