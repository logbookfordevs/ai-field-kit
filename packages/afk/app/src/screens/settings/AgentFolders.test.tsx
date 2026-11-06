import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { AgentFolder } from "../../../../src/fieldwork/agent-folders.js";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { AgentFolders } from "@/screens/settings/AgentFolders";

function folder(overrides: Partial<AgentFolder> & { path: string; names: string[] }): AgentFolder {
  return { detected: false, enabled: false, shared: false, custom: false, mechanisms: {}, ...overrides };
}

const catalog: AgentFolder[] = [
  folder({ path: "~/.agents/skills", names: ["Codex", "Cline", "Pi", "Warp", "Zed", "Kimi Code CLI", "Dexto", "Loaf"], shared: true, enabled: true, detected: true }),
  folder({ path: "~/.cursor/skills", names: ["Cursor"], icon: "cursor.png" }),
  folder({ path: "~/.claude/skills", names: ["Claude Code"], icon: "claude_code.svg", detected: true, enabled: true, project: ".claude/skills" }),
  folder({ path: "~/.gemini/skills", names: ["Gemini CLI"], detected: true }),
  folder({ path: "~/.team/skills", names: ["Team agent"], custom: true, enabled: true }),
];

const state = { library: true, folders: catalog, invocationAgents: { claude: [], codex: [] } };

function setup(handlers = {}) {
  const client = fakeClient({ "agent-folders/state": () => state, ...handlers });
  renderWithApp(<AgentFolders />, { client });
  return client;
}

const headings = () => screen.getAllByRole("heading", { level: 3 }).map(node => node.textContent);

it("lists the shared folder first, naming who reads it, then detected agents, then your own folders", async () => {
  setup();

  await screen.findByText("Claude Code");
  expect(headings()).toEqual(["Shared folder", "Detected on this machine", "Your folders"]);
  const shared = screen.getByRole("list", { name: "Shared folder" });
  expect(within(shared).getByText("Read by Codex, Cline, Pi, Warp, Zed, Kimi Code CLI and 2 more")).toBeInTheDocument();
  expect(within(shared).getByText("Always on")).toBeInTheDocument();
  const detected = screen.getByRole("list", { name: "Detected on this machine" });
  expect(within(detected).getAllByRole("switch").map(item => item.getAttribute("aria-label"))).toEqual(["Link skills into Claude Code", "Link skills into Gemini CLI"]);
});

it("hides agents that are not detected until you ask for all of them", async () => {
  setup();
  await screen.findByText("Claude Code");
  expect(screen.queryByText("Cursor")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Show all (1 more)" }));

  expect(screen.getByRole("heading", { level: 3, name: "Other known agents" })).toBeInTheDocument();
  expect(screen.getByText("Cursor")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hide other agents" })).toHaveAttribute("aria-expanded", "true");
});

it("shows each agent's icon from the shipped set, and a letter when it has none", async () => {
  setup();
  await screen.findByText("Claude Code");

  const claudeRow = screen.getByText("Claude Code").closest("li")!;
  expect(claudeRow.querySelector("img")).toHaveAttribute("src", "/assets/agent-icons/claude_code.svg");
  const geminiRow = screen.getByText("Gemini CLI").closest("li")!;
  expect(geminiRow.querySelector("img")).toBeNull();
  expect(within(geminiRow).getByText("G")).toBeInTheDocument();
});

it("links and unlinks a folder through the agent folder operations", async () => {
  const client = setup({ "agent-folders/enable": () => state, "agent-folders/disable": () => state });
  await screen.findByText("Claude Code");

  await userEvent.click(screen.getByRole("switch", { name: "Link skills into Gemini CLI" }));
  await userEvent.click(screen.getByRole("switch", { name: "Link skills into Claude Code" }));

  expect(client.calls.filter(call => call.operation.startsWith("agent-folders/") && call.operation !== "agent-folders/state")).toEqual([
    { operation: "agent-folders/enable", input: { path: "~/.gemini/skills" } },
    { operation: "agent-folders/disable", input: { path: "~/.claude/skills" } },
  ]);
});

it("removes a custom folder you added", async () => {
  const client = setup({ "agent-folders/remove": () => state });
  await screen.findByText("Team agent");

  await userEvent.click(screen.getByRole("button", { name: "Remove Team agent" }));

  expect(client.calls).toContainEqual({ operation: "agent-folders/remove", input: { path: "~/.team/skills" } });
});

it("adds a custom folder, keeping the dialog open with the reason when AFK refuses it", async () => {
  let reply: unknown = fail("The folder cannot be inside AFK's library.");
  const client = setup({ "agent-folders/add": () => reply });
  await screen.findByText("Claude Code");

  await userEvent.click(screen.getByRole("button", { name: "Add a folder" }));
  const dialog = screen.getByRole("dialog", { name: "Add a folder" });
  await userEvent.type(within(dialog).getByLabelText("Name"), "Team agent");
  await userEvent.type(within(dialog).getByLabelText("Global skills folder"), "~/.afk/library/x");
  await userEvent.type(within(dialog).getByLabelText("Project skills folder (optional)"), ".team/skills");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add folder" }));

  expect(await within(dialog).findByText("The folder cannot be inside AFK's library.")).toBeInTheDocument();
  expect(client.calls).toContainEqual({ operation: "agent-folders/add", input: { name: "Team agent", global: "~/.afk/library/x", project: ".team/skills" } });

  reply = state;
  await userEvent.clear(within(dialog).getByLabelText("Global skills folder"));
  await userEvent.type(within(dialog).getByLabelText("Global skills folder"), "~/.team/skills");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add folder" }));

  expect(screen.queryByRole("dialog", { name: "Add a folder" })).not.toBeInTheDocument();
});

it("checks the custom folder before asking AFK: a name, and a path from ~/ or the root", async () => {
  const client = setup();
  await screen.findByText("Claude Code");
  await userEvent.click(screen.getByRole("button", { name: "Add a folder" }));
  const dialog = screen.getByRole("dialog", { name: "Add a folder" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Add folder" }));
  expect(within(dialog).getByText("Give the folder a name.")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Name")).toHaveFocus();

  await userEvent.type(within(dialog).getByLabelText("Name"), "Team agent");
  await userEvent.type(within(dialog).getByLabelText("Global skills folder"), "team/skills");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add folder" }));
  expect(within(dialog).getByText("Use an absolute path or one starting with ~/.")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Global skills folder")).toHaveFocus();
  expect(client.calls.some(call => call.operation === "agent-folders/add")).toBe(false);
});

it("points to starting a library when there is none", async () => {
  renderWithApp(<AgentFolders />, { client: fakeClient({ "agent-folders/state": () => ({ library: false, folders: [], invocationAgents: { claude: [], codex: [] } }) }) });

  expect(await screen.findByText(/Start a library first/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add a folder" })).not.toBeInTheDocument();
});
