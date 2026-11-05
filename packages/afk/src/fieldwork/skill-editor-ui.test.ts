import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const web = (name: string): string => readFileSync(new URL(`../../web/${name}`, import.meta.url), "utf8");
const client = web("client.js");
const bulk = client.slice(client.indexOf("let selectedSkills="), client.indexOf("let skillUpdateRunning"));
const script = [web("kit.js"), web("skills.js"), web("agent-folders.js"), web("invocation-info.js"), web("editor.js"), bulk].join("\n");

interface Element { innerHTML: string; textContent: string; value: string; hidden: boolean; disabled: boolean; checked: boolean; dataset: Record<string, string>; classList: { add(name: string): void; remove(name: string): void }; focus(): void }

let context: Context;
let elements: Record<string, Element>;
let requests: { path: string; data: Record<string, unknown> }[];
let responses: Record<string, unknown>;
let failures: Record<string, string>;
let dialog: { title: string; body: string; foot: string };
let toasts: string[];

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }
const element = (id: string): Element => (elements[id] ??= { innerHTML: "", textContent: "", value: "", hidden: false, disabled: false, checked: false, dataset: {}, classList: { add() {}, remove() {} }, focus() {} });
const sent = (path: string): Record<string, unknown>[] => requests.filter(request => request.path === path).map(request => request.data);

function editorView(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: "kami", storage: "library", path: "/home/.afk/library/skills/kami", files: ["SKILL.md", "scripts/run.sh"], file: "SKILL.md", content: "---\nname: kami\n---\n# Kami\n\nUse **kami** when asked.\n", invocation: "Manual only", updates: "none", ...extra };
}

function skill(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, path: `/home/.agents/skills/${name}`, owners: [], available: true, description: "", storage: "library", invocation: { claude: "Unknown", codex: "Unknown" }, defaultInvocation: { claude: "Unknown", codex: "Unknown" }, ...extra };
}

const empty = { core: [], sources: [], tools: [], undecided: [], machineOnly: [], plan: { install: [], enable: [], tools: [] } };

