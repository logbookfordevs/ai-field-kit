import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const script = ["kit.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

let context: Context;
let requests: { path: string; data: unknown }[];
let view: { innerHTML: string };
let dialog: string;

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }

const empty = { core: [], sources: [], tools: [], undecided: [], machineOnly: [], plan: { install: [], enable: [], tools: [] } };

beforeEach(() => {
  requests = []; dialog = ""; view = { innerHTML: "" };
  context = createContext({
    $: (id: string) => id === "view" ? view : { focus() {}, value: "", textContent: "", open: true, disabled: false, innerHTML: "" },
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    head: (title: string, _sub: string, action = "") => `<h1>${title}</h1>${action}`,
    modal: (_title: string, body: string) => { dialog = body; },
    toast: () => {}, profiles: [], favoriteSources: [], tools: [], currentSettings: { stacks: [] },
    byName: (a: string, b: string) => a.localeCompare(b),
    renderPacksPanel: () => "PACKS", renderSourcesPanel: () => "LATER", renderSourceList: () => {}, repositoryName: (value: string) => value,
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return {}; },
    operation: (action: () => Promise<unknown>) => action(),
    document: { querySelectorAll: () => [] },
  });
  runInContext(script, context);
});

function setStatus(status: unknown): void {
  context.nextStatus = status;
  evaluate("kitStatus=nextStatus");
}

describe("the Kit page", () => {
  it("says the machine matches and disables sync when there is nothing to do", () => {
    setStatus({ ...empty, core: [{ name: "kept", source: "me/core", follow: false, status: "on" }], sources: [{ source: "me/core", follow: false, skills: 1 }] });

    evaluate("renderKit()");

    expect(view.innerHTML).toContain("This machine matches your kit");
    expect(view.innerHTML).toMatch(/This machine matches<\/button>|disabled[^>]*>This machine matches/);
  });

  it("invites a new user to build a kit instead of claiming a match", () => {
    setStatus(empty);

    evaluate("renderKit()");

    expect(view.innerHTML).toContain("Your kit is empty");
  });

  it("offers the kit choices for an installable skill and only linking for one that isn't", () => {
    setStatus({ ...empty, undecided: [
      { name: "found", source: "someone/found", description: "", installable: true },
      { name: "handmade", description: "", installable: false },
    ] });

    evaluate("renderKit()");

    expect(view.innerHTML).toContain("addToKit('found','core')");
    expect(view.innerHTML).toContain("addToPack('found')");
    expect(view.innerHTML).toContain("keepOnMachine('found')");
    expect(view.innerHTML).toContain("linkToTool('handmade')");
    expect(view.innerHTML).not.toContain("addToKit('handmade'");
    expect(view.innerHTML.indexOf("found")).toBeLessThan(view.innerHTML.indexOf("handmade"));
  });

  it("offers one action for every skill from the same source", async () => {
    setStatus({ ...empty, undecided: ["one", "two"].map(name => ({ name, source: "me/many", description: "", installable: true })) });

    evaluate("renderKit()");
    expect(view.innerHTML).toContain("Add all to Core");
    await evaluate("addToKit(['one','two'],'core')");

    expect(requests).toEqual([{ path: "kit/add", data: { names: ["one", "two"], to: "core" } }]);
  });

  it("counts everything needing attention in the sync button and the tab", () => {
    setStatus({ ...empty, undecided: [{ name: "x", description: "", installable: true }], plan: { install: [{ source: "me/core", skills: ["a", "b"] }], enable: ["c"], tools: [{ id: 1, name: "T", command: "x", skills: ["d"] }] } });

    expect(evaluate("planCount()")).toBe(4);
    expect(evaluate("kitAttention()")).toBe(5);
    evaluate("renderKit()");
    expect(view.innerHTML).toContain("Sync this machine · 4");
  });
});

describe("the sync review", () => {
  it("shows every tool's exact command, unticked, before anything runs", () => {
    setStatus({ ...empty, plan: { install: [{ source: "me/core", skills: ["a"] }], enable: [], tools: [{ id: 7, name: "Waypoint", command: "curl waypoint.sh | bash", skills: ["waypoint"] }] } });

    evaluate("reviewSync()");

    expect(dialog).toContain("curl waypoint.sh | bash");
    expect(dialog).toContain('data-sync-tool="7"');
    expect(dialog).not.toMatch(/data-sync-tool="7"[^>]*checked/);
    expect(requests).toEqual([]);
  });
});
