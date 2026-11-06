import { renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ClientProvider } from "@/api/ClientProvider";
import { renderWithApp } from "@/test/render";
import { fail, fakeClient } from "@/test/fake-client";
import { screen as overview } from "@/screens/overview";
import { InstallHost } from "@/screens/sources";
import { closeInstall } from "@/screens/sources/install/store";
import { backupState, emptyKit, offBackup, reviewKit } from "@/screens/overview/fixtures";

const Overview = overview.Screen;
const params = new URLSearchParams();

const setupState = {
  settings: {
    profiles: [
      { id: "p1", name: "Writing", source: "owner/writing", skills: ["a"], enabled: ["Global"], ready: true },
      { id: "p2", name: "Research", source: "owner/research", skills: ["b"], enabled: [], ready: true },
    ],
    tools: [],
    favoriteSources: [{ name: "Hairline", source: "owner/hairline" }],
  },
  inventories: { Global: [{ name: "kami", available: true }, { name: "quill", available: true }, { name: "north", available: false }] },
};

function setup(handlers: Parameters<typeof fakeClient>[0] = {}) {
  const client = fakeClient({
    "kit/state": () => emptyKit,
    "backup/state": () => backupState(),
    state: () => setupState,
    "skill/adopt": () => ({ ok: true }),
    ...handlers,
  });
  renderWithApp(<Overview params={params} />, { client });
  return client;
}

async function rowOf(name: string) {
  return (await screen.findByText(name, { selector: ".sname" })).closest("li")!;
}

