import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const scripts = ["members.js", "sources.js", "packs.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

function setup() {
  const fields = new Map<string, { value: string; textContent: string; innerHTML: string; hidden: boolean; checked: boolean; open: boolean; firstElementChild: { isConnected: boolean }; attributes: Record<string, string>; parentId?: string; appendChild(child: { parentId?: string }): void; setAttribute(name: string, value: string): void; insertAdjacentHTML(position: string, html: string): void; focus(): void }>();
  const field = (id: string) => {
    if (!fields.has(id)) fields.set(id, { value: "", textContent: "", innerHTML: "", hidden: false, checked: false, open: true, firstElementChild: { isConnected: true }, attributes: {}, appendChild(child) { child.parentId = id; }, setAttribute(name, value) { this.attributes[name] = value; }, insertAdjacentHTML(_position, html) { this.innerHTML += html; }, focus() {} });
    return fields.get(id)!;
  };
  const sources = [{ name: "Selected", source: "owner/one", skills: ["review"] }, { name: "All", source: "owner/two" }];
  const requests: { path: string; data: unknown }[] = [];
  let markup = "";
  const context = createContext({
    $: field, favoriteSources: sources, profiles: [], esc: String, button: () => "", inventories: {}, saveForm: (action: () => Promise<unknown>) => action(),
    modal: (_title: string, html: string) => { markup = html; },
    document: { querySelectorAll: () => [{ dataset: { packSource: "1" } }] },
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return { names: ["video", "review"], paths: { video: "media/video", review: "qa/review" } }; },
  });
  runInContext(scripts, context);
  const run = <T>(code: string): T => runInContext(code, context) as T;
  run("openPackForm()");
  return { run, context, sources, requests, field, markup: () => markup };
}

