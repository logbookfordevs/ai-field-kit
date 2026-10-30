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
  firstElementChild: { isConnected: boolean };
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
    value = { value: "", innerHTML: "", textContent: "", disabled: false, hidden: false, open: false, attributes: {}, firstElementChild: { isConnected: true }, focus() {}, setAttribute(name, text) { this.attributes[name] = text; } };
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
    $: field, URL, favoriteSources: sources, currentSettings: { favoriteSources: sources },
    installScope: "Global", installAgent: "interactive", projects: [{ name: "Studio", path: "/work/demo studio" }], inventories: {},
    esc: (text: unknown) => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
    button: (label: string) => `<button>${label}</button>`, request: (_path: string, data: unknown) => discoverRequest(data),
    savePatch: async (value: unknown) => { patch = value; }, saveForm: async (action: () => Promise<void>) => action(),
    modal: () => { field("sheet").open = true; },
  });
  runInContext(scripts, context);
});

describe("favorite-source UI and copied commands", () => {
  it.each([
    ["https://github.com/owner/repo/tree/main/skills", "https://github.com/owner/repo/tree/main/skills"],
    ["owner/repo", "https://github.com/owner/repo"],
    ["git@github.com:owner/repo.git", "https://github.com/owner/repo"],
    ["ssh://git@gitlab.com/owner/repo.git", "https://gitlab.com/owner/repo"],
    ["javascript:alert(1)", null],
    ["file:///tmp/skills", null],
    ["/tmp/skills", null],
    ["https://user:secret@example.com/repo", null],
  ])("resolves browser destinations for %s", (source, expected) => {
    context.sourceValue = source;
    expect(evaluate("sourceWebUrl(sourceValue)")).toBe(expected);
  });

  it("renders an accessible source link and retains selectable source text", () => {
    context.bookmark = { name: 'Toolkit "Review"', source: "owner/toolkit" };
    const html = evaluate<string>("sourceReference(bookmark)");
    expect(html).toContain('href="https://github.com/owner/toolkit"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('aria-label="Open source for Toolkit &quot;Review&quot; (opens in a new tab)"');
    expect(html).toContain('<code class="path">owner/toolkit</code></a>');
    expect(html).not.toContain('<svg');
    context.bookmark = { name: "Local", source: "/tmp/skills" };
    expect(evaluate<string>("sourceReference(bookmark)")).not.toContain("<a ");
  });

  it("starts a new profile from selected bookmark members without modifying or installing the source", async () => {
    let draft: unknown;
    context.createProfile = (profile: unknown) => { draft = profile; };
    context.discover = () => { throw new Error("Selected bookmarks need no discovery"); };
    const before = JSON.stringify(sources);
    await evaluate<Promise<void>>("createProfileFromSource(0)");
    expect(draft).toEqual({name:"Selected",source:"owner/toolkit",skills:["review"]});
    expect(evaluate("editing")).toBeNull();
    expect(JSON.stringify(sources)).toBe(before);
    expect(patch).toBeUndefined();
  });

  it("discovers and selects all members only for an all-skills bookmark", async () => {
    let calls = 0;
    context.createProfile = () => { context.profilePicker = {}; };
    context.discover = async () => { calls++; expect(evaluate("profilePicker.selectAllOnDiscovery")).toBe(true); };
    await evaluate<Promise<void>>("createProfileFromSource(1)");
    expect(calls).toBe(1);
    expect(sources[1]?.skills).toBeUndefined();
    expect(patch).toBeUndefined();
  });

  function renderPage(): void {
    context.scopeNames = () => ["Global"];
    context.scopeOptions = () => "";
    context.head = () => "";
    context.renderStacks = (layout: string, controls: string) => `<section data-layout="${layout}">${controls}</section>`;
    context.savedStacks ??= () => [];
    evaluate("renderSources()");
  }

  it("separates sources and stacks into tabs, keeping the layout switch for stacks only", () => {
    const before = JSON.stringify(sources);
    renderPage();
    expect(field("view").innerHTML).toContain('id="sourcesTab-sources" aria-selected="true"');
    expect(field("view").innerHTML).toContain("Copy all sources script");
    expect(field("view").innerHTML).not.toContain("data-layout");
    expect(field("view").innerHTML).not.toContain("source-view-switch");
    expect(field("sourceList").innerHTML).toContain('data-od-id="favorite-source-0"');
    expect(field("sourceList").innerHTML).toContain('data-od-id="favorite-source-1"');
    evaluate("setSourcesTab('stacks')");
    expect(field("view").innerHTML).toContain('id="sourcesTab-stacks" aria-selected="true"');
    expect(field("view").innerHTML).toContain('data-layout="list"');
    expect(field("view").innerHTML).toContain("source-view-switch");
    expect(field("view").innerHTML).not.toContain("Copy all sources script");
    evaluate("sourcesTabKey({key:'ArrowRight',preventDefault(){}})");
    expect(evaluate("sourcesTab")).toBe("sources");
    evaluate("setSourcesTab('invalid');setSourcesTab('stacks')");
    expect(evaluate("sourcesTab")).toBe("stacks");
    evaluate("setSourcesLayout('cards')");
    expect(field("view").innerHTML).toContain('data-layout="cards"');
    evaluate("setSourcesLayout('list');setSourcesLayout('invalid')");
    expect(evaluate("sourcesLayout")).toBe("list");
    expect(JSON.stringify(sources)).toBe(before);
    expect(patch).toBeUndefined();
  });

  it("lists sources alphabetically while rows keep their stored positions", () => {
    sources.push({ name: "beta", source: "owner/beta" });
    renderPage();
    const html = field("sourceList").innerHTML;
    expect(html.indexOf("favorite-source-1")).toBeLessThan(html.indexOf("favorite-source-2"));
    expect(html.indexOf("favorite-source-2")).toBeLessThan(html.indexOf("favorite-source-0"));
    expect(evaluate<string[]>("sourceLinks()")).toEqual(["https://github.com/owner/other", "https://github.com/owner/beta", "https://github.com/owner/toolkit"]);
  });

  it("filters sources by name, link, description and selected skill without changing them", () => {
    sources[1]!.description = "Video editing helpers";
    renderPage();
    for (const [query, shown, hidden] of [["video", 1, 0], ["REVIEW", 0, 1], ["owner/other", 1, 0], ["selected", 0, 1]] as const) {
      evaluate(`setSourceQuery(${JSON.stringify(query)})`);
      expect(field("sourceList").innerHTML).toContain(`favorite-source-${shown}`);
      expect(field("sourceList").innerHTML).not.toContain(`favorite-source-${hidden}`);
    }
    evaluate("setSourceQuery('nothing matches')");
    expect(field("sourceList").innerHTML).toContain("No matching sources");
    evaluate("setSourceQuery('')");
    expect(field("sourceList").innerHTML).toContain("favorite-source-1");
  });

  it("expands a selected source's skills inline and offers secondary actions in its menu", () => {
    renderPage();
    expect(field("sourceList").innerHTML).not.toContain('<li class="tag">review</li>');
    evaluate("toggleSourceSkills(0)");
    expect(field("sourceList").innerHTML).toContain('<li class="tag">review</li>');
    expect(field("sourceList").innerHTML).toContain('aria-expanded="true"');
    evaluate("toggleSourceSkills(0)");
    expect(field("sourceList").innerHTML).not.toContain('<li class="tag">review</li>');
    const menu = evaluate<string>("sourceMenu(favoriteSources[1],1)");
    for (const action of ["showInstallation('source',1,true)", "copyInstall(1)", "addSourceToStack(1)", "createProfileFromSource(1)", "editSource(1)", "removeSource(1)"]) expect(menu).toContain(action);
    expect(evaluate<string>("sourceMenu(favoriteSources[0],0)")).not.toContain("Install all skills");
  });

  it("copies browser links for the sources shown, falling back to the saved reference", async () => {
    sources.push({ name: "Local", source: "/tmp/skills" });
    let copied: [string, string] | undefined;
    context.copyText = async (text: string, label: string) => { copied = [text, label]; };
    renderPage();
    await evaluate<Promise<void>>("copySourceLinks()");
    expect(copied).toEqual(["https://github.com/owner/other\n/tmp/skills\nhttps://github.com/owner/toolkit", "All source links"]);
    evaluate("setSourceQuery('toolkit')");
    await evaluate<Promise<void>>("copySourceLinks()");
    expect(copied).toEqual(["https://github.com/owner/toolkit", "1 source link"]);
    expect(patch).toBeUndefined();
  });

  it("tags sources with the stacks that use them, matching equivalent repository references", () => {
    context.savedStacks = () => [
      { manifest: { name: "Creative", sources: [{ source: "https://github.com/owner/toolkit.git", skills: ["review"] }] } },
      { manifest: { name: "Ops", sources: [{ source: "owner/elsewhere", skills: ["deploy"] }] } },
    ];
    renderPage();
    const html = field("sourceList").innerHTML;
    expect(html.slice(html.indexOf("favorite-source-0"))).toContain(">Creative</button>");
    expect(html.slice(0, html.indexOf("favorite-source-0"))).not.toContain(">Creative</button>");
    expect(html).not.toContain(">Ops</button>");
    evaluate("setSourceQuery('creative')");
    expect(field("sourceList").innerHTML).toContain("favorite-source-0");
    expect(field("sourceList").innerHTML).not.toContain("favorite-source-1");
  });

  it("saves an optional manual description and omits it when blank", async () => {
    evaluate("editSource()");
    field("sourceName").value = "Docs";
    field("sourceLink").value = "owner/docs";
    field("sourceDescription").value = "  Writing helpers  ";
    await evaluate<Promise<void>>("saveSource(-1)");
    expect((patch as { favoriteSources: FavoriteSource[] }).favoriteSources.at(-1)).toEqual({ name: "Docs", source: "owner/docs", description: "Writing helpers" });
    evaluate("editSource()");
    field("sourceName").value = "Docs";
    field("sourceLink").value = "owner/docs";
    field("sourceDescription").value = "   ";
    await evaluate<Promise<void>>("saveSource(-1)");
    expect((patch as { favoriteSources: FavoriteSource[] }).favoriteSources.at(-1)).toEqual({ name: "Docs", source: "owner/docs" });
  });

  it("requires an explicit target before starting installation without changing copied commands", async () => {
    const requests: string[] = [];
    context.request = async (path: string) => { requests.push(path); };
    evaluate("installationTarget={kind:'source',label:'Selected',scope:'Global',source:'owner/toolkit'}");
    await evaluate<Promise<void>>("executeInstallation()");
    expect(requests).toEqual([]);
    expect(field("installationError").textContent).toBe("Choose an installation agent first.");
    expect(evaluate<string>("installCommand('owner/toolkit')")).not.toContain("--yes");
  });

  it("runs the chosen stack once and forwards its scope and agent", async () => {
    let complete: (value: unknown) => void = () => {};
    const pending = new Promise(resolve => { complete = resolve; });
    const requests: { path: string; data: unknown }[] = [];
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return pending; };
    context.savedStacks = () => [{ manifest: { id: "design", sources: [{}] } }];
    context.stackInstallSourceCount = () => 1;
    context.renderStackInstallPlan = () => {};
    context.setTimeout = () => 1;
    context.clearTimeout = () => {};
    context.refresh = async () => {};
    context.toast = () => {};
    evaluate("renderInstallation=()=>{};pollInstallation=async()=>{};installationTarget={kind:'stack',label:'Design',scope:'Studio',id:'design'}");
    field("installationAgent").value = "claude-code";
    const first = evaluate<Promise<void>>("executeInstallation()");
    await evaluate<Promise<void>>("executeInstallation()");
    expect(requests).toEqual([{ path: "stack/install", data: { id: "design", scope: "Studio", agent: "claude-code" } }]);
    complete({ code: 0 });
    await first;
  });

  it("forwards only-missing to a stack install and counts only the sources that will run", async () => {
    const requests: { path: string; data: unknown }[] = [];
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return { code: 0 }; };
    context.savedStacks = () => [{ manifest: { id: "design", sources: [{}, {}] } }];
    context.stackInstallSourceCount = () => 1;
    context.renderStackInstallPlan = () => {};
    context.setTimeout = () => 1; context.clearTimeout = () => {}; context.refresh = async () => {}; context.toast = () => {};
    let rendered: { total?: number } | undefined;
    context.renderInstallation = (value: { total?: number }) => { rendered ??= value; };
    evaluate("pollInstallation=async()=>{};installationTarget={kind:'stack',label:'Design',scope:'Studio',id:'design',onlyMissing:true}");
    field("installationAgent").value = "codex";
    await evaluate<Promise<void>>("executeInstallation()");
    expect(requests).toEqual([{ path: "stack/install", data: { id: "design", scope: "Studio", agent: "codex", onlyMissing: true } }]);
    expect(rendered?.total).toBe(1);
  });

  it("opens the install dialog on the page's destination and lets the folder change for that install only", async () => {
    const requests: { path: string; data: unknown }[] = [];
    let html = "";
    context.scopeOptions = (value: string) => `<selected ${value}>`;
    context.modal = (_title: string, body: string) => { html = body; field("sheet").open = true; };
    context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return path === "source/install" ? { code: 0 } : null; };
    context.setTimeout = () => 1; context.clearTimeout = () => {}; context.refresh = async () => {}; context.toast = () => {};
    evaluate("installScope='Studio'");
    evaluate("showInstallation('source',0)");
    expect(html).toContain('id="installationScope"');
    expect(html).toContain("<selected Studio>");
    expect(html).toContain("/work/demo studio");
    field("installationFolder");
    evaluate("setInstallationScope('Global')");
    expect(field("installationFolder").textContent).toContain("home folder");
    expect(evaluate("installScope")).toBe("Studio");
    field("installationAgent").value = "codex";
    evaluate("renderInstallation=()=>{};pollInstallation=async()=>{}");
    await evaluate<Promise<void>>("executeInstallation()");
    expect(requests.find(request => request.path === "source/install")?.data).toEqual({ source: "owner/toolkit", scope: "Global", agent: "codex" });
  });

  it("keeps selected skill names and leaves all-skill bookmarks open to the CLI picker", () => {
    expect(evaluate<string>("installCommand('owner/toolkit','Global','codex',['review','video'])")).toBe("npx skills add 'owner/toolkit' --skill 'review' --skill 'video' -g --agent 'codex'");
    expect(evaluate<string>("installCommand('owner/other')")).toBe("npx skills add 'owner/other' -g");
    const script = evaluate<string>("installScript()");
    expect(script).toContain("'owner/toolkit' --skill 'review'");
    expect(script).toContain("npx skills add 'owner/other' -g");
    expect(script).not.toContain("--skill '*'");
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

it("discovers and installs an explicit run-only selection for an all-skills bookmark", async () => {
  const requests: { path: string; data: unknown }[] = [];
  context.request = async (path: string, data: unknown) => {
    requests.push({ path, data });
    return path === "discover" ? { names: ["review", "video"], paths: { video: "media/video" } } : { code: 0 };
  };
  context.setTimeout = () => 1;context.clearTimeout = () => {};context.refresh = async () => {};context.toast = () => {};
  evaluate("installationTarget={kind:'source',label:'All',source:'owner/other',scope:'Global'};installationPicker={kind:'installation',selected:new Set(),loading:false,loaded:false};renderInstallation=()=>{};pollInstallation=async()=>{}");
  field("sheet").open = true;
  field("installationAgent").value = "codex";
  await evaluate<Promise<void>>("discoverInstallationSkills()");
  expect(field("startInstallation").disabled).toBe(true);
  await evaluate<Promise<void>>("executeInstallation()");
  expect(requests).toHaveLength(1);
  evaluate("memberChanged({value:'video',checked:true})");
  expect(field("startInstallation").disabled).toBe(false);
  await evaluate<Promise<void>>("executeInstallation()");
  expect(requests.at(-1)).toEqual({ path: "source/install", data: { source: "owner/other", scope: "Global", agent: "codex", skills: ["video"] } });
  expect(sources[1]).not.toHaveProperty("skills");
});
it("ignores installation discovery after the dialog closes", async () => {
  let resolve: (value: unknown) => void = () => {};
  context.request = () => new Promise(accept => { resolve = accept; });
  evaluate("installationTarget={kind:'source',source:'owner/other',scope:'Global'};installationPicker={kind:'installation',selected:new Set(),loading:false,loaded:false}");
  field("sheet").open = true;
  const pending = evaluate<Promise<void>>("discoverInstallationSkills()");
  field("sheet").open = false;
  resolve({ names: ["video"] });await pending;
  expect(evaluate("installationPicker.loaded")).toBe(false);
});

it("shows useful selection actions and clearing exits the selected-only view", async () => {
  evaluate("editSource(1);setSourceMode('selected')"); field("sourceLink").value = "owner/other";
  await evaluate<Promise<void>>("discoverSourceSkills()");
  evaluate("clearMembers()");
  expect(field("selectedOnlyControl").hidden).toBe(true);
  expect(field("clearSelectedMembers").hidden).toBe(true);
  evaluate("memberPicker.query='review';renderMemberList();selectShownMembers()");
  expect(evaluate<string[]>("[...memberPicker.selected]")).toEqual(["review"]);
  expect(field("selectedOnlyControl").hidden).toBe(false);
  expect(field("clearSelectedMembers").hidden).toBe(false);
  evaluate("toggleSelectedMembers()");
  expect(field("selectShownMembers").hidden).toBe(true);
  expect(evaluate("$('selectedOnly').checked")).toBe(true);
  evaluate("clearMembers();memberPicker.query='';renderMemberList()");
  expect(evaluate("memberPicker.selectedOnly")).toBe(false);
  expect(evaluate<string[]>("visibleMembers()")).toEqual(["review", "video"]);
  expect(field("selectShownMembers").hidden).toBe(false);
  expect(field("selectedOnlyControl").hidden).toBe(true);
});

it("opens install-all without discovery and keeps installation behind target confirmation", async () => {
  const requests: { path: string; data: unknown }[] = [];
  context.scopeOptions = () => "";
  context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return null; };
  evaluate("showInstallation('source',1,true)");
  expect(requests.every(request => request.path === "skills/install-state")).toBe(true);
  expect(evaluate("installationPicker")).toBeUndefined();
  field("installationAgent").value = "cursor";
  evaluate("setInstallationScope('Studio');renderInstallation=()=>{};pollInstallation=async()=>{}");
  context.setTimeout = () => 1; context.clearTimeout = () => {}; context.refresh = async () => {}; context.toast = () => {};
  context.request = async (path: string, data: unknown) => { requests.push({ path, data }); return { code: 0 }; };
  await evaluate<Promise<void>>("executeInstallation()");
  expect(requests.at(-1)).toEqual({ path: "source/install", data: { source: "owner/other", scope: "Studio", agent: "cursor" } });
  expect(sources[1]).not.toHaveProperty("skills");
});

it.each(["success", "failure"])("switches to all during discovery and ignores its late %s", async outcome => {
  let accept: (value: unknown) => void = () => {}, decline: (error: Error) => void = () => {};
  context.request = () => new Promise((resolve, reject) => { accept = resolve; decline = reject; });
  evaluate("installationTarget={kind:'source',source:'owner/other',scope:'Global',allowsAll:true};installationPicker={kind:'installation',selected:new Set(),loading:false,loaded:false}");
  field("sheet").open = true;
  const pending = evaluate<Promise<void>>("discoverInstallationSkills()");
  expect(field("startInstallation").disabled).toBe(true);
  evaluate("chooseInstallationAll()");
  const summary = field("installationSelection").innerHTML;
  expect(field("startInstallation").disabled).toBe(false);
  expect(field("startInstallation").textContent).toBe("Install all skills");
  if (outcome === "success") accept({ names: ["late"] }); else decline(new Error("Late discovery error"));
  await pending;
  expect(evaluate("installationPicker")).toBeUndefined();
  expect(field("installationSelection").innerHTML).toBe(summary);
  expect(field("installationError").textContent).toBe("");
});

it("does not allow install-all to widen a bookmark's saved selection", () => {
  context.scopeOptions = () => "";
  context.request = async () => null;
  evaluate("showInstallation('source',0,true);chooseInstallationAll()");
  expect(evaluate("installationTarget.allowsAll")).toBe(false);
  expect(field("startInstallation").textContent).not.toBe("Install all skills");
  expect(sources[0]!.skills).toEqual(["review"]);
});

it("warns on ambiguous tree URLs without rewriting the user's branch or folder", () => {
  evaluate("editSource()");
  const source = "https://github.com/logbookfordevs/atlas-skills/tree/feat/atlas-implement";
  field("sourceLink").value = source;
  evaluate("sourceLinkChanged()");
  expect(field("sourceHint").textContent).toContain("https://github.com/logbookfordevs/atlas-skills#feat/atlas-implement");
  expect(field("sourceLink").value).toBe(source);
  expect(evaluate("sourcePicker.source")).toBe(source);
  field("sourceLink").value = "https://github.com/logbookfordevs/atlas-skills#feat/atlas-implement";
  evaluate("sourceLinkChanged()");
  expect(field("sourceHint").textContent).not.toContain("reads only");
});
