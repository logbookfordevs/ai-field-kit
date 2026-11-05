import { readdirSync, readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const script = ["kit.js", "skills.js", "agent-folders.js", "invocation-info.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

let context: Context;
let requests: { path: string; data: unknown }[];
let view: { innerHTML: string };
let dialog: string;

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }

const empty = { core: [], sources: [], tools: [], undecided: [], machineOnly: [], plan: { install: [], enable: [], tools: [] } };

function skill(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, path: `/home/.agents/skills/${name}`, owners: [], available: true, description: "", invocation: { claude: "Unknown", codex: "Unknown" }, defaultInvocation: { claude: "Unknown", codex: "Unknown" }, ...extra };
}

beforeEach(() => {
  requests = []; dialog = ""; view = { innerHTML: "" };
  const panel = { get innerHTML() { return view.innerHTML; }, set innerHTML(value: string) { view.innerHTML = value; } };
  context = createContext({
    $: (id: string) => id === "view" ? view : id === "skillsPanel" ? panel : { focus() {}, value: "", textContent: "", open: true, disabled: false, innerHTML: "", checked: false },
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    head: (title: string, _sub: string, action = "") => `<h1>${title}</h1>${action}`,
    modal: (_title: string, body: string, foot = "") => { dialog = body + foot; },
    toast: () => {}, profiles: [], favoriteSources: [], tools: [], projects: [], currentSettings: { stacks: [] },
    scope: "Global", section: "Skills", inventories: { Global: [] }, nestedInventories: {}, backupState: null, skillBulkBusy: false,
    selectedSkills: new Set<string>(), selectedSkillScope: "Global", renderSkillSelection: () => {},
    byName: (a: string, b: string) => a.localeCompare(b),
    sourceWebUrl: (value: string) => value.startsWith("https://") ? value : `https://github.com/${value}`,
    renderPacksPanel: () => "PACKS", renderSourcesPanel: () => "LATER", renderSourceList: () => {}, renderSkills: () => { view.innerHTML = "PROJECT"; },
    scopeOptions: () => "", skillActionLabel: (label: string) => label,
    preferenceHint: () => "", preferenceSelect: (name: string) => `<select data-pref="${name}"></select>`, preferenceDriftNotice: () => "",
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return {}; },
    operation: (action: () => Promise<unknown>) => action(),
    document: { querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener() {} },
  });
  runInContext(script, context);
});

function setStatus(status: unknown, skills: unknown[] = []): void {
  context.nextStatus = status;
  context.inventories = { Global: skills };
  evaluate("kitStatus=nextStatus");
}

function openTab(tab: string): string {
  evaluate(`skillsTab='${tab}';renderKit()`);
  return view.innerHTML;
}

