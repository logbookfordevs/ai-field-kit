import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationResult } from "@/api/operations";
import { screen as backup } from "@/screens/backup";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

type State = OperationResult<"backup/state">;
type Status = State["status"];

const NOW = Date.parse("2026-11-05T12:00:00Z");
const minutesAgo = (minutes: number) => NOW - minutes * 60_000;

type Overrides<T> = { [K in keyof T]?: T[K] | undefined };

function without<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

const status = (overrides: Overrides<Status> = {}): Status => without({ library: true, state: "saved", remote: "git@github.com:leo/afk-library.git", waiting: 0, attention: 0, held: false, pushing: false, lastSavedAt: minutesAgo(2), ...overrides }) as Status;
const contents = { coreSkills: 43, skillBytes: 2_621_440, packs: 4, tools: 3, bookmarks: 12, choices: 9, rules: true };
const history = [
  { id: "c3", at: minutesAgo(2), message: "Added kami to Core", pushed: true },
  { id: "c2", at: minutesAgo(60 * 5), message: "Turned on the design pack", pushed: true },
  { id: "c1", at: minutesAgo(60 * 30), message: "Started the library", pushed: true },
];
const state = (overrides: Overrides<State> = {}): State => without({ status: status(), attention: [], unpushed: [], history, contents, ...overrides }) as State;

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"], now: NOW }); });
afterEach(() => { vi.useRealTimers(); });

function open(handlers: Parameters<typeof fakeClient>[0] = {}, current: State = state()) {
  const client = fakeClient({ "backup/state": () => current, ...handlers });
  const Screen = backup.Screen;
  renderWithApp(<Screen params={new URLSearchParams()} />, { client });
  return client;
}

