import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const scripts = ["members.js", "stacks.js"].map(name => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8")).join("\n");

function setup() {
  const fields = new Map<string, { value: string; textContent: string; innerHTML: string; hidden: boolean; open: boolean; firstElementChild: { isConnected: boolean }; setAttribute(): void }>();
  const field = (id: string) => {
    if (!fields.has(id)) fields.set(id, { value: "", textContent: "", innerHTML: "", hidden: false, open: true, firstElementChild: { isConnected: true }, setAttribute() {} });
    return fields.get(id)!;
  };
  const sources = [{ name: "Selected", source: "owner/one", skills: ["review"] }, { name: "All", source: "owner/two" }];
  const requests: { path: string; data: unknown }[] = [];
  let markup = "";
  const context = createContext({
    $: field, favoriteSources: sources, esc: String, button: () => "", inventories: {},
    modal: (_title: string, html: string) => { markup = html; },
    document: { querySelectorAll: () => [{ dataset: { stackSource: "1" } }] },
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return { names: ["video", "review"], paths: { video: "media/video", review: "qa/review" } }; },
  });
  runInContext(scripts, context);
  const run = <T>(code: string): T => runInContext(code, context) as T;
  run("createStack()");
  return { run, sources, requests, field, markup: () => markup };
}

describe("stack source picker", () => {
  it("lists all bookmarks and previews only the selected skills without modifying bookmarks", async () => {
    const ui = setup();
    expect(ui.markup()).toContain("Selected");
    expect(ui.markup()).toContain("All");
    await ui.run<Promise<void>>("chooseStackSkills(1)");
    ui.run("memberChanged({value:'video',checked:true})");
    ui.field("stackName").value = "Video";
    ui.field("stackId").value = "video";
    ui.run("reviewStack=()=>{}");
    await ui.run<Promise<void>>("previewNewStack(stackDraft.version)");
    expect(ui.requests.at(-1)).toEqual({ path: "stack/preview", data: { manifest: { version: 1, id: "video", name: "Video", sources: [{ name: "All", source: "owner/two", skills: ["video"] }] } } });
    expect(ui.sources[1]).not.toHaveProperty("skills");
    await ui.run<Promise<void>>("chooseStackSkills(0)");
    await ui.run<Promise<void>>("chooseStackSkills(1)");
    expect(ui.run<string[]>("[...memberPicker.selected]")).toEqual(["video"]);
  });

  it("requires a selection and ignores discovery after the dialog is closed", async () => {
    const ui = setup();
    await ui.run<Promise<void>>("previewNewStack(stackDraft.version)");
    expect(ui.requests).toHaveLength(0);
    expect(ui.field("stackError").textContent).toContain("Choose at least one skill");
    ui.field("sheet").open = false;
    await ui.run<Promise<void>>("chooseStackSkills(1)");
    expect(ui.run<number>("stackDraft.pickers.size")).toBe(0);
  });
});