describe("the Skills page", () => {
  it("replaces Kit and Installed Skills with five tabs, each counting its skills", () => {
    context.profiles = [{ id: "p", name: "Video", skills: ["cut"], enabled: [] }];
    context.favoriteSources = [{ name: "later", source: "me/later" }, { name: "other", source: "me/other" }];
    setStatus({ ...empty, sources: [{ source: "me/core", follow: false, skills: 2 }], core: ["a", "b"].map(name => ({ name, source: "me/core", follow: false, status: "on" })), machineOnly: ["mine"], undecided: [{ name: "loose", source: "me/loose", description: "", installable: true }] }, [skill("a"), skill("b"), skill("mine", { storage: "machine" }), skill("loose")]);

    const html = openTab("core");

    expect(html).toContain("<h1>Skills</h1>");
    const tabs = [...html.matchAll(/role="tab" id="skillsTab-(\w+)"[^>]*>([^<]+)<span class="meta">(\d+)<\/span>/g)].map(match => [match[1], match[2]!.trim(), Number(match[3])]);
    expect(tabs).toEqual([["core", "Core", 2], ["packs", "Packs", 1], ["machine", "This machine only", 1], ["later", "Try later", 2], ["review", "To review", 1]]);
  });

  it("moves between tabs with the arrow keys", () => {
    evaluate("skillsTab='core';renderKit()");
    let prevented = false;
    context.keyEvent = { key: "ArrowLeft", preventDefault() { prevented = true; } };

    evaluate("skillsTabKey(keyEvent)");

    expect(prevented).toBe(true);
    expect(evaluate("skillsTab")).toBe("review");
    expect(view.innerHTML).toContain('id="skillsTab-review" aria-selected="true"');
  });

  it("shows the Packs ledger, Try later and a project's own skills where they were", () => {
    expect(openTab("packs")).toContain("PACKS");
    expect(openTab("later")).toContain("LATER");
    context.scope = "Demo";
    expect(openTab("core")).toBe("PROJECT");
  });

  it("offers the sync and install actions, and says when there is nothing to sync", () => {
    setStatus(empty);
    expect(openTab("core")).toContain("Nothing to sync");
    expect(view.innerHTML).toContain("showInstallSkills()");

    setStatus({ ...empty, plan: { install: [{ source: "me/core", skills: ["a", "b"] }], enable: ["c"], tools: [{ id: 1, name: "T", command: "x", skills: ["d"] }] } });
    expect(openTab("core")).toContain("Sync this machine · 4");
  });

  it("filters the rows of a tab by name", () => {
    setStatus({ ...empty, machineOnly: ["alpha", "beta"] }, [skill("alpha", { storage: "machine" }), skill("beta", { storage: "machine" })]);
    evaluate("skillsTab='machine';renderKit()");

    evaluate("skillsQuery='alp';renderSkillsPanel()");

    expect(view.innerHTML).toContain("<h3>alpha</h3>");
    expect(view.innerHTML).not.toContain("<h3>beta</h3>");
  });
});

describe("the Core tab", () => {
  const core = { ...empty, sources: [{ source: "https://github.com/me/core", name: "Mine", follow: false, skills: 2 }], core: [{ name: "kept", source: "https://github.com/me/core", follow: false, status: "on" }, { name: "absent", source: "https://github.com/me/core", follow: false, status: "missing" }] };

  it("groups skills by source, with follow and update per source", () => {
    setStatus(core, [skill("kept", { storage: "library" })]);

    const html = openTab("core");

    expect(html).toMatch(/<a class="kit-source-link" href="https:\/\/github.com\/me\/core"[^>]*>me\/core/);
    expect(html).toContain("toggleFollow(0)");
    expect(html).toContain("showSkillUpdate([&quot;kept&quot;])");
    expect(html).toContain("<h3>kept</h3>");
  });

  it("gives each installed skill its switch, invocation choice, update, inspect and the rest in a menu", () => {
    setStatus(core, [skill("kept", { storage: "library" })]);

    const html = openTab("core");

    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*onclick="toggleSkill\('kept'\)"/);
    expect(html).toContain('<select data-pref="kept">');
    expect(html).toContain("showSkillUpdate('kept')");
    expect(html).toContain("inspectSkill('kept')");
    expect(html).toContain("addToPack(&#39;kept&#39;)".replaceAll("&#39;", "'"));
    expect(html).toContain("dropFromKit('kept','core')");
    expect(html).toContain("reviewSkillDeletion('kept')");
  });

  it("offers to install a Core skill missing on this machine", () => {
    setStatus(core, [skill("kept", { storage: "library" })]);

    expect(openTab("core")).toMatch(/catchUpSkill\('absent'\)[^>]*>Install</);
  });

  it("opens a source with a problem, but lets you close it", () => {
    setStatus(core, [skill("kept", { storage: "library" })]);
    expect(openTab("core")).toMatch(/<details[^>]*\sopen>/);

    evaluate("setKitDisclosure('https://github.com/me/core',false);renderKit()");

    expect(view.innerHTML).not.toMatch(/<details[^>]*\sopen>/);
  });

  it("lists tool skills and library skills without a source, so every skill has a place", () => {
    context.tools = [{ id: 7, name: "Waypoint", provides: ["waypoint"] }];
    setStatus({ ...empty, tools: [{ id: 7, name: "Waypoint", provides: ["waypoint"], missing: [] }] }, [skill("waypoint", { tool: "Waypoint", readOnly: true }), skill("handmade", { storage: "library" })]);

    const html = openTab("core");

    expect(html).toContain("<h3>waypoint</h3>");
    expect(html).toContain("runTool(7,true)");
    expect(html).not.toContain("reviewSkillDeletion('waypoint')");
    expect(html).toContain("<h3>handmade</h3>");
  });

  it("names the agents that follow the Manual/Automatic choice in its tooltip", () => {
    evaluate("agentFolderInfo={library:true,folders:[],invocationAgents:{claude:['Claude Code','Pi'],codex:['Codex']}}");
    setStatus(core, [skill("kept", { storage: "library" })]);

    const html = openTab("core");

    expect(html).toMatch(/popovertarget="invocation-info-kept"/);
    expect(html).toContain("Claude Code, Pi follow the disable-model-invocation setting in SKILL.md.");
    expect(html).toContain("Codex follows agents/openai.yaml.");
  });
});