describe("pack source picker", () => {
  it("lists all bookmarks and previews only the selected skills without modifying bookmarks", async () => {
    const ui = setup();
    expect(ui.markup()).toContain("Selected");
    expect(ui.markup()).toContain("All");
    await ui.run<Promise<void>>("choosePackSkills(1)");
    ui.run("memberChanged({value:'video',checked:true})");
    ui.field("packName").value = "Video";
    await ui.run<Promise<void>>("savePackForm(packDraft.version)");
    expect(ui.requests.at(-1)).toEqual({ path: "pack/save", data: { name: "Video", description: "", groups: [{ source: "owner/two", skills: ["video"] }], sourceNames: { "owner/two": "All" } } });
    expect(ui.sources[1]).not.toHaveProperty("skills");
    await ui.run<Promise<void>>("choosePackSkills(0)");
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
  });

  it("places the shared picker under the chosen source and retains selections when switching", async () => {
    const ui = setup();
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.field("packSkillSelection").parentId).toBe("packSkillSlot-1");
    expect(ui.field("packChooseSkills-1").attributes["aria-expanded"]).toBe("true");
    ui.run("memberChanged({value:'video',checked:true})");
    await ui.run<Promise<void>>("choosePackSkills(0)");
    expect(ui.field("packSkillSelection").parentId).toBe("packSkillSlot-0");
    expect(ui.field("packChooseSkills-1").attributes["aria-expanded"]).toBe("false");
    expect(ui.field("packChooseSkills-0").attributes["aria-expanded"]).toBe("true");
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.field("packSkillSelection").parentId).toBe("packSkillSlot-1");
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
    expect(ui.requests).toHaveLength(2);
  });

  it("keeps the picker at the latest source when discovery resolves out of order", async () => {
    const ui = setup();
    const pending = new Map<string, (value: unknown) => void>();
    ui.context.request = (_path: string, data: { source: string }) => new Promise(resolve => pending.set(data.source, resolve));
    const first = ui.run<Promise<void>>("choosePackSkills(0)");
    const second = ui.run<Promise<void>>("choosePackSkills(1)");
    pending.get("owner/two")!({ names: ["video"] });
    await second;
    pending.get("owner/one")!({ names: ["review"] });
    await first;
    expect(ui.field("packSkillSelection").parentId).toBe("packSkillSlot-1");
    expect(ui.run<number>("memberPicker.index")).toBe(1);
    expect(ui.run<string[]>("memberPicker.names")).toEqual(["video"]);
  });

  it("flattens the top-level skills folder while preserving nested folders and original-path search", async () => {
    const ui = setup();
    ui.context.request = async () => ({ names: ["review", "video", "other"], paths: {
      review: "skills/review", video: "skills/media/video", other: "examples/skills/other",
    } });
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.run<string[]>("memberTree(visibleMembers()).names")).toEqual(["review"]);
    expect(ui.run<string[]>("memberPicker.renderedFolders.map(folder=>folder.path)")).toEqual(["examples", "examples/skills", "media"]);
    expect(ui.run<string>("memberPicker.paths.video")).toBe("skills/media/video");
    ui.run("memberPicker.query='skills/media';renderMemberList();selectShownMembers()");
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
    ui.run("memberPicker.query='';renderMemberList()");
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
    expect(ui.field("packSourceCount-1").textContent).toBe("1 skills");
    expect(ui.sources[1]).not.toHaveProperty("skills");
  });

  it("hides an unchecked source's picker and restores its selection when checked again", async () => {
    const ui = setup();
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.field("packSource-1").checked).toBe(true);
    ui.run("memberChanged({value:'video',checked:true});packSourceChanged(1,false)");
    expect(ui.field("packSkillSelection").hidden).toBe(true);
    expect(ui.field("packChooseSkills-1").attributes["aria-expanded"]).toBe("false");
    await ui.run<Promise<void>>("packSourceChanged(1,true)");
    expect(ui.field("packSkillSelection").hidden).toBe(false);
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
    expect(ui.requests).toHaveLength(1);
    ui.run("packSourceChanged(0,false)");
    expect(ui.field("packSkillSelection").hidden).toBe(false);
  });

  it("keeps the picker hidden if discovery finishes after the source is unchecked", async () => {
    const ui = setup();
    let finish: (value: unknown) => void = () => {};
    ui.context.request = () => new Promise(resolve => { finish = resolve; });
    const pending = ui.run<Promise<void>>("choosePackSkills(1)");
    ui.run("packSourceChanged(1,false)");
    finish({ names: ["video"] });
    await pending;
    expect(ui.field("packSkillSelection").hidden).toBe(true);
    expect(ui.field("packChooseSkills-1").attributes["aria-expanded"]).toBe("false");
    expect(ui.run<number>("packDraft.pickers.size")).toBe(1);
    await ui.run<Promise<void>>("packSourceChanged(1,true)");
    expect(ui.field("packSkillSelection").hidden).toBe(false);
  });

  it("requires a selection and ignores discovery after the dialog is closed", async () => {
    const ui = setup();
    ui.field("packName").value = "Named";
    await ui.run<Promise<void>>("savePackForm(packDraft.version)");
    expect(ui.requests).toHaveLength(0);
    expect(ui.field("packError").textContent).toContain("Choose at least one skill");
    ui.field("sheet").open = false;
    await ui.run<Promise<void>>("choosePackSkills(1)");
    expect(ui.run<number>("packDraft.pickers.size")).toBe(0);
  });

  describe("adding a repository from the pack form", () => {
    it("adds a new repository as a marked choice, discovers its skills and keeps bookmark-only fields out of the pack", async () => {
      const ui = setup();
      ui.field("packNewSource").value = "https://github.com/owner/new-tools.git";
      await ui.run<Promise<void>>("addPackRepository()");
      expect(ui.run("packDraft.choices[2]")).toEqual({ name: "new-tools", source: "https://github.com/owner/new-tools.git", skills: [], isNew: true });
      expect(ui.field("packChoices").innerHTML).toContain("New source");
      expect(ui.requests.at(-1)).toEqual({ path: "discover", data: { source: "https://github.com/owner/new-tools.git" } });
      expect(ui.run<number>("memberPicker.index")).toBe(2);
      ui.run("memberChanged({value:'video',checked:true})");
      ui.context.document = { querySelectorAll: () => [{ dataset: { packSource: "2" } }] };
      ui.field("packName").value = "Tools";
      await ui.run<Promise<void>>("savePackForm(packDraft.version)");
      expect(ui.requests.at(-1)).toEqual({ path: "pack/save", data: { name: "Tools", description: "", groups: [{ source: "https://github.com/owner/new-tools.git", skills: ["video"] }], sourceNames: { "https://github.com/owner/new-tools.git": "new-tools" } } });
      expect(ui.sources).toHaveLength(2);
    });

    it("selects an existing choice instead of duplicating an equivalent repository reference", async () => {
      const ui = setup();
      ui.field("packNewSource").value = "https://github.com/owner/two";
      await ui.run<Promise<void>>("addPackRepository()");
      expect(ui.run<number>("packDraft.choices.length")).toBe(2);
      expect(ui.run<number>("memberPicker.index")).toBe(1);
      ui.field("packNewSource").value = "--not-a-source";
      await ui.run<Promise<void>>("addPackRepository()");
      expect(ui.field("packError").textContent).toContain("Enter a repository");
      expect(ui.run<number>("packDraft.choices.length")).toBe(2);
    });

  });
});
