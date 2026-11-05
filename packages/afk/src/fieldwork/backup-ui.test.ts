import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../web/backup.js", import.meta.url), "utf8");

let context: Context;
let requests: { path: string; data: unknown }[];
let view: { innerHTML: string };
let box: { innerHTML: string; hidden: boolean };
let dialog: string;
let toasts: string[];
let reply: unknown;
let stateReply: unknown;
let fields: Record<string, { value: string }>;

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }

const connected = (status: object, extra: object = {}) => ({
  status: { library: true, state: "saved", remote: "git@github.com:leo/afk-library.git", waiting: 0, pushing: false, lastSavedAt: Date.now() - 120_000, ...status },
  history: [
    { id: "c3", at: Date.now() - 60_000, message: "Edited atlas-review", pushed: false },
    { id: "c2", at: Date.now() - 3_600_000, message: "Updated 11 skills", pushed: true },
    { id: "c1", at: Date.now() - 86_400_000, message: "Start the library", pushed: true },
  ],
  contents: { coreSkills: 43, skillBytes: 9_126_805, packs: 3, tools: 8, bookmarks: 26, choices: 56, rules: true },
  ...extra,
});

function show(state: unknown): void {
  context.nextState = state;
  evaluate("backupState=nextState");
}

beforeEach(() => {
  requests = []; dialog = ""; toasts = []; reply = {}; stateReply = connected({}); view = { innerHTML: "" }; box = { innerHTML: "", hidden: true };
  fields = { backupRepository: { value: " afk-library " }, backupUrl: { value: " git@github.com:leo/x.git " }, backupNewUrl: { value: "" } };
  context = createContext({
    $: (id: string) => id === "view" ? view : id === "backupBox" ? box : fields[id] ?? { value: "" },
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    head: (title: string, _sub: string, action = "") => `<h1>${title}</h1>${action}`,
    modal: (_title: string, body: string, foot = "") => { dialog = body + foot; },
    closeModal: () => { dialog = ""; },
    toast: (message: string) => { toasts.push(message); },
    navigate: () => {}, section: "Backup",
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return path === "backup/state" ? stateReply : reply; },
    document: { addEventListener() {}, hidden: false, activeElement: null },
    setTimeout: () => 0, clearTimeout: () => {},
  });
  runInContext(script, context);
});

describe("the sidebar backup box", () => {
  it.each(["saved", "waiting", "failed"])("shows the %s state", state => {
    show(connected({ state, waiting: state === "saved" ? 0 : 2 }));
    evaluate("renderBackupBox()");

    expect(box.hidden).toBe(false);
    expect(box.innerHTML).toContain(`data-state="${state}"`);
    expect(box.innerHTML).toContain("saveBackupNow()");
  });

  it("offers setup, not saving, while no remote is connected", () => {
    show({ status: { library: true, state: "off", waiting: 0, pushing: false } });
    evaluate("renderBackupBox()");

    expect(box.innerHTML).toContain('data-state="off"');
    expect(box.innerHTML).not.toContain("saveBackupNow()");
  });

  it("stays hidden without a library", () => {
    show({ status: { library: false, state: "off", waiting: 0, pushing: false } });
    evaluate("renderBackupBox()");

    expect(box.hidden).toBe(true);
    expect(box.innerHTML).toBe("");
  });

  it("disables saving while a push is running", () => {
    show(connected({ pushing: true }));
    evaluate("renderBackupBox()");

    expect(box.innerHTML).toMatch(/data-backup-save disabled/);
  });
});

describe("the Backup screen", () => {
  it("asks for a repository first and says skill files are not scanned for secrets", () => {
    show({ status: { library: true, state: "off", waiting: 0, pushing: false } });
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain("createBackupRepository()");
    expect(view.innerHTML).toContain("connectBackupRemote()");
    expect(view.innerHTML).toContain("data-backup-warning");
  });

  it("offers to start a new library or restore one when there is no library", () => {
    show({ status: { library: false, state: "off", waiting: 0, pushing: false } });
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain("showStartLibrary()");
    expect(view.innerHTML).toContain("showFirstRun()");
    expect(view.innerHTML).not.toContain("createBackupRepository()");
  });

  it("shows the state, what is in the backup and each save, marking those not pushed", () => {
    show(connected({ state: "waiting", waiting: 1 }));
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain('data-state="waiting"');
    expect(view.innerHTML).toContain("43 Core skills");
    expect(view.innerHTML).toContain('data-save="c3" data-pushed="false"');
    expect(view.innerHTML).toContain('data-save="c2" data-pushed="true"');
  });

  it("shows why saving failed and keeps the retry in reach", () => {
    show(connected({ state: "failed", waiting: 3, error: "Could not read from remote repository." }));
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain('data-state="failed"');
    expect(view.innerHTML).toContain("Could not read from remote repository.");
    expect(view.innerHTML).toContain("saveBackupNow()");
  });

  it("offers going back on every save except the oldest", () => {
    show(connected({}));
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain("confirmGoBack(0)");
    expect(view.innerHTML).toContain("confirmGoBack(1)");
    expect(view.innerHTML).not.toContain("confirmGoBack(2)");
  });
});

