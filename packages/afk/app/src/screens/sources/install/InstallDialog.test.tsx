import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { InstallDialog } from "@/screens/sources/install/InstallDialog";
import type { InstallRequest } from "@/screens/sources/install/store";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const state = {
  settings: {
    favoriteSources: [],
    profiles: [{ id: "pack-writing", name: "Writing" }, { id: "pack-ops", name: "Ops" }],
    projects: [{ name: "Workbench", path: "/work/bench" }],
  },
};

const candidates = [
  { name: "kami", description: "Typeset documents", state: "new" },
  { name: "hairline", description: "Thin rules", state: "new" },
  { name: "ledger", description: "Keep accounts", state: "conflict", installedFrom: "other/repo" },
  { name: "tool-skill", description: "From a tool", state: "tool", tool: "Skills Pro" },
];

const installed = (to: string) => ({ ok: true, to, status: {} });

function setup(request: InstallRequest = {}, handlers: Parameters<typeof fakeClient>[0] = {}) {
  const client = fakeClient({
    state: () => state,
    "kit/install-preview": ({ source }) => ({ source, candidates }),
    "kit/install": ({ to }) => installed(String(to)),
    "skills/install-state": () => null,
    ...handlers,
  });
  const onClose = vi.fn();
  renderWithApp(<InstallDialog request={request} onClose={onClose} />, { client });
  return { client, onClose };
}

const callsTo = (client: ReturnType<typeof fakeClient>, operation: string) => client.calls.filter(call => call.operation === operation);

async function findSkills(source = "fieldnotes/agent-skills") {
  await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), source);
  await userEvent.click(screen.getByRole("button", { name: "Find skills" }));
  await screen.findByRole("group", { name: /Skills in/ });
}

async function chooseDestination(name: string) {
  await userEvent.click(within(screen.getByRole("group", { name: "Where should they go?" })).getByRole("radio", { name: new RegExp(`^${name}`) }));
}

it("finds a repository's skills, installs the picked ones to Core and says where they went", async () => {
  const { client } = setup();

  await findSkills();
  expect(callsTo(client, "kit/install-preview")[0]?.input).toEqual({ source: "fieldnotes/agent-skills" });
  expect(screen.getByText("Left out because a tool installs them: tool-skill (Skills Pro).")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /tool-skill/ })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));

  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "core" });
  expect(await screen.findByRole("heading", { name: "1 skill installed to Core" })).toBeInTheDocument();
  expect(screen.getByText("They are on for every agent and saved with your next backup.")).toBeInTheDocument();
});

it("asks for a destination when the person submits without one, and focuses the first choice", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));

  await userEvent.click(screen.getByRole("button", { name: "Install" }));

  expect(screen.getByText("Choose where the skills go.")).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: "Where should they go?" })).getAllByRole("radio")[0]).toHaveFocus();
  expect(callsTo(client, "kit/install")).toHaveLength(0);
});

it("asks for a skill when none is picked, and for a search when none was run", async () => {
  const { client } = setup();

  await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), "fieldnotes/agent-skills");
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Find the skills in this repository first.")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Find skills" }));
  await screen.findByRole("group", { name: /Skills in/ });
  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Select at least one skill to install.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")).toHaveLength(0);
});

it("installs into an existing pack, and into a new one it asks to name", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("A pack");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to a pack" }));
  expect(screen.getByText("Choose a pack.")).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pack" }), "New pack…");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to a new pack" }));
  expect(screen.getByText("Name the new pack.")).toBeInTheDocument();

  await userEvent.type(screen.getByRole("textbox", { name: "New pack name" }), "Fresh");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to a new pack" }));
  await screen.findByRole("heading", { name: "1 skill added to Fresh" });
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "new-pack", packName: "Fresh" });
});

it("adds to a chosen pack by its id", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("A pack");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pack" }), "Ops");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Ops" }));

  await screen.findByRole("heading", { name: "1 skill added to Ops" });
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "pack-ops" });
});

it("installs on this machine, into a project when one is chosen", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("This machine");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Install into" }), "Workbench");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill in Workbench" }));

  expect(await screen.findByText("They stay with that project and are never backed up.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "machine", scope: "Workbench" });
});