describe("saved", () => {
  it("says when the library was last saved and where, and saves on request", async () => {
    const client = open({ "backup/save": () => status({ lastSavedAt: NOW }) });

    expect(await screen.findByRole("heading", { level: 2, name: "Saved 2 min ago" })).toBeInTheDocument();
    expect(screen.getByText("leo/afk-library", { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save now" }));

    expect(client.calls.some(call => call.operation === "backup/save")).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });
});

describe("states in words", () => {
  const cases: [string, Overrides<Status>, string, RegExp][] = [
    ["waiting", { state: "waiting", waiting: 3 }, "Saving soon", /3 changes waiting/],
    ["failed", { state: "failed", waiting: 1, error: "Could not resolve host: github.com" }, "Can't save", /1 change waiting on this machine; nothing is lost/],
    ["paused by an edit outside AFK", { state: "waiting", waiting: 2, held: true, attention: 1 }, "Paused", /2 changes waiting on this machine.*kept or discarded/],
    ["paused with nothing new to save", { state: "saved", waiting: 0, held: true, attention: 1 }, "Paused", /^Saving resumes when the edits made outside AFK are kept or discarded\. Last saved 2 min ago\.$/],
    ["off", { state: "off" }, "Off", /only on this machine/],
  ];

  it.each(cases)("%s has its own heading and explanation", async (_name, overrides, title, detail) => {
    open({}, state({ status: status(overrides) }));

    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
  });

  it("shows why a save failed and lets you try again, keeping the changes", async () => {
    const client = open({ "backup/save": () => status({ state: "failed", waiting: 1, error: "Could not resolve host: github.com" }) }, state({ status: status({ state: "failed", waiting: 1, error: "Could not resolve host: github.com" }) }));

    expect(await screen.findByText("Could not resolve host: github.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(client.calls.filter(call => call.operation === "backup/save")).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Not saved yet: Could not resolve host: github.com. Your changes are kept here.");
  });

  it("does not double the full stop when the remote's reason already ends with one", async () => {
    open({ "backup/save": () => status({ state: "failed", waiting: 1, error: "Repository not found." }) });
    await userEvent.click(await screen.findByRole("button", { name: "Save now" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Not saved yet: Repository not found. Your changes are kept here.");
  });

  it("disables saving while a push is running", async () => {
    open({}, state({ status: status({ pushing: true }) }));

    expect(await screen.findByRole("button", { name: "Save now" })).toBeDisabled();
  });

  it("keeps a refused save visible next to the page until the next action", async () => {
    open({ "backup/save": () => fail("The library is locked by another AFK.") });
    await userEvent.click(await screen.findByRole("button", { name: "Save now" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The library is locked by another AFK.");
  });
});

describe("off", () => {
  const off = () => state({ status: status({ state: "off", remote: undefined, lastSavedAt: undefined }), history: [] });

  it("creates a private GitHub repository by default", async () => {
    const client = open({ "backup/create": () => status() }, off());
    const name = await screen.findByLabelText("Repository name");
    expect(name).toHaveValue("afk-library");

    await userEvent.clear(name);
    await userEvent.type(name, "my-skills");
    await userEvent.click(screen.getByRole("button", { name: "Create and save" }));

    expect(client.calls.find(call => call.operation === "backup/create")?.input).toEqual({ name: "my-skills" });
    expect(await screen.findByRole("status")).toHaveTextContent("Private repository created and backed up.");
  });

  it("connects any Git remote instead", async () => {
    const client = open({ "backup/connect": () => status() }, off());
    await userEvent.click(await screen.findByRole("radio", { name: "Use a Git remote" }));

    await userEvent.type(screen.getByLabelText("Remote URL"), "git@example.com:me/lib.git");
    await userEvent.click(screen.getByRole("button", { name: "Connect and save" }));

    expect(client.calls.find(call => call.operation === "backup/connect")?.input).toEqual({ url: "git@example.com:me/lib.git" });
  });

  it("asks for the missing remote URL instead of sending nothing", async () => {
    const client = open({}, off());
    await userEvent.click(await screen.findByRole("radio", { name: "Use a Git remote" }));

    await userEvent.click(screen.getByRole("button", { name: "Connect and save" }));

    const url = screen.getByLabelText("Remote URL");
    expect(url).toHaveAccessibleDescription(/Enter the URL/);
    expect(url).toHaveFocus();
    expect(client.calls.some(call => call.operation === "backup/connect")).toBe(false);
  });

  it("says the repository must stay private", async () => {
    open({}, off());

    expect(await screen.findByText(/aren't scanned for secrets/)).toBeInTheDocument();
  });

  it("shows what the server refused", async () => {
    open({ "backup/create": () => fail("GitHub CLI is not signed in. Run gh auth login.") }, off());
    await userEvent.click(await screen.findByRole("button", { name: "Create and save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub CLI is not signed in. Run gh auth login.");
  });
});

describe("needs attention", () => {
  const edited = { id: "edited:kami", kind: "edited" as const, name: "kami", files: ["SKILL.md", "notes.md", "a.md", "b.md", "c.md"], at: minutesAgo(5) };
  const replaced = { id: "replaced:atlas", kind: "replaced" as const, name: "atlas", changed: true };
  const flagged = (items: State["attention"]) => state({ status: status({ attention: items.length, held: true, waiting: 1, state: "waiting" }), attention: items });

  it("lists an edit made outside AFK with what changed and says saving is paused", async () => {
    open({}, flagged([edited]));

    const section = (await screen.findByRole("heading", { level: 2, name: "Needs attention · 1" })).closest("section")!;
    expect(within(section).getByText("kami")).toBeInTheDocument();
    expect(within(section).getByText("Edited outside AFK")).toBeInTheDocument();
    expect(within(section).getByText(/SKILL\.md, notes\.md, a\.md and 2 more changed 5 min ago/)).toBeInTheDocument();
    expect(within(section).getByText(/Saving to the remote is paused/)).toBeInTheDocument();
  });

  it("keeps an edit with one click", async () => {
    const client = open({ "backup/keep": () => ({ status: status(), attention: [] }) }, flagged([edited]));

    await userEvent.click(await screen.findByRole("button", { name: "Keep edit" }));

    expect(client.calls.find(call => call.operation === "backup/keep")?.input).toEqual({ id: "edited:kami" });
    expect(await screen.findByRole("status")).toHaveTextContent("Edit kept and saved.");
  });

  it("asks before discarding an edit, and can be cancelled", async () => {
    const client = open({ "backup/discard": () => ({ status: status(), attention: [] }) }, flagged([edited]));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    const dialog = await screen.findByRole("dialog", { name: "Discard this edit?" });
    expect(dialog).toHaveTextContent("cannot be undone");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(client.calls.some(call => call.operation === "backup/discard")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Discard this edit?" })).getByRole("button", { name: "Discard edit" }));
    expect(client.calls.find(call => call.operation === "backup/discard")?.input).toEqual({ id: "edited:kami" });
    expect(await screen.findByRole("status")).toHaveTextContent("The saved version is back.");
  });

  it("takes a Skills CLI update and names where a different copy went", async () => {
    const client = open({ "backup/take-update": () => ({ status: status(), attention: [], movedAside: [{ name: "atlas", from: "/h/.claude/skills/atlas", to: "/h/.afk/restore-aside/2026-11-05/atlas" }] }) }, flagged([replaced]));
    expect(await screen.findByText("Replaced by Skills CLI")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Take the update" }));

    expect(client.calls.find(call => call.operation === "backup/take-update")?.input).toEqual({ name: "atlas" });
    expect(await screen.findByRole("status")).toHaveTextContent("The update is stored and linked. A different copy was kept in /h/.afk/restore-aside/2026-11-05/atlas.");
  });

  it("restores the saved version only after confirming that the folder is deleted", async () => {
    const client = open({ "backup/restore-saved": () => ({ status: status(), attention: [] }) }, flagged([replaced]));
    await userEvent.click(await screen.findByRole("button", { name: "Restore saved version" }));

    const dialog = await screen.findByRole("dialog", { name: "Restore the saved version?" });
    expect(dialog).toHaveTextContent("is deleted");
    await userEvent.click(within(dialog).getByRole("button", { name: "Restore saved version" }));

    expect(client.calls.find(call => call.operation === "backup/restore-saved")?.input).toEqual({ name: "atlas" });
  });

  it("is shown even while backup is off", async () => {
    open({}, state({ status: status({ state: "off", remote: undefined }), attention: [edited] }));

    expect(await screen.findByRole("heading", { level: 2, name: "Needs attention · 1" })).toBeInTheDocument();
  });

  it("is absent when nothing needs attention", async () => {
    open();
    await screen.findByRole("heading", { level: 2, name: /^Saved/ });

    expect(screen.queryByRole("heading", { name: /Needs attention/ })).not.toBeInTheDocument();
  });
});

describe("history", () => {
  it("lists saves newest first and offers Go back on every earlier one", async () => {
    open();

    const list = await screen.findByRole("list", { name: "Saves" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map(row => within(row).getByText(/Added kami|Turned on|Started/).textContent)).toEqual(["Added kami to Core", "Turned on the design pack", "Started the library"]);
    expect(within(rows[0]!).getByText("Current")).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByRole("button", { name: "Go back to Turned on the design pack" })).toBeInTheDocument();
  });

  it("flags saves that are not on the remote yet", async () => {
    open({}, state({ history: [{ ...history[0]!, pushed: false }, history[1]!] }));

    expect(await screen.findByText(/not pushed yet/)).toBeInTheDocument();
  });

  it("goes back only after explaining that it becomes a new save", async () => {
    const client = open({ "backup/restore": () => status() });
    await userEvent.click(await screen.findByRole("button", { name: "Go back to Turned on the design pack" }));

    const dialog = await screen.findByRole("dialog", { name: "Go back to this save?" });
    expect(dialog).toHaveTextContent("Turned on the design pack");
    expect(dialog).toHaveTextContent("new save");
    expect(client.calls.some(call => call.operation === "backup/restore")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Go back" }));

    expect(client.calls.find(call => call.operation === "backup/restore")?.input).toEqual({ id: "c2" });
    expect(await screen.findByRole("status")).toHaveTextContent("Went back. The library was restored as a new save.");
  });

  it("says so when there are no saves yet", async () => {
    open({}, state({ history: [] }));

    expect(await screen.findByText("No saves yet")).toBeInTheDocument();
  });
});

describe("what the backup holds", () => {
  it("counts what is saved and names what stays on this machine", async () => {
    open();

    const saved = await screen.findByRole("list", { name: "Saved in the backup" });
    expect(within(saved).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "43 Core skills (2.5 MB)", "4 pack definitions", "3 tools", "12 Try later bookmarks", "9 Manual/Automatic choices", "AGENTS.md and references",
    ]);
    const stays = screen.getByRole("list", { name: "Stays on this machine" });
    expect(within(stays).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Skills kept on this machine only", "Skills that are off", "Pack skill files (they download again)", "Project folders",
    ]);
  });

  it("is shown while backup is off, so the choice is informed", async () => {
    open({}, state({ status: status({ state: "off", remote: undefined }) }));

    expect(await screen.findByRole("list", { name: "Saved in the backup" })).toBeInTheDocument();
  });
});

describe("changing the repository", () => {
  it("connects a different remote", async () => {
    const client = open({ "backup/connect": () => status() });
    await userEvent.click(await screen.findByRole("button", { name: "Change repository or disconnect" }));

    const dialog = await screen.findByRole("dialog", { name: "Change repository or disconnect" });
    await userEvent.type(within(dialog).getByLabelText("New remote URL"), "git@example.com:me/other.git");
    await userEvent.click(within(dialog).getByRole("button", { name: "Use this remote" }));

    expect(client.calls.find(call => call.operation === "backup/connect")?.input).toEqual({ url: "git@example.com:me/other.git" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disconnects and says the library stays here", async () => {
    const client = open({ "backup/disconnect": () => status({ state: "off", remote: undefined }) });
    await userEvent.click(await screen.findByRole("button", { name: "Change repository or disconnect" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("keeps your library and its history on this machine");
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    expect(client.calls.some(call => call.operation === "backup/disconnect")).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent("Backup disconnected. Your library stays on this machine.");
  });
});

describe("without a library or when it cannot be read", () => {
  it("explains there is nothing to back up yet and where to start", async () => {
    open({}, state({ status: status({ library: false, state: "off" }), history: undefined, contents: undefined }));

    expect(await screen.findByRole("heading", { name: "No library yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a library in Settings" })).toHaveAttribute("href", "#/settings");
    expect(screen.queryByRole("button", { name: /Create and save/ })).not.toBeInTheDocument();
  });

  it("shows the reason when the backup cannot be read and offers a retry", async () => {
    let attempt = 0;
    open({ "backup/state": () => (attempt++ === 0 ? fail("The library folder is unreadable.") : state()) });

    expect(await screen.findByText("The library folder is unreadable.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 2, name: /^Saved/ })).toBeInTheDocument();
  });
});

describe("navigation signal", () => {
  function Signal() {
    const attention = backup.useAttention();
    return <p>{attention ? `${attention.tone}: ${attention.text}` : "nothing"}</p>;
  }
  const signal = async (current: State) => {
    const client = fakeClient({ "backup/state": () => current });
    renderWithApp(<Signal />, { client });
    await vi.waitFor(() => expect(client.calls.length).toBeGreaterThan(0));
    return screen;
  };

  it.each([
    ["saved", state(), "nothing"],
    ["off", state({ status: status({ state: "off", remote: undefined }) }), "quiet: Off"],
    ["failed", state({ status: status({ state: "failed", waiting: 2 }) }), "problem: Can't save"],
    ["something waiting for you", state({ status: status({ attention: 2, held: true, waiting: 1, state: "waiting" }), attention: [{ id: "a", kind: "edited", name: "kami" }, { id: "b", kind: "edited", name: "atlas" }] }), "attention: 2 to resolve"],
    ["no library", state({ status: status({ library: false, state: "off" }) }), "nothing"],
  ] as const)("%s", async (_name, current, expected) => {
    await signal(current);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