describe("backup chips", () => {
  const chips = (): Record<string, string> => Object.fromEntries([...view.innerHTML.matchAll(/data-backup-chip="([^"]+)" data-state="\w+"[^>]*>([^<]+)</g)].map(match => [match[1]!, match[2]!]));

  beforeEach(() => {
    context.tools = [{ id: 7, name: "Waypoint", provides: ["waypoint"] }];
    context.profiles = [{ id: "p", name: "Video", skills: ["cut"], enabled: ["Global"] }];
    setStatus({ ...empty, sources: [{ source: "me/core", follow: false, skills: 3 }], core: ["pushed", "fresh", "edited"].map(name => ({ name, source: "me/core", follow: false, status: "on" })), tools: [{ id: 7, name: "Waypoint", provides: ["waypoint"], missing: [] }], machineOnly: ["mine"] },
      [skill("pushed", { storage: "library" }), skill("fresh", { storage: "library" }), skill("edited", { storage: "library" }), skill("waypoint", { tool: "Waypoint" }), skill("cut", { storage: "pack", owners: ["Video"] }), skill("mine", { storage: "machine" })]);
  });

  it("reflect the library and what the backup has pushed", () => {
    context.backupState = { status: { library: true, state: "waiting" }, unpushed: ["fresh"], attention: [{ name: "edited" }] };

    openTab("core");
    const core = chips();
    openTab("packs");
    const packs = chips();
    openTab("machine");

    expect({ ...core, ...packs, ...chips() }).toEqual({
      pushed: "Backed up", fresh: "Saved · not pushed yet", edited: "Needs attention", waypoint: "Outside library", cut: "Outside library", mine: "Not in library",
    });
  });

  it("never claim a library skill is backed up while backup is off", () => {
    context.backupState = { status: { library: true, state: "off" }, unpushed: [] };

    openTab("core");

    expect(chips().pushed).toBe("Saved · not pushed yet");
  });
});

describe("the To review tab", () => {
  const review = { ...empty, undecided: [
    { name: "found", source: "someone/found", description: "Finds things", installable: true },
    { name: "handmade", description: "", installable: false },
  ] };

  it("adds a skill to the library or keeps it on this machine through skill/adopt", async () => {
    evaluate("agentFolderInfo={library:true,folders:[]}");
    setStatus(review, [skill("found"), skill("handmade")]);
    const html = openTab("review");

    expect(html).toContain("adoptSkillInto('found','library')");
    expect(html).toContain("addToPack('found')");
    expect(html).toContain("linkToTool('handmade')");
    expect(html.indexOf("found")).toBeLessThan(html.indexOf("handmade"));
    await evaluate("adoptSkillInto('found','library')");
    await evaluate("keepSkillHere('handmade',false)");

    expect(requests).toEqual([{ path: "skill/adopt", data: { name: "found", to: "library" } }, { path: "skill/adopt", data: { name: "handmade", to: "machine" } }]);
  });

  it("can bookmark a repository when keeping its skill on this machine", async () => {
    evaluate("keepSkillHere('found',true)");
    expect(dialog).toContain("keepBookmark");

    await evaluate("adoptSkillInto('found','machine',true)");

    expect(requests).toEqual([{ path: "skill/adopt", data: { name: "found", to: "machine", bookmark: true } }]);
  });

  it("keeps the Kit choices until a library exists", () => {
    setStatus(review, [skill("found"), skill("handmade")]);

    const html = openTab("review");

    expect(html).toContain("addToKit('found','core')");
    expect(html).toContain("keepOnMachine('found')");
    expect(html).not.toContain("adoptSkillInto");
  });

  it("groups two spellings of one repository together", () => {
    setStatus({ ...empty, undecided: [
      { name: "one", source: "me/many", description: "", installable: true },
      { name: "two", source: "https://github.com/me/many.git", description: "", installable: true },
    ] });

    const html = openTab("review");

    expect(html.match(/<h3[^>]*>me\/many<\/h3>/g)).toHaveLength(1);
    expect(html).toContain("2 skills");
  });
});

describe("the This machine only tab", () => {
  it("lists kept skills with a way back to review, and skills nothing else claims", () => {
    setStatus({ ...empty, machineOnly: ["mine"] }, [skill("mine", { storage: "machine", source: "me/mine" }), skill("stray", { available: false })]);

    const html = openTab("machine");

    expect(html).toContain("keepOnMachine('mine',false)");
    expect(html).toContain("addToKit('mine','core')");
    expect(html).toContain("<h3>stray</h3>");
  });
});

describe("checking followed sources", () => {
  it("sends the check as a POST-able request", async () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: true, skills: 1 }] });
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return { sources: [] }; };

    await evaluate("checkUpstream()");

    expect(requests).toEqual([{ path: "kit/upstream", data: {} }]);
  });

  it("clears the results from view without asking the server anything", () => {
    setStatus({ ...empty, sources: [{ source: "me/core", follow: true, skills: 1 }] });
    evaluate("kitUpstream={sources:[{source:'me/core',names:['brand-new'],descriptions:{}}]};skillsTab='core';renderKit()");
    expect(view.innerHTML).toContain("brand-new");

    evaluate("clearUpstream()");

    expect(view.innerHTML).not.toContain("brand-new");
    expect(view.innerHTML).toContain("Check now");
    expect(requests).toEqual([]);
  });

  it("every body-less request in the web app is one the server allows as GET", () => {
    const allowedGet = new Set(["state", "rules/state", "bundle/export", "status", "app/update-check", "app/update-state"]);
    const web = new URL("../../web/", import.meta.url);
    const bodyless = readdirSync(web).filter(name => /\.(js|html)$/.test(name)).flatMap(name => [...readFileSync(new URL(name, web), "utf8").matchAll(/request\('([^']+)'\)/g)].map(match => match[1]!));

    expect(bodyless.filter(operation => !allowedGet.has(operation))).toEqual([]);
  });
});

describe("catching up and syncing", () => {
  const behind = { ...empty,
    core: [{ name: "absent", source: "me/core", follow: false, status: "missing" }],
    sources: [{ source: "me/core", follow: false, skills: 1 }],
    plan: { install: [{ source: "me/core", skills: ["absent"] }], enable: [], tools: [{ id: 7, name: "Waypoint", command: "curl waypoint.sh | bash", skills: ["waypoint"] }] },
  };

  it("installs just that skill against the reviewed plan, then refreshes", async () => {
    context.installAgentChoice = () => "codex";
    context.refresh = async () => {};
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return { enabled: [] }; };
    setStatus(behind);

    await evaluate("catchUpSkill('absent')");

    expect(requests).toEqual([{ path: "kit/sync", data: { expected: behind.plan, only: ["absent"], agent: "codex" } }]);
  });

  it("shows every tool's exact command, unticked, before anything runs", () => {
    setStatus(behind);

    evaluate("reviewSync()");

    expect(dialog).toContain("curl waypoint.sh | bash");
    expect(dialog).not.toMatch(/data-sync-tool="7"[^>]*checked/);
    expect(requests).toEqual([]);
  });
});
