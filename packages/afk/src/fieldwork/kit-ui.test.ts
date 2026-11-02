import { readdirSync, readFileSync } from "node:fs";
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
    sourceWebUrl: (value: string) => value.startsWith("https://") ? value : `https://github.com/${value}`,
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
    expect(view.innerHTML).toContain("Nothing to sync");
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

  it("heads each group with a readable source name and its skill count, separate from the skill rows", () => {
    setStatus({ ...empty, undecided: ["one", "two"].map(name => ({ name, source: "https://github.com/me/many.git", description: "", installable: true })) });

    evaluate("renderKit()");

    expect(view.innerHTML).toMatch(/<h3[^>]*title="https:\/\/github.com\/me\/many.git"[^>]*>me\/many<\/h3><span class="meta">2 skills<\/span>/);
    expect(view.innerHTML).toContain("<code>one</code>");
  });

  it("treats two spellings of one repository as one group", () => {
    setStatus({ ...empty, undecided: [
      { name: "one", source: "me/many", description: "", installable: true },
      { name: "two", source: "https://github.com/me/many.git", description: "", installable: true },
    ] });

    evaluate("renderKit()");

    expect(view.innerHTML.match(/<h3[^>]*>me\/many<\/h3>/g)).toHaveLength(1);
    expect(view.innerHTML).toContain("2 skills");
  });

  it("says there is nothing to sync, without claiming a match, when only undecided skills remain", () => {
    setStatus({ ...empty, undecided: [{ name: "one", source: "me/many", description: "", installable: true }] });

    evaluate("renderKit()");

    expect(view.innerHTML).toContain("Nothing to sync");
    expect(view.innerHTML).not.toContain("matches");
  });

  it("offers one action for every skill from the same source", async () => {
    setStatus({ ...empty, undecided: ["one", "two"].map(name => ({ name, source: "me/many", description: "", installable: true })) });

    evaluate("renderKit()");
    expect(view.innerHTML).toContain("Add all to Core");
    await evaluate("addToKit(['one','two'],'core')");

    expect(requests).toEqual([{ path: "kit/add", data: { names: ["one", "two"], to: "core" } }]);
  });

  it("counts everything needing attention in the sync button and the tab", () => {
    setStatus({ ...empty, undecided: [{ name: "x", source: "me/x", description: "", installable: true }], plan: { install: [{ source: "me/core", skills: ["a", "b"] }], enable: ["c"], tools: [{ id: 1, name: "T", command: "x", skills: ["d"] }] } });

    expect(evaluate("planCount()")).toBe(4);
    expect(evaluate("kitAttention()")).toBe(5);
    evaluate("renderKit()");
    expect(view.innerHTML).toContain("Sync this machine · 4");
  });
});

describe("checking followed sources", () => {
  it("sends the check as a POST-able request, because the server only allows GET for a few reads", async () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: true, skills: 1 }] });
    context.section = "Kit";
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return { sources: [] }; };

    await evaluate("checkUpstream()");

    expect(requests).toEqual([{ path: "kit/upstream", data: {} }]);
  });

  it("clears the results from view without asking the server anything", () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: true, skills: 1 }] });
    context.section = "Kit";
    evaluate("kitUpstream={sources:[{source:'me/core',names:['brand-new'],descriptions:{}}]};renderKit()");
    expect(view.innerHTML).toContain("brand-new");
    expect(view.innerHTML).toContain("clearUpstream()");

    evaluate("clearUpstream()");

    expect(view.innerHTML).not.toContain("brand-new");
    expect(view.innerHTML).not.toContain("clearUpstream()");
    expect(view.innerHTML).toContain("Check now");
    expect(requests).toEqual([]);
  });

  it("offers nothing to clear before the first check or while one is running", () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: true, skills: 1 }] });

    evaluate("renderKit()");
    expect(view.innerHTML).not.toContain("clearUpstream()");

    evaluate("kitUpstream='loading';renderKit()");
    expect(view.innerHTML).not.toContain("clearUpstream()");
  });

  it("every body-less request in the web app is one the server allows as GET", () => {
    const allowedGet = new Set(["state", "rules/state", "bundle/export", "status", "app/update-check", "app/update-state"]);
    const web = new URL("../../web/", import.meta.url);
    const bodyless = readdirSync(web).filter(name => /\.(js|html)$/.test(name)).flatMap(name => [...readFileSync(new URL(name, web), "utf8").matchAll(/request\('([^']+)'\)/g)].map(match => match[1]!));

    expect(bodyless.filter(operation => !allowedGet.has(operation))).toEqual([]);
  });
});

