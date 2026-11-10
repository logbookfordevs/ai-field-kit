import { screen, waitFor } from "@testing-library/react";
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


it("finds a repository's skills, installs the picked ones to To review and says what comes next", async () => {
  const { client } = setup();

  await findSkills();
  expect(callsTo(client, "kit/install-preview")[0]?.input).toEqual({ source: "fieldnotes/agent-skills" });
  expect(screen.getByText("Left out because a tool installs them: tool-skill (Skills Pro).")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /tool-skill/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Where should they go?" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "review" });
  expect(await screen.findByRole("heading", { name: "1 skill installed" })).toBeInTheDocument();
  expect(screen.getByText(/wait in To review/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open To review" })).toBeInTheDocument();
});

it("installs for every agent, whatever an earlier version of the app remembered", async () => {
  localStorage.setItem("afk.install", JSON.stringify({ agent: "cursor" }));
  try {
    const { client } = setup();
    await findSkills();
    await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));

    await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

    expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "review" });
  } finally { localStorage.removeItem("afk.install"); }
});

it("asks for a skill when none is picked, and for a search when none was run", async () => {
  const { client } = setup();

  await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), "fieldnotes/agent-skills");
  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Find the skills in this repository first.")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Find skills" }));
  await screen.findByRole("group", { name: /Skills in/ });
  await userEvent.click(screen.getByRole("button", { name: "Install" }));
  expect(screen.getByText("Select at least one skill to install.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")).toHaveLength(0);
});

it("installs into a project when one is chosen", async () => {
  const { client } = setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Install into" }), "Workbench");

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill in Workbench" }));

  expect(await screen.findByText("They stay with that project and outside your library.")).toBeInTheDocument();
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["kami"], to: "machine", scope: "Workbench" });
});

it("saves a repository to Try later under a name it asks for, without installing", async () => {
  const { client } = setup({ destination: "later" });

  expect(screen.queryByRole("radio", { name: "A zip or folder" })).not.toBeInTheDocument();
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

it("opened from a bookmark, prefills the repository and its saved skills", async () => {
  setup({ repository: "fieldnotes/agent-skills", skills: ["hairline"] });

  await screen.findByRole("group", { name: /Skills in/ });
  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveValue("fieldnotes/agent-skills");
  expect(screen.getByRole("checkbox", { name: /hairline/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /kami/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Install 1 skill" })).toBeEnabled();
});

it("locks skills that are already installed, says where they are, and selects only the new ones", async () => {
  const listed = [
    { name: "kami", description: "Typeset documents", state: "installed", inKit: "Core" },
    { name: "hairline", description: "Thin rules", state: "new" },
    { name: "quill", description: "Edit prose", state: "new" },
  ];
  const { client } = setup({}, { "kit/install-preview": ({ source }) => ({ source, candidates: listed }) });
  await findSkills();

  expect(screen.getByRole("checkbox", { name: /kami/ })).toBeDisabled();
  expect(screen.getByText("Already installed · In Core")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Select all new (2)" }));
  await userEvent.click(screen.getByRole("button", { name: "Install 2 skills" }));

  await waitFor(() => expect(callsTo(client, "kit/install")[0]?.input).toMatchObject({ names: ["hairline", "quill"], to: "review" }));
});

it("asks before replacing a skill installed from another repository, and passes the approval along", async () => {
  const { client } = setup();
  await findSkills();
  expect(screen.getByText("Installed from other/repo. Installing replaces it.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox", { name: /ledger/ }));

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

  await screen.findByRole("heading", { name: "1 skill installed" });
  expect(callsTo(client, "kit/install")[0]?.input).toEqual({ source: "fieldnotes/agent-skills", names: ["ledger"], to: "review", replace: ["ledger"] });
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
  await userEvent.click(screen.getByRole("button", { name: "Install 2 skills" }));

  expect(await screen.findByRole("progressbar", { name: /Installing kami/ })).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByRole("button", { name: "Installing…" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel installation" }));
  expect(callsTo(client, "skills/install-cancel")).toHaveLength(1);

  finish({ ok: false, to: "review", install: { pending: false, phase: "Installation cancelled", output: "stopped", code: 130, cancelled: true, completed: 1, total: 2, scope: "Global", agent: "universal", label: "Install" } });
  expect(await screen.findByText("Installation stopped. Review the output, then retry.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Install 2 skills" })).toBeEnabled();
});

it("keeps what was entered and shows the reason when the install fails", async () => {
  setup({}, { "kit/install": () => fail("Skills CLI isn't available.") });
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));

  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

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

it("reads an uploaded zip, shows size and the no-auto-update note, and installs it to To review", async () => {
  const { client } = setupUpload();

  await userEvent.upload(screen.getByLabelText("Zip or .skill file"), new File(["zip"], "skills.zip", { type: "application/zip" }));
  await screen.findByRole("group", { name: "Skills in skills.zip" });

  expect(screen.getByText(/don’t update on their own/)).toBeInTheDocument();
  expect(screen.getByText("3 files · 2 KB")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /ledger/ })).toBeDisabled();
  expect(screen.getByText("Already installed. Remove it from Skills first to replace it.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-preview")[0]?.input).toEqual({ archive: "emlw", name: "skills.zip" });

  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

  expect(await screen.findByRole("heading", { name: "1 skill installed" })).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-install")[0]?.input).toEqual({ upload: "upload-1", names: ["kami"], to: "review" });
});

it("reads a chosen folder with its relative paths", async () => {
  const { client } = setupUpload();
  const file = new File(["---"], "SKILL.md");
  Object.defineProperty(file, "webkitRelativePath", { value: "kami/SKILL.md" });

  await userEvent.upload(screen.getByLabelText("Skill folder"), file);
  await screen.findByRole("group", { name: "Skills in kami" });

  expect(callsTo(client, "kit/upload-preview")[0]?.input).toEqual({ files: [{ path: "kami/SKILL.md", base64: "LS0t" }] });
  expect(screen.queryByRole("combobox", { name: "Install into" })).not.toBeInTheDocument();
});

it("refuses an upload over 25 MB before sending anything", async () => {
  const { client } = setupUpload();
  const big = new File(["x"], "big.zip");
  Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });

  await userEvent.upload(screen.getByLabelText("Zip or .skill file"), big);

  expect(await screen.findByText("That is too large. Skills can total at most 25 MB.")).toBeInTheDocument();
  expect(callsTo(client, "kit/upload-preview")).toHaveLength(0);
});

it("asks for a file before installing from an upload", async () => {
  setup({ source: "upload" });

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
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));

  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(onClose).not.toHaveBeenCalled();
  expect(await screen.findByText("Installation is still running. Cancel it first to close.")).toBeInTheDocument();
  finish(installed("review"));
  await screen.findByRole("heading", { name: "1 skill installed" });
});

it("starts over from the success panel", async () => {
  setup();
  await findSkills();
  await userEvent.click(screen.getByRole("checkbox", { name: /kami/ }));
  await userEvent.click(screen.getByRole("button", { name: "Install 1 skill" }));
  await screen.findByRole("heading", { name: "1 skill installed" });

  await userEvent.click(screen.getByRole("button", { name: "Add another" }));

  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveValue("");
  expect(screen.queryByRole("group", { name: /Skills in/ })).not.toBeInTheDocument();
});
