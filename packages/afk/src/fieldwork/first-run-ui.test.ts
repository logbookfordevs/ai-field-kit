import { readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../web/first-run.js", import.meta.url), "utf8");

interface Field { value: string; textContent?: string; disabled?: boolean }

let context: Context;
let requests: { path: string; data: unknown }[];
let dialog: { title: string; body: string; foot: string };
let toasts: string[];
let navigations: string[];
let fields: Record<string, Field>;
let replies: Record<string, unknown>;
let closed: number;
let welcomes: number;

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }
async function click(code: string): Promise<void> { await evaluate<Promise<void> | void>(code); }
const asked = (path: string): unknown[] => requests.filter(request => request.path === path).map(request => request.data);

const repositories = [
  { name: "leo/afk-library", url: "https://github.com/leo/afk-library.git", private: true },
  { name: "leo/dotfiles", url: "https://github.com/leo/dotfiles.git", private: true },
];

const summary = {
  repository: "https://github.com/leo/afk-library.git",
  linked: ["alpha", "beta"],
  adopted: ["gamma"],
  movedAside: [{ name: "kami", from: "/h/.agents/skills/kami", to: "/h/.afk/restore-aside/2026-11-05/.agents/skills/kami" }],
  choices: 3,
  folders: ["/h/.agents/skills", "/h/.claude/skills"],
  packs: ["Docs"],
  tools: [
    { id: 1, name: "Waypoint", install: "npm i -g waypoint", provides: ["waypoint"] },
    { id: 2, name: "Impeccable", install: "npx impeccable install", provides: ["impeccable"] },
  ],
};

beforeEach(() => {
  requests = []; toasts = []; navigations = []; closed = 0; welcomes = 0;
  dialog = { title: "", body: "", foot: "" };
  fields = { firstRunUrl: { value: " leo/afk-library " }, firstRunRun: { value: "" } };
  replies = { "restore/repositories": repositories, "restore/start": summary, "tool/run": { code: 0, output: "", reapplied: [], warnings: [] }, welcome: { ok: true } };
  context = createContext({
    $: (id: string) => fields[id] ?? { value: "" },
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    modal: (title: string, body: string, foot = "") => { dialog = { title, body, foot }; },
    closeModal: () => { closed++; },
    toast: (message: string) => { toasts.push(message); },
    navigate: (section: string) => { navigations.push(section); },
    sections: ["Kit", "Installed Skills", "Agent rules", "Tools", "Settings", "Backup"],
    refresh: async () => undefined,
    showWelcome: () => { welcomes++; },
    currentSettings: {},
    request: async (path: string, data: unknown) => {
      requests.push({ path, data });
      const reply = replies[path];
      if (reply instanceof Error) throw reply;
      return reply;
    },
  });
  runInContext(script, context);
});

const screen = (): string => dialog.title + dialog.body + dialog.foot;

describe("choosing how to start", () => {
  it("offers restore, a new library and skip", () => {
    evaluate("showFirstRun()");

    expect(screen()).toContain("firstRunChoose('restore')");
    expect(screen()).toContain("firstRunChoose('fresh')");
    expect(screen()).toContain("firstRunSkip()");
    expect(asked("restore/repositories")).toEqual([]);
  });

  it("leaves AFK usable without a backup when skipped, remembering the choice", async () => {
    evaluate("showFirstRun()");

    await click("firstRunSkip()");

    expect(asked("welcome")).toEqual([{}]);
    expect(asked("restore/start")).toEqual([]);
    expect(welcomes).toBe(1);
  });

  it("explains how to start a new library from the command line", async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('fresh')");

    expect(screen()).toContain("afk library init --apply");
    expect(asked("restore/start")).toEqual([]);
  });
});