it("installs on this machine for every project by default", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("This machine");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill on this machine" }));

  expect(await screen.findByText("They stay on this machine and are never backed up.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "machine" });
});

it("saves a repository to Try later under a name it asks for, without installing", async () => {
  const { client } = setup({ destination: "later" });

  await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), "https://github.com/hairline/type.git");
  const name = screen.getByRole("textbox", { name: "Name" });
  expect(name).toHaveValue("type");
  await userEvent.clear(name);
  await userEvent.click(screen.getByRole("button", { name: "Save to Try later" }));
  expect(screen.getByText("Give this repository a name.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")).toHaveLength(0);

  await userEvent.type(name, "Hairline type");
  await userEvent.click(screen.getByRole("button", { name: "Save to Try later" }));

  expect(await screen.findByRole("heading", { name: "hairline/type is in Try later" })).toBeInTheDocument();
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "https://github.com/hairline/type.git", names: [], to: "later", name: "Hairline type" });
});

it("opened from a bookmark, prefills the repository and its saved skills and still asks for the destination", async () => {
  const { client } = setup({ repository: "fieldnotes/agent-skills", skills: ["hairline"] });

  await screen.findByRole("group", { name: /Skills in/ });
  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveValue("fieldnotes/agent-skills");
  expect(screen.getByRole("checkbox", { name: /hairline/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /kami/ })).not.toBeChecked();
  const destinations = within(screen.getByRole("group", { name: "Where should they go?" })).getAllByRole("radio");
  expect(destinations.some(radio => (radio as HTMLInputElement).checked)).toBe(false);

  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Choose where the skills go.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")).toHaveLength(0);
});

it("asks before replacing a skill installed from another repository, and passes the approval along", async () => {
  const { client } = setup();
  await findSkills();
  expect(screen.getByText("Installed from other/repo. Installing replaces it.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox", { name: /ledger/ }));
  await chooseDestination("Core");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));

  await screen.findByRole("heading", { name: "1 skill installed to Core" });
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["ledger"], to: "core", replace: ["ledger"] });
});

it("shows live progress while installing, and cancels through the operation", async () => {
  let finish: (value: unknown) => void = () => {};
  const { client } = setup({}, {
    "kit/install": () => new Promise(resolve => { finish = resolve; }),
    "skills/install-state": () => ({ pending: true, phase: "Installing kami", item: "kami", completed: 1, total: 2, output: "cloning…", scope: "Global", agent: "universal", label: "Install", startedAt: Date.now() }),
    "skills/install-cancel": () => ({ cancelled: true }),
  });
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: /hairline/ }));
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install 2 skills to Core" }));

  expect(await screen.findByRole("progressbar", { name: /Installing kami/ })).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByRole("button", { name: "Installing…" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel installation" }));
  expect(callsTo(client, "skills/install-cancel")).toHaveLength(1);

  finish({ ok: false, to: "core", install: { pending: false, phase: "Installation cancelled", output: "stopped", code: 130, cancelled: true, completed: 1, total: 2, scope: "Global", agent: "universal", label: "Install" } });
  expect(await screen.findByText("Installation stopped, so nothing was added to Core. Review the output, then retry.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Install 2 skills to Core" })).toBeEnabled();
});

it("keeps what was entered and shows the reason when the install fails", async () => {
  setup({}, { "kit/install": () => fail("Skills CLI isn't available.") });
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("Core");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));

  expect(await screen.findByText("Skills CLI isn't available.")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /kami/ })).toBeChecked();
});

it("explains a repository that cannot be searched", async () => {
  setup({}, { "kit/install-preview": () => fail("Could not reach that repository.") });
  await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), "nobody/nothing");

  await userEvent.click(screen.getByRole("button", { name: "Find skills" }));

  await waitFor(() => expect(screen.getByText("Could not reach that repository.")).toBeInTheDocument());
});

const uploadCandidates = [
  { name: "kami", description: "Typeset documents", state: "new", files: 3, bytes: 2048 },
  { name: "ledger", description: "Keep accounts", state: "installed", installedFrom: "other/repo", files: 1, bytes: 512 },
];

function setupUpload(handlers: Parameters<typeof fakeClient>[0] = {}) {
  return setup({ source: "upload" }, {
    "kit/upload-preview": () => ({ upload: "upload-1", candidates: uploadCandidates }),
    "kit/upload-install": ({ to }) => installed(String(to)),
    ...handlers,
  });
}