beforeEach(() => {
  elements = {}; requests = []; responses = {}; failures = {}; toasts = []; dialog = { title: "", body: "", foot: "" };
  context = createContext({
    $: element,
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    head: (title: string, _sub: string, action = "") => `<h1>${title}</h1>${action}`,
    modal: (title: string, body: string, foot = "") => { dialog = { title, body, foot }; },
    toast: (message: string) => toasts.push(message),
    refresh: async () => undefined,
    profiles: [], favoriteSources: [], tools: [], projects: [], scope: "Global", section: "Skills", inventories: { Global: [] }, nestedInventories: {}, backupState: null, skillBulkBusy: false, kitStatus: empty,
    byName: (a: string, b: string) => a.localeCompare(b),
    sourceWebUrl: (value: string) => value,
    renderPacksPanel: () => "PACKS", renderSourcesPanel: () => "LATER", renderSourceList: () => {}, renderSkills: () => {}, renderSkillList: () => {},
    scopeOptions: () => "", skillActionLabel: (label: string) => label,
    preferenceHint: () => "", preferenceSelect: () => "<select></select>", preferenceDriftNotice: () => "",
    inventory: () => context.inventories.Global ?? [], matchesSkillFilters: () => true,
    request: async (path: string, data: Record<string, unknown>) => {
      requests.push({ path, data });
      if (failures[path]) throw new Error(failures[path]);
      return responses[path] ?? {};
    },
    document: { querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
    window: { addEventListener() {} },
    sheet: element("sheet"),
  });
  runInContext(script, context);
});

async function openEditor(view: Record<string, unknown>): Promise<void> {
  responses["skill/editor"] = view;
  await evaluate(`editSkill('${String(view.name)}')`);
}

function type(text: string): void {
  element("editorText").value = text;
  evaluate("editorInput()");
}

describe("the skill editor", () => {
  it("opens a skill's files with the current one marked, its text editable and Save waiting for a change", async () => {
    await openEditor(editorView());

    expect(sent("skill/editor")).toEqual([{ name: "kami", file: "SKILL.md" }]);
    expect(dialog.body).toMatch(/data-editor-file="SKILL.md"[^>]*aria-current="true"/);
    expect(dialog.body).toContain('data-editor-file="scripts/run.sh"');
    expect(dialog.body).toContain("Use **kami** when asked.");
    expect(dialog.body).not.toContain("readonly");
    expect(dialog.foot).toMatch(/id="editorSave"[^>]*disabled/);

    type("changed");
    expect(element("editorSave").disabled).toBe(false);
    expect(element("editorStatus").textContent).toMatch(/Unsaved/);
    type(editorView().content as string);
    expect(element("editorSave").disabled).toBe(true);
  });

  it("previews the Markdown without the frontmatter and without running any markup", async () => {
    await openEditor(editorView());

    type("---\nname: kami\n---\n# Heading\n\nText with **bold** and `code` <script>alert(1)</script>\n\n- one\n- two\n");

    const preview = element("editorPreview").innerHTML;
    expect(preview).toContain("<h3>Heading</h3>");
    expect(preview).toContain("<strong>bold</strong>");
    expect(preview).toContain("<code>code</code>");
    expect(preview).toContain("<li>one</li>");
    expect(preview).not.toContain("<script>");
    expect(preview).not.toContain("name: kami");
  });

  it("opens a tool's skill read-only with the reason and no way to save", async () => {
    await openEditor(editorView({ readOnly: "Waypoint installs and updates this skill, so edits would be overwritten." }));

    expect(dialog.body).toContain("Waypoint installs and updates this skill");
    expect(dialog.body).toMatch(/<textarea[^>]*readonly/);
    expect(dialog.foot).not.toContain("editorSave");
    await evaluate("saveSkillEditor()");
    expect(sent("skill/edit")).toEqual([]);
  });

  it("saves the text and shows it as saved", async () => {
    await openEditor(editorView());
    type("# New\n");

    await evaluate("saveSkillEditor()");

    expect(sent("skill/edit")).toEqual([{ name: "kami", file: "SKILL.md", content: "# New\n" }]);
    expect(toasts.join(" ")).toContain("kami");
    expect(element("editorStatus").textContent).toMatch(/Saved/);
    expect(element("editorSave").disabled).toBe(true);
  });

  it("asks keep or replace before saving an auto-updating skill, and sends the choice", async () => {
    await openEditor(editorView({ updates: "ask", source: "owner/repo" }));
    type("# Mine\n");

    await evaluate("saveSkillEditor()");

    expect(sent("skill/edit")).toEqual([]);
    expect(element("editorAsk").hidden).toBe(false);
    expect(element("editorAsk").innerHTML).toContain("owner/repo");
    expect(element("editorAsk").innerHTML).toContain("commitSkillEditor('keep')");
    expect(element("editorAsk").innerHTML).toContain("commitSkillEditor('replace')");

    await evaluate("commitSkillEditor('keep')");

    expect(sent("skill/edit")).toEqual([{ name: "kami", file: "SKILL.md", content: "# Mine\n", updates: "keep" }]);
    expect(element("editorAsk").hidden).toBe(true);
  });

  it("keeps what was typed and shows the error next to the editor when saving fails", async () => {
    await openEditor(editorView());
    type("# Mine\n");
    failures["skill/edit"] = "The library has changes AFK did not make.";

    await evaluate("saveSkillEditor()");

    expect(element("editorError").textContent).toContain("changes AFK did not make");
    expect(element("editorText").value).toBe("# Mine\n");
    expect(element("editorSave").disabled).toBe(false);
  });

  it("switches files only when nothing is unsaved, and refuses to close with unsaved text", async () => {
    await openEditor(editorView());
    type("# Mine\n");

    await evaluate("openEditorFile('scripts/run.sh')");
    expect(sent("skill/editor").length).toBe(1);
    expect(element("editorError").textContent).toMatch(/Save or revert/);
    expect(evaluate("editorCanClose()")).toBe(false);

    evaluate("revertSkillEditor()");
    expect(element("editorText").value).toBe(editorView().content);
    expect(evaluate("editorCanClose()")).toBe(true);
    responses["skill/editor"] = editorView({ file: "scripts/run.sh", content: "echo hi\n" });
    await evaluate("openEditorFile('scripts/run.sh')");
    expect(sent("skill/editor")[1]).toEqual({ name: "kami", file: "scripts/run.sh" });
  });

  it("shows the saved invocation choice that a save reapplies", async () => {
    await openEditor(editorView({ invocation: "Manual only" }));
    expect(element("editorInvocation").textContent || dialog.body).toContain("Manual only");
  });
});

describe("editing from the Skills page", () => {
  function setStatus(status: Record<string, unknown>, skills: Record<string, unknown>[]): void {
    context.nextStatus = status;
    context.inventories = { Global: skills };
    evaluate("kitStatus=nextStatus");
  }
  const openMachine = (): string => { evaluate("skillsTab='machine';renderKit()"); return element("view").innerHTML; };

  it("offers Edit files for a stored skill and View files where the editor is read-only", () => {
    context.tools = [{ id: 1, name: "Waypoint", provides: ["tooled"], install: "", update: "" }];
    setStatus({ ...empty, machineOnly: ["mine", "tooled", "cached"] }, [skill("mine", { storage: "machine" }), skill("tooled", { storage: undefined, tool: "Waypoint", readOnly: true }), skill("cached", { storage: "pack" })]);

    const html = openMachine();

    expect(html).toContain("editSkill('mine')");
    expect(html).toMatch(/editSkill\('mine'\)[^>]*>Edit files/);
    expect(html).toMatch(/editSkill\('tooled'\)[^>]*>View files/);
    expect(html).toMatch(/editSkill\('cached'\)[^>]*>View files/);
  });

  it("says when a skill's updates were stopped and does not offer to update it", () => {
    setStatus({ ...empty, machineOnly: ["kami"] }, [skill("kami", { updatesStopped: true })]);

    const html = openMachine();

    expect(html).toContain("Your version");
    expect(html).toMatch(/<button data-action="showSkillUpdate\('kami'\)" disabled/);
  });
});

describe("bulk selection on the Skills page", () => {
  beforeEach(() => {
    context.nextStatus = { ...empty, machineOnly: ["alpha", "beta"], core: [{ name: "gamma", source: "me/core", follow: false, status: "on" }], sources: [{ source: "me/core", follow: false, skills: 1 }] };
    context.inventories = { Global: [skill("alpha", { storage: "machine" }), skill("beta", { storage: "machine" }), skill("gamma")] };
    evaluate("kitStatus=nextStatus;skillsTab='machine';renderKit()");
  });

  it("puts a checkbox on every row of the Global tabs", () => {
    expect(element("view").innerHTML).toContain('data-skill-select="alpha"');
    expect(element("view").innerHTML).toContain('data-skill-select="beta"');
  });

  it("shows the actions once skills are selected, with the count", () => {
    evaluate("selectSkill('alpha',true);selectSkill('beta',true)");

    const bar = element("skillSelection").innerHTML;
    expect(bar).toContain("2 selected");
    expect(bar).toContain("applySkillBulk('enable')");
    expect(bar).toContain("applySkillBulk('disable')");
    expect(bar).toContain("applySkillBulk('invocation'");
    expect(bar).toContain("showSkillUpdate([...selectedSkills])");
    expect(bar).toContain("reviewBulkSkillDeletion()");
  });

  it("turns the selected skills on, changes their invocation and clears nothing when it works", async () => {
    responses["skills/bulk"] = { completed: 2, failed: 0, items: [{ name: "alpha", ok: true }, { name: "beta", ok: true }] };
    evaluate("selectSkill('alpha',true);selectSkill('beta',true)");

    await evaluate("applySkillBulk('enable')");
    await evaluate("applySkillBulk('invocation','Manual only')");

    expect(sent("skills/bulk")).toEqual([
      { names: ["alpha", "beta"], scope: "Global", action: "enable" },
      { names: ["alpha", "beta"], scope: "Global", action: "invocation", mode: "Manual only" },
    ]);
    expect(evaluate("selectedSkills.size")).toBe(2);
  });

  it("selects every skill shown in the open tab and counts the ones hidden by the search", () => {
    evaluate("selectShownSkills()");
    expect(Array.from(evaluate<string[]>("[...selectedSkills]")).sort()).toEqual(["alpha", "beta"]);

    evaluate("skillsQuery='alp';renderSkillsPanel()");
    expect(element("skillSelection").innerHTML).toContain("1 hidden by filters");

    evaluate("clearSkillSelection()");
    expect(evaluate("selectedSkills.size")).toBe(0);
    expect(element("skillSelection").innerHTML).not.toContain("selected");
  });

  it("forgets a selected skill that is no longer installed", () => {
    evaluate("selectSkill('alpha',true)");
    context.inventories = { Global: [skill("beta", { storage: "machine" })] };

    evaluate("renderKit()");

    expect(evaluate("selectedSkills.size")).toBe(0);
  });
});