describe("picking the library to restore", () => {
  beforeEach(async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");
  });

  it("lists the GitHub CLI's repositories and also accepts a pasted address", () => {
    expect(asked("restore/repositories")).toHaveLength(1);
    expect(screen()).toContain("leo/afk-library");
    expect(screen()).toContain("leo/dotfiles");
    expect(screen()).toContain("firstRunRestore(0)");
    expect(screen()).toContain('id="firstRunUrl"');
    expect(screen()).toContain("afk library connect");
  });

  it("restores the chosen repository and shows the tools to choose from", async () => {
    await click("firstRunRestore(1)");

    expect(asked("restore/start")).toEqual([{ repository: "https://github.com/leo/dotfiles.git" }]);
    expect(screen()).toContain("Run your tools?");
    expect(screen()).toContain("Waypoint");
    expect(screen()).toContain("npx impeccable install");
    expect(asked("tool/run")).toEqual([]);
  });

  it("restores from a pasted address, trimmed", async () => {
    await click("firstRunRestoreUrl()");

    expect(asked("restore/start")).toEqual([{ repository: "leo/afk-library" }]);
  });

  it("stays on the list and shows the reason when the repository is refused", async () => {
    replies["restore/start"] = new Error("That repository is not an AFK library.");

    await click("firstRunRestore(1)");

    expect(screen()).toContain("That repository is not an AFK library.");
    expect(screen()).toContain("firstRunRestore(0)");
    expect(asked("tool/run")).toEqual([]);
  });

  it("falls back to pasting an address when the GitHub CLI cannot list", async () => {
    replies["restore/repositories"] = new Error("The GitHub CLI could not list your repositories: not signed in.");
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");

    expect(screen()).toContain("not signed in");
    expect(screen()).toContain('id="firstRunUrl"');
    expect(screen()).not.toContain("firstRunRestore(0)");
  });
});

describe("running the tools", () => {
  beforeEach(async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");
    await click("firstRunRestore(0)");
  });

  it("runs only the ticked tools, one after another", async () => {
    evaluate("firstRunTick(2,true)");

    await click("firstRunRunTools()");

    expect(asked("tool/run")).toEqual([{ id: 2 }]);
    expect(screen()).toContain("This machine matches your library");
  });

  it("runs nothing when none is ticked or when skipped", async () => {
    await click("firstRunRunTools()");

    expect(asked("tool/run")).toEqual([]);
    expect(screen()).toContain("This machine matches your library");
  });

  it("labels the run button with the number ticked", () => {
    evaluate("firstRunTick(1,true);firstRunTick(2,true)");
    expect(fields.firstRunRun!.textContent).toBe("Run 2 tools");
    expect(fields.firstRunRun!.disabled).toBe(false);

    evaluate("firstRunTick(1,false);firstRunTick(2,false)");
    expect(fields.firstRunRun!.disabled).toBe(true);
  });

  it("keeps going and reports a tool that fails", async () => {
    evaluate("firstRunTick(1,true);firstRunTick(2,true)");
    replies["tool/run"] = Object.assign(new Error("exit 1"), {});

    await click("firstRunRunTools()");

    expect(asked("tool/run")).toHaveLength(2);
    expect(screen()).toContain("Waypoint could not run");
  });
});

describe("the summary", () => {
  it("lists what was linked, adopted and moved aside, and remembers that first run is done", async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");
    await click("firstRunRestore(0)");
    await click("firstRunRunTools()");

    expect(screen()).toContain("2 Core skills");
    expect(screen()).toContain("3 choices");
    expect(screen()).toContain("gamma");
    expect(screen()).toContain("kami");
    expect(screen()).toContain("/h/.afk/restore-aside/2026-11-05/.agents/skills/kami");
    expect(screen()).toContain("Packs are off");
    expect(asked("welcome")).toEqual([{}]);
  });

  it("goes on to Skills or the backup page", async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");
    await click("firstRunRestore(0)");
    await click("firstRunRunTools()");

    await click("firstRunGo('Backup')");
    expect(navigations).toEqual(["Backup"]);
    expect(closed).toBeGreaterThan(0);
  });
});

describe("cancelling", () => {
  it("asks the app to stop the restore while it is running", async () => {
    evaluate("showFirstRun()");
    await click("firstRunChoose('restore')");
    await click("firstRunCancel()");

    expect(asked("restore/cancel")).toEqual([{}]);
  });
});