it("reads an uploaded zip, shows size and the no-auto-update note, and installs to Core", async () => {
  const { client } = setupUpload();

  await userEvent.upload(screen.getByLabelText("Zip or .skill file"), new File(["zip"], "skills.zip", { type: "application/zip" }));
  await screen.findByRole("group", { name: "Skills in skills.zip" });

  expect(screen.getByText(/don’t update on their own/)).toBeInTheDocument();
  expect(screen.getByText("3 files · 2 KB")).toBeInTheDocument();
  expect(screen.getByText("Installed from other/repo. Installing replaces it.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-preview")[0]?.input).toEqual({ archive: "emlw", name: "skills.zip" });

  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));

  expect(await screen.findByText("Saved in your library and added to Core. It is in your backup.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-install")[0]?.input).toEqual({ upload: "upload-1", names: ["kami"], to: "core" });
});

it("approves replacing an installed skill from an upload and can put it in a pack", async () => {
  const { client } = setupUpload();
  await userEvent.upload(screen.getByLabelText("Zip or .skill file"), new File(["zip"], "skills.zip"));
  await screen.findByRole("group", { name: "Skills in skills.zip" });
  await userEvent.click(screen.getByRole("checkbox", { name: /ledger/ }));
  await chooseDestination("A pack");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pack" }), "Writing");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Writing" }));

  expect(await screen.findByText("Saved in your library and added to the pack. Turning the pack on needs no download.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-install")[0]?.input).toEqual({ upload: "upload-1", names: ["ledger"], to: "pack-writing", replace: ["ledger"] });
});

it("reads a chosen folder with its relative paths, and offers every destination except Try later", async () => {
  const { client } = setupUpload();
  const file = new File(["---"], "SKILL.md");
  Object.defineProperty(file, "webkitRelativePath", { value: "kami/SKILL.md" });

  await userEvent.upload(screen.getByLabelText("Skill folder"), file);
  await screen.findByRole("group", { name: "Skills in kami" });

  expect(callsTo(client, "kit/upload-preview")[0]?.input).toEqual({ files: [{ path: "kami/SKILL.md", base64: "LS0t" }] });
  const destinations = within(screen.getByRole("group", { name: "Where should they go?" }));
  expect(destinations.getByRole("radio", { name: /^Try later/ })).toBeDisabled();
  expect(destinations.getByText("Only for repositories.")).toBeInTheDocument();
});

it("refuses an upload over 25 MB before sending anything", async () => {
  const { client } = setupUpload();
  const big = new File(["x"], "big.zip");
  Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });

  await userEvent.upload(screen.getByLabelText("Zip or .skill file"), big);

  expect(await screen.findByText("That is too large. Skills can total at most 25 MB.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-preview")).toHaveLength(0);
});

it("asks for a file before installing from an upload, and drops Try later when switching to one", async () => {
  setup({ destination: "later" });

  await userEvent.click(screen.getByRole("radio", { name: "A zip or folder" }));
  expect(within(screen.getByRole("group", { name: "Where should they go?" })).getAllByRole("radio").some(radio => (radio as HTMLInputElement).checked)).toBe(false);

  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Choose a zip, a .skill file or a folder first.")).toBeInTheDocument();
});

it("reads a repository skill's SKILL.md before installing it", async () => {
  const { client } = setup({}, { "kit/install-read": () => ({ content: "# Kami\nTypeset." }) });
  await findSkills();

  await userEvent.click(screen.getAllByText("Read SKILL.md")[0]!);

  expect(await screen.findByText(/Typeset\./)).toBeInTheDocument();
  expect(callsTo(client, "kit/install-read")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", name: "kami" });
});

it("refuses to close while an install runs", async () => {
  let finish: (value: unknown) => void = () => {};
  const { onClose } = setup({}, { "kit/install": () => new Promise(resolve => { finish = resolve; }) });
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));

  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(onClose).not.toHaveBeenCalled();
  expect(await screen.findByText("Installation is still running. Cancel it first to close.")).toBeInTheDocument();
  finish(installed("core"));
  await screen.findByRole("heading", { name: "1 skill installed to Core" });
});

it("starts over from the success panel", async () => {
  setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await chooseDestination("Core");
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill to Core" }));
  await screen.findByRole("heading", { name: "1 skill installed to Core" });

  await userEvent.click(screen.getByRole("button", { name: "Add another" }));

  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveValue("");
  expect(screen.queryByRole("group", { name: /Skills in/ })).not.toBeInTheDocument();
});
