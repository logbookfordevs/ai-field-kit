import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { InstallHost } from "@/screens/sources/install/InstallHost";
import { closeInstall } from "@/screens/sources/install/store";
import { SourcesScreen } from "@/screens/sources/SourcesScreen";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

afterEach(() => closeInstall());

const bookmark = (name: string, extra: Record<string, unknown> = {}) => ({ name, source: `owner/${name.toLowerCase()}`, ...extra });

function stateWith(favoriteSources: unknown[] = [], kit: Record<string, unknown> = {}) {
  return {
    settings: { version: 2, favoriteSources, profiles: [{ id: "pack-writing", name: "Writing" }], projects: [], tools: [] },
    kit: { core: [], sources: [], tools: [], undecided: [], machineOnly: [], ...kit },
  };
}

function setup(state = stateWith(), handlers: Parameters<typeof fakeClient>[0] = {}) {
  const client = fakeClient({
    state: () => state,
    "kit/install-preview": ({ source }) => ({ source, candidates: [{ name: "kami", description: "Typeset", state: "new" }, { name: "hairline", description: "Thin rules", state: "new" }] }),
    "skills/install-state": () => null,
    ...handlers,
  });
  renderWithApp(<><SourcesScreen /><InstallHost /></>, { client });
  return client;
}

it("offers both ways to add something new from the top of the page", async () => {
  setup();

  const add = await screen.findByRole("region", { name: "Add something new" });
  await userEvent.click(within(add).getByRole("button", { name: "From a zip, .skill or folder" }));

  const dialog = screen.getByRole("dialog", { name: "Add something new" });
  expect(within(dialog).getByRole("radio", { name: "A zip or folder" })).toBeChecked();
  expect(within(dialog).getByText("Drop a .zip, a .skill file or a folder here")).toBeInTheDocument();
});

it("opens the install dialog on a repository from the first button", async () => {
  setup();

  await userEvent.click(await screen.findByRole("button", { name: "From a repository" }));

  expect(within(screen.getByRole("dialog")).getByRole("radio", { name: "A repository" })).toBeChecked();
  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveFocus();
});

it("lists Try later bookmarks and installs one with its repository and saved skills prefilled", async () => {
  const client = setup(stateWith([bookmark("Hairline", { description: "Thin rules", skills: ["hairline"] }), bookmark("Fieldnotes")]));

  expect(await screen.findByRole("heading", { level: 2, name: /^Try later ?, \d+$/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: /^Core comes from ?, \d+$/ })).toBeInTheDocument();
  const later = await screen.findByRole("region", { name: /Try later/ });
  expect(within(later).getAllByRole("listitem")).toHaveLength(2);
  expect(within(later).getByText("Thin rules")).toBeInTheDocument();
  expect(within(later).getByText("1 skill")).toBeInTheDocument();
  expect(within(later).getByText("All skills")).toBeInTheDocument();

  await userEvent.click(within(later).getByRole("button", { name: "Install… Hairline" }));

  const dialog = screen.getByRole("dialog");
  await within(dialog).findByRole("group", { name: "Skills in owner/hairline" });
  expect(within(dialog).getByRole("textbox", { name: "Repository" })).toHaveValue("owner/hairline");
  expect(within(dialog).getByRole("checkbox", { name: /hairline/ })).toBeChecked();
  expect(within(dialog).getByRole("checkbox", { name: /kami/ })).not.toBeChecked();
  expect(within(dialog).queryByRole("group", { name: "Where should they go?" })).not.toBeInTheDocument();
  expect(client.calls.filter(call => call.operation === "kit/install-preview")[0]?.input).toEqual({ source: "owner/hairline" });
});