describe("backup actions", () => {
  it("Save now asks the server to push, then refreshes the state", async () => {
    reply = { state: "saved", waiting: 0 };
    show(connected({ state: "waiting", waiting: 1 }));

    await evaluate<Promise<void>>("saveBackupNow()");

    expect(requests.map(entry => entry.path)).toEqual(["backup/save", "backup/state"]);
  });

  it("tells the person when a push failed and that nothing is lost", async () => {
    reply = { state: "failed", waiting: 2, error: "offline" };
    show(connected({}));

    await evaluate<Promise<void>>("saveBackupNow()");

    expect(toasts.at(-1)).toMatch(/offline/);
  });

  it("creates a repository and connects a remote with the trimmed field values", async () => {
    show({ status: { library: true, state: "off", waiting: 0, pushing: false } });
    await evaluate<Promise<void>>("createBackupRepository()");
    await evaluate<Promise<void>>("connectBackupRemote()");

    expect(requests.filter(entry => entry.path !== "backup/state")).toEqual([
      { path: "backup/create", data: { name: "afk-library" } },
      { path: "backup/connect", data: { url: "git@github.com:leo/x.git" } },
    ]);
  });

  it("goes back to the save before the chosen one only after confirmation", async () => {
    show(connected({}));
    evaluate("confirmGoBack(0)");

    expect(requests).toEqual([]);
    expect(dialog).toContain("goBackTo('c2')");

    await evaluate<Promise<void>>("goBackTo('c2')");
    expect(requests[0]).toEqual({ path: "backup/restore", data: { id: "c2" } });
  });
});

const edited = { id: "edited:kami", kind: "edited", name: "kami", files: ["SKILL.md"], at: Date.now() - 60_000 };
const replaced = { id: "replaced:statechart", kind: "replaced", name: "statechart", changed: true };

describe("Needs attention", () => {
  it("lists each item with its own actions on the Backup screen, with the count in the heading", () => {
    show(connected({ attention: 2, held: true }, { attention: [edited, replaced] }));
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain("Needs attention · 2");
    expect(view.innerHTML).toContain('data-attention="edited:kami"');
    expect(view.innerHTML).toContain('data-attention="replaced:statechart"');
    expect(view.innerHTML).toContain("Keep edit");
    expect(view.innerHTML).toContain("confirmDiscardEdit(0)");
    expect(view.innerHTML).toContain("takeSkillsUpdate(1)");
    expect(view.innerHTML).toContain("confirmRestoreSaved(1)");
  });

  it("shows the section before backup is connected, because these checks are local", () => {
    show({ status: { library: true, state: "off", waiting: 0, attention: 1, held: true, pushing: false }, attention: [replaced] });
    evaluate("renderBackup()");

    expect(view.innerHTML).toContain("Needs attention · 1");
    expect(view.innerHTML).toContain("createBackupRepository()");
  });

  it("has no section when nothing needs attention", () => {
    show(connected({ attention: 0 }, { attention: [] }));
    evaluate("renderBackup()");

    expect(view.innerHTML).not.toContain("Needs attention");
  });

  it("says saving is paused while edits made outside AFK wait", () => {
    show(connected({ state: "waiting", waiting: 2, attention: 1, held: true }, { attention: [edited] }));
    evaluate("renderBackup()");
    evaluate("renderBackupBox()");

    expect(view.innerHTML).toContain("data-held");
    expect(box.innerHTML).toContain('data-held="true"');
  });

  it("puts the same count as the list in the sidebar box", () => {
    show(connected({ attention: 2 }, { attention: [edited, replaced] }));
    evaluate("renderBackupBox()");

    expect(box.innerHTML).toMatch(/data-attention-count="2"/);
  });

  it("shows no count in the sidebar when the list is empty", () => {
    show(connected({ attention: 0 }, { attention: [] }));
    evaluate("renderBackupBox()");

    expect(box.innerHTML).not.toContain("data-attention-count");
  });

  it("keeps an edit, takes an update, and refreshes", async () => {
    stateReply = connected({ attention: 2 }, { attention: [edited, replaced] });
    show(stateReply);

    await evaluate<Promise<void>>("keepEdit(0)");
    await evaluate<Promise<void>>("takeSkillsUpdate(1)");

    expect(requests.filter(entry => entry.path !== "backup/state")).toEqual([
      { path: "backup/keep", data: { id: "edited:kami" } },
      { path: "backup/take-update", data: { name: "statechart" } },
    ]);
    expect(requests.at(-1)?.path).toBe("backup/state");
  });

  it("discards an edit and restores the saved version only after confirmation", async () => {
    stateReply = connected({ attention: 2 }, { attention: [edited, replaced] });
    show(stateReply);
    evaluate("confirmDiscardEdit(0)");
    expect(dialog).toContain("discardEdit(0)");
    evaluate("confirmRestoreSaved(1)");
    expect(dialog).toContain("restoreSaved(1)");

    expect(requests).toEqual([]);

    await evaluate<Promise<void>>("discardEdit(0)");
    await evaluate<Promise<void>>("restoreSaved(1)");

    expect(requests.filter(entry => entry.path !== "backup/state")).toEqual([
      { path: "backup/discard", data: { id: "edited:kami" } },
      { path: "backup/restore-saved", data: { name: "statechart" } },
    ]);
  });

  it("reports a refused action instead of failing silently", async () => {
    show(connected({ attention: 1 }, { attention: [edited] }));
    context.request = async () => { throw new Error("That edit is no longer waiting."); };

    await evaluate<Promise<void>>("keepEdit(0)");

    expect(toasts.at(-1)).toMatch(/no longer waiting/);
  });
});