describe("catching up", () => {
  const behind = { ...empty,
    core: [{ name: "absent", source: "me/core", follow: false, status: "missing" }, { name: "resting", source: "me/core", follow: false, status: "off" }],
    tools: [{ id: 7, name: "Waypoint", provides: ["waypoint"], missing: ["waypoint"] }],
    plan: { install: [{ source: "me/core", skills: ["absent"] }], enable: ["resting"], tools: [{ id: 7, name: "Waypoint", command: "curl x", skills: ["waypoint"] }] },
  };

  it("offers the right action on each missing row, and one for all of them", () => {
    setStatus(behind);

    evaluate("renderKit()");

    expect(view.innerHTML).toMatch(/catchUpSkill\('absent'\)[^>]*>Install</);
    expect(view.innerHTML).toMatch(/catchUpSkill\('resting'\)[^>]*>Turn on</);
    expect(view.innerHTML).toMatch(/runTool\(7,false\)[^>]*>Run install command</);
    expect(view.innerHTML).toContain("Install all…");
  });

  it("installs just that skill against the reviewed plan, then refreshes", async () => {
    context.installAgentChoice = () => "codex";
    context.section = "Kit";
    context.refresh = async () => {};
    let response: unknown = { enabled: [] };
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return response; };
    response = { enabled: [] };
    setStatus(behind);

    await evaluate("catchUpSkill('absent')");

    expect(requests).toEqual([{ path: "kit/sync", data: { expected: behind.plan, only: ["absent"], agent: "codex" } }]);
  });
});

describe("the Core tab", () => {
  it("links each source to its repository, apart from the skill names", () => {
    setStatus({ ...empty, sources: [{ source: "https://github.com/me/core", name: "Mine", follow: false, skills: 1 }], core: [{ name: "kept", source: "https://github.com/me/core", follow: false, status: "on" }] });

    evaluate("kitTab='core';renderKit()");

    expect(view.innerHTML).toMatch(/<a class="kit-source-link" href="https:\/\/github.com\/me\/core"[^>]*>me\/core/);
    expect(view.innerHTML).toContain("<code>kept</code>");
  });

  it("shows a source it cannot link to as plain text", () => {
    context.sourceWebUrl = () => null;
    setStatus({ ...empty, sources: [{ source: "git-server:core", follow: false, skills: 0 }] });

    evaluate("kitTab='core';renderKit()");

    expect(view.innerHTML).toContain('<span class="kit-source-link"');
    expect(view.innerHTML).not.toContain("<a class=");
  });
});

describe("open sections", () => {
  const twoKept = { ...empty, machineOnly: ["one", "two"] };

  it("keeps the machine-only list open while skills are released from it", () => {
    setStatus(twoKept);
    evaluate("renderKit()");
    expect(view.innerHTML).not.toMatch(/<details[^>]*\sopen>\s*<summary>2 skills kept/);

    evaluate("setKitDisclosure('machine-only',true)");
    setStatus({ ...empty, machineOnly: ["two"] });
    evaluate("renderKit()");

    expect(view.innerHTML).toMatch(/<details[^>]*\sopen>\s*<summary>1 skill kept/);
  });

  it("keeps a Core source open after dropping one of its skills", () => {
    const core = (names: string[]) => ({ ...empty, sources: [{ source: "me/core", follow: false, skills: names.length }], core: names.map(name => ({ name, source: "me/core", follow: false, status: "on" })) });
    setStatus(core(["one", "two"]));
    evaluate("kitTab='core';renderKit()");
    expect(view.innerHTML).not.toMatch(/<details[^>]*\sopen>/);

    evaluate("setKitDisclosure('me/core',true)");
    setStatus(core(["two"]));
    evaluate("renderKit()");

    expect(view.innerHTML).toMatch(/<details[^>]*\sopen>/);
  });

  it("opens a Core source with a problem, but lets you close it", () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: false, skills: 1 }], core: [{ name: "absent", source: "me/core", follow: false, status: "missing" }] });
    evaluate("kitTab='core';renderKit()");
    expect(view.innerHTML).toMatch(/<details[^>]*\sopen>/);

    evaluate("setKitDisclosure('me/core',false);renderKit()");

    expect(view.innerHTML).not.toMatch(/<details[^>]*\sopen>/);
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
