import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { screen as packsScreen } from "@/screens/packs";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { pack, packState, skillEntry } from "@/screens/packs/fixtures";
import type { InstallProgress, PackState } from "@/screens/packs/types";

const download = vi.hoisted(() => ({ downloadJson: vi.fn() }));
vi.mock("@/screens/packs/download", () => download);

const { Screen } = packsScreen;

function renderPacks(handlers: Parameters<typeof fakeClient>[0]) {
  const client = fakeClient(handlers);
  return { client, ...renderWithApp(<Screen params={new URLSearchParams()} />, { client }) };
}

beforeEach(() => download.downloadJson.mockClear());

const state = packState(
  [
    pack("p1", "Writing", ["kami", "editor", "outline"], { description: "Drafting and editing prose." }),
    pack("p2", "Release", ["notes"], { enabled: ["Global"] }),
  ],
  [skillEntry("kami"), skillEntry("editor"), skillEntry("notes", { available: true })],
);

it("lists each pack with its description, member count and whether it is on", async () => {
  renderPacks({ state: () => state, "skills/install-state": () => null });

  const writing = (await screen.findByRole("heading", { name: "Writing" })).closest("li")!;
  expect(within(writing).getByText("Drafting and editing prose.")).toBeInTheDocument();
  expect(within(writing).getByText(/3 skills · 2 on this machine/)).toBeInTheDocument();
  expect(within(writing).getByRole("switch", { name: "Writing" })).not.toBeChecked();
  expect(within(writing).getByText(/Turning it on links 2 skills and downloads 1\./)).toBeInTheDocument();

  const release = screen.getByRole("heading", { name: "Release" }).closest("li")!;
  expect(within(release).getByRole("switch", { name: "Release" })).toBeChecked();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it("turns a pack with everything downloaded on and off for every agent", async () => {
  let current: PackState = state;
  const { client } = renderPacks({
    state: () => current,
    "skills/install-state": () => null,
    activation: input => {
      current = packState(current.settings.profiles.map(p => p.id === input.id ? { ...p, enabled: input.enabled ? ["Global"] : [] } : p), current.inventories.Global!);
      return { ok: true };
    },
  });
  const release = (await screen.findByRole("heading", { name: "Release" })).closest("li")!;

  await userEvent.click(within(release).getByRole("switch", { name: "Release" }));

  await waitFor(() => expect(within(release).getByRole("switch", { name: "Release" })).not.toBeChecked());
  expect(client.calls.filter(call => call.operation === "activation").map(call => call.input)).toEqual([{ id: "p2", scope: "Global", enabled: false }]);

  await userEvent.click(within(release).getByRole("switch", { name: "Release" }));
  await waitFor(() => expect(within(release).getByRole("switch", { name: "Release" })).toBeChecked());
  expect(await screen.findByText("Release is on")).toBeInTheDocument();
});

it("also turns a pack off in projects where it is on", async () => {
  const projectState = packState([pack("p1", "Writing", ["kami"], { enabled: ["Global", "Site"] })], [skillEntry("kami", { available: true })]);
  const { client } = renderPacks({ state: () => projectState, "skills/install-state": () => null, activation: () => ({ ok: true }) });

  await userEvent.click(await screen.findByRole("switch", { name: "Writing" }));

  await waitFor(() => expect(client.calls.filter(call => call.operation === "activation").map(call => call.input)).toEqual([
    { id: "p1", scope: "Global", enabled: false },
    { id: "p1", scope: "Site", enabled: false },
  ]));
});

it("shows download progress while a pack turns on, and cancelling leaves it off", async () => {
  const activation = deferred<unknown>();
  let downloading = false;
  const progress: InstallProgress = {
    pending: true, phase: "Downloading skills for Writing", output: "", completed: 1, total: 2, scope: "Global", agent: "universal",
    label: "Turn on Writing", item: "acme/skills",
  };
  const { client } = renderPacks({
    state: () => state,
    "skills/install-state": () => (downloading ? progress : null),
    activation: () => { downloading = true; return activation.promise; },
    "skills/install-cancel": () => { activation.resolve(fail("The operation was aborted.")); return { cancelled: true }; },
  });
  const writing = (await screen.findByRole("heading", { name: "Writing" })).closest("li")!;

  await userEvent.click(within(writing).getByRole("switch", { name: "Writing" }));

  const bar = await within(writing).findByRole("progressbar", { name: /Downloading skills for Writing/ }, { timeout: 3000 });
  expect(bar).toHaveAttribute("aria-valuenow", "1");
  expect(bar).toHaveAttribute("aria-valuemax", "2");
  expect(within(writing).getByRole("switch", { name: "Writing" })).toBeDisabled();
  expect(within(screen.getByRole("heading", { name: "Release" }).closest("li")!).getByRole("switch")).toBeDisabled();

  await userEvent.click(within(writing).getByRole("button", { name: "Cancel download" }));

  expect(await within(writing).findByRole("alert")).toHaveTextContent("Download cancelled. Writing stays off.");
  expect(client.calls.some(call => call.operation === "skills/install-cancel")).toBe(true);
  expect(within(writing).queryByRole("progressbar")).not.toBeInTheDocument();
  expect(within(writing).getByRole("switch", { name: "Writing" })).not.toBeChecked();
  expect(within(writing).getByRole("switch", { name: "Writing" })).toBeEnabled();
});

it("says why a pack could not be turned on and leaves it off", async () => {
  renderPacks({ state: () => state, "skills/install-state": () => null, activation: () => fail("Restore these local skill files before enabling: outline.") });
  const writing = (await screen.findByRole("heading", { name: "Writing" })).closest("li")!;

  await userEvent.click(within(writing).getByRole("switch", { name: "Writing" }));

  expect(await within(writing).findByRole("alert")).toHaveTextContent("Restore these local skill files before enabling: outline.");
  expect(within(writing).getByRole("switch", { name: "Writing" })).not.toBeChecked();
});

it("lists each member with where it comes from and which ones still need downloading", async () => {
  const mixed = packState(
    [pack("p1", "Studio", ["kami", "outline", "sketch"], {
      groups: [{ source: "acme/skills", skills: ["kami", "outline"] }, { source: "Local skill selection", skills: ["sketch"] }],
      sourceNames: { "acme/skills": "Acme skills" },
    })],
    [skillEntry("kami"), skillEntry("sketch")],
  );
  renderPacks({ state: () => mixed, "skills/install-state": () => null });
  const studio = (await screen.findByRole("heading", { name: "Studio" })).closest("li")!;
  expect(within(studio).queryByRole("list", { name: "Members of Studio" })).not.toBeInTheDocument();

  await userEvent.click(within(studio).getByRole("button", { name: "Show members" }));

  const members = within(within(studio).getByRole("list", { name: "Members of Studio" })).getAllByRole("listitem").map(item => item.textContent);
  expect(members).toEqual(["kamiAcme skills", "outlineAcme skillsnot downloaded yet", "sketchThis machine"]);
  expect(within(studio).getByRole("button", { name: "Hide members" })).toHaveAttribute("aria-expanded", "true");
});

const library = [
  skillEntry("kami", { source: "acme/skills", description: "Typeset documents." }),
  skillEntry("editor", { source: "acme/skills", description: "Edit prose." }),
  skillEntry("sketch", { description: "Quick diagrams." }),
  skillEntry("draft", { source: "other/tools", description: "Draft outlines." }),
  skillEntry("lint", { tool: "linter", description: "Tool-owned." }),
];

function saveHandlers(profiles = [pack("p1", "Writing", ["kami", "outline"], { description: "Drafting." })]) {
  return { state: () => packState(profiles, library), "skills/install-state": () => null, "pack/save": () => ({ ok: true, id: "new" }) };
}

it("creates a pack from a name and chosen skills, keeping each skill with its own source", async () => {
  const { client } = renderPacks(saveHandlers());
  await screen.findByRole("heading", { name: "Writing" });

  await userEvent.click(screen.getByRole("button", { name: "Create pack" }));
  const dialog = await screen.findByRole("dialog", { name: "Create a pack" });
  expect(within(dialog).queryByRole("checkbox", { name: /lint/ })).not.toBeInTheDocument();

  await userEvent.type(within(dialog).getByRole("textbox", { name: "Pack name" }), "Studio");
  await userEvent.type(within(dialog).getByRole("searchbox", { name: "Search skills" }), "sk");
  expect(within(dialog).getByText("0 selected · showing 1")).toBeInTheDocument();
  await userEvent.clear(within(dialog).getByRole("searchbox", { name: "Search skills" }));
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /sketch/ }));
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /draft/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Selected only" }));
  expect(within(dialog).getAllByRole("checkbox")).toHaveLength(3);
  await userEvent.click(within(dialog).getByRole("button", { name: "Create pack" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const saved = client.calls.find(call => call.operation === "pack/save");
  expect(saved?.input).toEqual({
    name: "Studio",
    groups: expect.arrayContaining([
      { source: "acme/skills", skills: ["kami"] },
      { source: "Local skill selection", skills: ["sketch"] },
      { source: "other/tools", skills: ["draft"] },
    ]),
  });
  expect((saved?.input.groups as unknown[]).length).toBe(3);
  expect(await screen.findByText("Created Studio · 3 skills")).toBeInTheDocument();
});

it("asks for a name, a unique name and at least one skill before creating", async () => {
  const { client } = renderPacks(saveHandlers());
  await screen.findByRole("heading", { name: "Writing" });
  await userEvent.click(screen.getByRole("button", { name: "Create pack" }));
  const dialog = await screen.findByRole("dialog", { name: "Create a pack" });
  const create = () => userEvent.click(within(dialog).getByRole("button", { name: "Create pack" }));

  await create();
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Give the pack a name.");
  expect(within(dialog).getByRole("textbox", { name: "Pack name" })).toBeInvalid();

  await userEvent.type(within(dialog).getByRole("textbox", { name: "Pack name" }), "writing");
  await create();
  expect(within(dialog).getByRole("alert")).toHaveTextContent("There's already a pack called writing.");

  await userEvent.clear(within(dialog).getByRole("textbox", { name: "Pack name" }));
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Pack name" }), "Studio");
  await create();
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Choose at least one skill.");
  expect(client.calls.some(call => call.operation === "pack/save")).toBe(false);
});

it("edits a pack's members, keeping skills it has that this machine lacks, and shows a save failure", async () => {
  const { client } = renderPacks({ ...saveHandlers(), "pack/save": () => fail("Choose unique members.") });
  const writing = (await screen.findByRole("heading", { name: "Writing" })).closest("li")!;

  await userEvent.click(within(writing).getByRole("button", { name: "Edit members" }));
  const dialog = await screen.findByRole("dialog", { name: "Edit Writing" });
  expect(within(dialog).queryByRole("textbox", { name: "Pack name" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("checkbox", { name: /kami/ })).toBeChecked();
  expect(within(dialog).getByRole("checkbox", { name: /^outline/ })).toBeChecked();
  expect(within(dialog).getByText(/Not on this machine\. Downloads when the pack turns on\./)).toBeInTheDocument();
  expect(within(dialog).getByText("2 selected · showing 5")).toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(within(dialog).getByRole("checkbox", { name: /editor/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Save members" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose unique members.");
  expect(client.calls.find(call => call.operation === "pack/save")?.input).toEqual({
    id: "p1",
    name: "Writing",
    groups: [{ source: "acme/skills", skills: ["outline", "editor"] }],
  });
});

it("exports a pack as a manifest file", async () => {
  const manifest = { version: 1, id: "writing", name: "Writing", sources: [{ name: "skills", source: "acme/skills", skills: ["kami"] }] };
  const { client } = renderPacks({ ...saveHandlers(), "pack/manifest": () => ({ manifest }) });
  const writing = (await screen.findByRole("heading", { name: "Writing" })).closest("li")!;

  await userEvent.click(within(writing).getByRole("button", { name: "More for Writing" }));
  await userEvent.click(await screen.findByRole("button", { name: "Export manifest" }));

  await waitFor(() => expect(download.downloadJson).toHaveBeenCalledWith("writing.json", manifest));
  expect(client.calls.find(call => call.operation === "pack/manifest")?.input).toEqual({ id: "p1" });
});

it("explains why a pack with uploaded skills can't be exported, without asking AFK to try", async () => {
  const uploaded = pack("p3", "Mine", ["notes"], { source: "Uploaded skill" });
  const { client } = renderPacks(saveHandlers([uploaded]));
  const mine = (await screen.findByRole("heading", { name: "Mine" })).closest("li")!;

  await userEvent.click(within(mine).getByRole("button", { name: "More for Mine" }));
  const exportItem = await screen.findByRole("button", { name: "Export manifest" });

  expect(exportItem).toHaveAccessibleDescription("It includes uploaded skills, which have no repository to publish.");
  await userEvent.click(exportItem);
  expect(client.calls.some(call => call.operation === "pack/manifest")).toBe(false);
  expect(download.downloadJson).not.toHaveBeenCalled();
});

it("removes a pack that is off after confirming, and won't remove one that is on", async () => {
  const { client } = renderPacks({ ...saveHandlers([pack("p1", "Writing", ["kami"]), pack("p2", "Release", ["notes"], { enabled: ["Global"] })]), "pack/remove": () => ({ ok: true }) });
  const release = (await screen.findByRole("heading", { name: "Release" })).closest("li")!;
  await userEvent.click(within(release).getByRole("button", { name: "More for Release" }));
  const blocked = within(release).getByRole("button", { name: "Remove pack…" });
  expect(blocked).toHaveAccessibleDescription("Turn it off first.");
  await userEvent.click(blocked);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  const writing = screen.getByRole("heading", { name: "Writing" }).closest("li")!;
  await userEvent.click(within(writing).getByRole("button", { name: "More for Writing" }));
  await userEvent.click(within(writing).getByRole("button", { name: "Remove pack…" }));
  const dialog = await screen.findByRole("dialog", { name: "Remove Writing?" });
  expect(client.calls.some(call => call.operation === "pack/remove")).toBe(false);
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove pack" }));

  await waitFor(() => expect(client.calls.find(call => call.operation === "pack/remove")?.input).toEqual({ id: "p1" }));
  expect(await screen.findByText("Removed Writing")).toBeInTheDocument();
});

const proposed = pack("stack-studio", "Studio", ["kami", "sketch"], {
  description: "From the team.",
  origin: "https://example.com/studio.json",
  groups: [{ source: "acme/skills", skills: ["kami"] }, { source: "other/tools", skills: ["sketch"] }],
  sourceNames: { "acme/skills": "Acme skills", "other/tools": "Other tools" },
});

it("imports a pasted manifest after reviewing what it contains, saving nothing before then", async () => {
  const { client } = renderPacks({ ...saveHandlers(), "pack/import-preview": () => ({ pack: proposed, expected: null }), "pack/import": () => ({ ok: true, id: "stack-studio" }) });
  await screen.findByRole("heading", { name: "Writing" });

  await userEvent.click(screen.getByRole("button", { name: "Import pack" }));
  const dialog = await screen.findByRole("dialog", { name: "Import a pack" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Review pack" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Paste a manifest first.");

  await userEvent.click(within(dialog).getByRole("textbox", { name: "Manifest JSON" }));
  await userEvent.paste('{"version":1}');
  await userEvent.click(within(dialog).getByRole("button", { name: "Review pack" }));

  expect(await within(dialog).findByRole("heading", { name: "Studio" })).toBeInTheDocument();
  expect(within(dialog).getByText("From the team.")).toBeInTheDocument();
  expect(within(dialog).getByText("Acme skills")).toBeInTheDocument();
  expect(within(dialog).getByText("sketch")).toBeInTheDocument();
  expect(within(dialog).getByText("Saving adds this pack. No skills are installed.")).toBeInTheDocument();
  expect(client.calls.find(call => call.operation === "pack/import-preview")?.input).toEqual({ manifest: '{"version":1}' });
  expect(client.calls.some(call => call.operation === "pack/import")).toBe(false);

  await userEvent.click(within(dialog).getByRole("button", { name: "Save pack" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(client.calls.find(call => call.operation === "pack/import")?.input).toEqual({ pack: proposed, expected: null });
  expect(await screen.findByText("Imported Studio. No skills installed.")).toBeInTheDocument();
});

it("imports from a link, warns when it replaces a saved pack, and shows a problem with the manifest", async () => {
  const saved = pack("stack-studio", "Studio", ["kami"], { enabled: ["Global"] });
  let attempts = 0;
  const { client } = renderPacks({
    ...saveHandlers(),
    "pack/import-preview": () => (++attempts === 1 ? fail("The manifest must be version 1.") : { pack: proposed, expected: saved }),
    "pack/import": () => ({ ok: true, id: "stack-studio" }),
  });
  await screen.findByRole("heading", { name: "Writing" });
  await userEvent.click(screen.getByRole("button", { name: "Import pack" }));
  const dialog = await screen.findByRole("dialog", { name: "Import a pack" });

  await userEvent.click(within(dialog).getByRole("radio", { name: "From a link" }));
  await userEvent.type(within(dialog).getByRole("textbox", { name: "HTTPS link to the manifest" }), "https://example.com/studio.json");
  await userEvent.click(within(dialog).getByRole("button", { name: "Review pack" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("The manifest must be version 1.");

  await userEvent.click(within(dialog).getByRole("button", { name: "Review pack" }));
  expect(await within(dialog).findByText(/Saving replaces the saved Studio \(1 skill\) with this version\. It's on, so it stays on\./)).toBeInTheDocument();
  expect(client.calls.filter(call => call.operation === "pack/import-preview").map(call => call.input)).toEqual([
    { origin: "https://example.com/studio.json" },
    { origin: "https://example.com/studio.json" },
  ]);
  await userEvent.click(within(dialog).getByRole("button", { name: "Back" }));
  expect(within(dialog).getByRole("textbox", { name: "HTTPS link to the manifest" })).toHaveValue("https://example.com/studio.json");
});

it("says when there are no packs yet and still offers to create or import one", async () => {
  renderPacks({ state: () => packState([], library), "skills/install-state": () => null });

  expect(await screen.findByRole("heading", { name: "No packs yet" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create pack" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Import pack" })).toBeInTheDocument();
});

it("explains a failed load and tries again on request", async () => {
  let attempts = 0;
  renderPacks({ state: () => (++attempts === 1 ? fail("AFK couldn't read settings.") : state), "skills/install-state": () => null });

  expect(await screen.findByText("AFK couldn't read settings.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByRole("heading", { name: "Writing" })).toBeInTheDocument();
});