it("saves a repository to Try later under a name it asks for", async () => {
  const client = setup(stateWith([]), { "kit/install": ({ to }) => ({ ok: true, to }) });

  const later = await screen.findByRole("region", { name: /Try later/ });
  expect(within(later).getByText("Nothing saved for later")).toBeInTheDocument();
  await userEvent.click(within(later).getAllByRole("button", { name: "Save a repository" })[0]!);

  const dialog = screen.getByRole("dialog", { name: "Save a repository for later" });
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Repository" }), "hairline/type");
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("type");
  await userEvent.clear(within(dialog).getByRole("textbox", { name: "Name" }));
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Hairline type");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save to Try later" }));

  expect(await within(dialog).findByRole("heading", { name: "hairline/type is in Try later" })).toBeInTheDocument();
  expect(client.calls.find(call => call.operation === "kit/install")?.input).toEqual({ source: "hairline/type", names: [], to: "later", name: "Hairline type" });
});

it("searches Try later only when there are many bookmarks", async () => {
  const many = Array.from({ length: 7 }, (_, index) => bookmark(`Source${index}`, index === 3 ? { description: "rare binding tools" } : {}));
  setup(stateWith(many));

  const search = await screen.findByRole("searchbox", { name: "Search Try later" });
  await userEvent.type(search, "binding");

  const later = screen.getByRole("region", { name: /Try later/ });
  expect(within(later).getAllByRole("listitem")).toHaveLength(1);
  await userEvent.clear(search);
  await userEvent.type(search, "zzz");
  expect(within(later).getByText("No bookmark matches “zzz”")).toBeInTheDocument();
});

it("removes a bookmark and puts it back with Undo, through the settings operation", async () => {
  const first = bookmark("Hairline");
  const second = bookmark("Fieldnotes");
  let saved: unknown[] = [first, second];
  const client = setup(stateWith(saved), {
    state: () => stateWith(saved),
    settings: input => { saved = (input.settings as { favoriteSources: unknown[] }).favoriteSources; return { ok: true }; },
  });
  const later = await screen.findByRole("region", { name: /Try later/ });

  await userEvent.click(within(later).getByRole("button", { name: "More for Hairline" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove from Try later Hairline" }));

  await waitFor(() => expect(saved).toEqual([second]));
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await waitFor(() => expect(saved).toEqual([first, second]));
  expect(client.calls.filter(call => call.operation === "settings")).toHaveLength(2);
});

it("follows and updates the repositories Core comes from", async () => {
  const kit = {
    sources: [{ source: "fieldnotes/agent-skills", follow: false, skills: 2 }, { source: "Uploaded skill", follow: false, skills: 1 }],
    core: [
      { name: "kami", source: "fieldnotes/agent-skills", follow: false, status: "on" },
      { name: "hairline", source: "fieldnotes/agent-skills", follow: false, status: "missing" },
      { name: "mine", source: "Uploaded skill", follow: false, status: "on" },
    ],
  };
  const client = setup(stateWith([], kit), {
    "kit/follow": () => ({ ok: true }),
    "skills/update": () => ({ pending: false, phase: "Updated", output: "", code: 0, updated: 1, scope: "Global" }),
  });
  const core = await screen.findByRole("region", { name: /Core comes from/ });

  await userEvent.click(within(core).getByRole("switch", { name: "Follow fieldnotes/agent-skills" }));
  expect(client.calls.find(call => call.operation === "kit/follow")?.input).toEqual({ source: "fieldnotes/agent-skills", follow: true });

  await userEvent.click(within(core).getByRole("button", { name: "Update fieldnotes/agent-skills" }));
  expect(await screen.findByText("Updated 1 skill from fieldnotes/agent-skills")).toBeInTheDocument();
  expect(client.calls.find(call => call.operation === "skills/update")?.input).toEqual({ scope: "Global", names: ["kami"] });

  expect(within(core).getByText("Uploaded skills")).toBeInTheDocument();
  expect(within(core).getAllByRole("switch")).toHaveLength(1);
});

it("says so when Core has no repositories yet", async () => {
  setup();

  const core = await screen.findByRole("region", { name: /Core comes from/ });

  expect(within(core).getByText("Core has no repositories yet")).toBeInTheDocument();
});

it("offers a retry when the sources cannot be read", async () => {
  setup(undefined, { state: () => fail("AFK couldn't read your settings.") });

  expect(await screen.findByText("AFK couldn't read your settings.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