describe("skills installed outside AFK", () => {
  it("lists each skill with its description under one heading", async () => {
    setup({ "kit/state": () => reviewKit });

    expect(await screen.findByRole("heading", { name: "2 skills were installed outside AFK" })).toBeInTheDocument();
    expect(within(await rowOf("kami")).getByText("Draft documents with a steady hand.")).toBeInTheDocument();
  });

  it("adds a skill to Core through skill/adopt", async () => {
    const client = setup({ "kit/state": () => reviewKit });

    await userEvent.click(within(await rowOf("kami")).getByRole("button", { name: /^Add to Core/ }));

    expect(client.calls).toContainEqual({ operation: "skill/adopt", input: { name: "kami", to: "library" } });
  });

  it("keeps a skill on this machine through skill/adopt", async () => {
    const client = setup({ "kit/state": () => reviewKit });

    await userEvent.click(within(await rowOf("local-notes")).getByRole("button", { name: /^Keep on this machine/ }));

    expect(client.calls).toContainEqual({ operation: "skill/adopt", input: { name: "local-notes", to: "machine" } });
  });

  it("falls back to the kit operations when there is no library yet", async () => {
    const client = setup({ "kit/state": () => reviewKit, "backup/state": () => offBackup({ library: false }), "kit/add": () => ({ ok: true }), "kit/machine-only": () => ({ ok: true }) });

    await userEvent.click(within(await rowOf("kami")).getByRole("button", { name: /^Add to Core/ }));
    await userEvent.click(within(await rowOf("kami")).getByRole("button", { name: /^Keep on this machine/ }));

    expect(client.calls).toContainEqual({ operation: "kit/add", input: { names: ["kami"], to: "core" } });
    expect(client.calls).toContainEqual({ operation: "kit/machine-only", input: { name: "kami", enabled: true } });
  });

  it("offers a pack under Other… and adds the skill to the one chosen", async () => {
    const client = setup({ "kit/state": () => reviewKit, "kit/add": () => ({ ok: true }) });

    await userEvent.click(within(await rowOf("kami")).getByRole("button", { name: /^Other…/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Pack"), "Research");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add to pack" }));

    expect(client.calls).toContainEqual({ operation: "kit/add", input: { names: ["kami"], to: "p2" } });
  });

  it("explains why a skill with no repository cannot join a pack", async () => {
    setup({ "kit/state": () => reviewKit });

    await userEvent.click(within(await rowOf("local-notes")).getByRole("button", { name: /^Other…/ }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/no repository to download from/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add to pack" })).toBeDisabled();
  });

  it("shows the server's message when an action fails and keeps the skill listed", async () => {
    setup({ "kit/state": () => reviewKit, "skill/adopt": () => fail("The library is locked.") });

    await userEvent.click(within(await rowOf("kami")).getByRole("button", { name: /^Add to Core/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("The library is locked.");
    expect(await rowOf("kami")).toBeInTheDocument();
  });
});

describe("quick actions", () => {
  afterEach(() => { closeInstall(); location.hash = ""; });

  it("finds a skill by opening Skills with the search filled in", async () => {
    setup();

    await userEvent.type(await screen.findByRole("searchbox", { name: "Find a skill" }), "kami");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));

    expect(location.hash).toBe("#/skills?q=kami");
  });

  it("opens the install dialog to add something new", async () => {
    const client = fakeClient({
      "kit/state": () => emptyKit,
      "backup/state": () => backupState(),
      state: () => ({ ...setupState, settings: { ...setupState.settings, projects: [] }, kit: {} }),
      "skills/install-state": () => null,
    });
    renderWithApp(<><Overview params={params} /><InstallHost /></>, { client });

    await userEvent.click(await screen.findByRole("button", { name: "Add something new" }));

    expect(await screen.findByRole("dialog", { name: "Add something new" })).toBeInTheDocument();
  });
});

describe("local checks", () => {
  const edited = { id: "edited:kami", kind: "edited" as const, name: "kami", files: ["SKILL.md"] };
  const replaced = { id: "replaced:north", kind: "replaced" as const, name: "north" };

  it("keeps an edit made outside AFK", async () => {
    const client = setup({ "backup/state": () => backupState({ held: true, attention: 1 }, [edited]), "backup/keep": () => ({ ok: true }) });

    expect(await screen.findByRole("heading", { name: "kami was edited outside AFK" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Keep edit" }));

    expect(client.calls).toContainEqual({ operation: "backup/keep", input: { id: "edited:kami" } });
  });

  it("asks before discarding an edit, then restores the saved version", async () => {
    const client = setup({ "backup/state": () => backupState({ attention: 1 }, [edited]), "backup/discard": () => ({ ok: true }) });

    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(client.calls.some(call => call.operation === "backup/discard")).toBe(false);
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Discard edit" }));

    expect(client.calls).toContainEqual({ operation: "backup/discard", input: { id: "edited:kami" } });
  });

  it("takes the new files of a skill replaced by Skills CLI", async () => {
    const client = setup({ "backup/state": () => backupState({ attention: 1 }, [replaced]), "backup/take-update": () => ({ ok: true }) });

    expect(await screen.findByRole("heading", { name: "north was replaced by Skills CLI" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Take the new files" }));

    expect(client.calls).toContainEqual({ operation: "backup/take-update", input: { name: "north" } });
  });

  it("restores the saved version of a replaced skill after confirming", async () => {
    const client = setup({ "backup/state": () => backupState({ attention: 1 }, [replaced]), "backup/restore-saved": () => ({ ok: true }) });

    await userEvent.click(await screen.findByRole("button", { name: "Restore saved" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Restore saved version" }));

    expect(client.calls).toContainEqual({ operation: "backup/restore-saved", input: { name: "north" } });
  });
});

describe("backup", () => {
  it("says backup is off and links to Backup", async () => {
    setup({ "backup/state": () => offBackup() });

    expect(await screen.findByRole("heading", { name: "Backup is off" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up backup" })).toHaveAttribute("href", "#/backup");
  });

  it("reports a failing backup and retries through backup/save", async () => {
    const client = setup({ "backup/state": () => backupState({ state: "failed", waiting: 3, error: "github.com couldn't be reached." }), "backup/save": () => ({}) });

    expect(await screen.findByRole("heading", { name: "Backup can't save" })).toBeInTheDocument();
    expect(screen.getByText(/github.com couldn't be reached. 3 changes are waiting/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(client.calls).toContainEqual({ operation: "backup/save", input: {} });
  });
});

describe("all set", () => {
  it("replaces the list with the last save time when nothing needs attention", async () => {
    setup();

    expect(await screen.findByRole("heading", { name: "All set · backed up 2 min ago" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs you" })).not.toBeInTheDocument();
    expect(screen.getByText(/saved in leo\/afk-library/)).toBeInTheDocument();
  });
});

describe("your setup", () => {
  it("summarises each page and links to it", async () => {
    setup({ "kit/state": () => ({ ...reviewKit, core: [{ name: "kami", source: "x", follow: false, status: "on" as const }], sources: [{ source: "x", follow: true, skills: 1 }] }) });

    const skills = await screen.findByRole("link", { name: /Skills/ });
    expect(skills).toHaveAttribute("href", "#/skills");
    await waitFor(() => expect(skills).toHaveTextContent("2 of 3 on · 1 in Core · 2 to review"));
    expect(screen.getByRole("link", { name: /Packs/ })).toHaveTextContent("2 packs · 1 on");
    expect(screen.getByRole("link", { name: /Sources/ })).toHaveTextContent("1 saved for later · 1 followed");
    expect(screen.getByRole("link", { name: /Backup/ })).toHaveTextContent(/Saved 2 min ago · leo\/afk-library/);
  });
});

describe("navigation signal", () => {
  function attention(handlers: Parameters<typeof fakeClient>[0]) {
    const client = fakeClient(handlers);
    return renderHook(() => overview.useAttention(), { wrapper: ({ children }) => <ClientProvider client={client}>{children}</ClientProvider> });
  }

  it("says how many things need you, as text", async () => {
    const { result } = attention({ "kit/state": () => reviewKit, "backup/state": () => offBackup() });

    await waitFor(() => expect(result.current).toEqual({ text: "2 need you", tone: "attention" }));
  });

  it("is silent when all is set and marks a failing backup as a problem", async () => {
    const quiet = attention({ "kit/state": () => emptyKit, "backup/state": () => backupState() });
    const failing = attention({ "kit/state": () => emptyKit, "backup/state": () => backupState({ state: "failed", waiting: 1 }) });

    await waitFor(() => expect(failing.result.current).toEqual({ text: "1 needs you", tone: "problem" }));
    expect(quiet.result.current).toBeNull();
  });
});
