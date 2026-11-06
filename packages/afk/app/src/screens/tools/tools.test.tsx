import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { screen as toolsScreen } from "@/screens/tools";
import type { ToolEntry, ToolRun } from "@/screens/tools/types";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const Tools = toolsScreen.Screen;
const home = "/Users/sam";

const cli: ToolEntry = { id: 1, name: "Skills CLI", install: "npm install -g skills", update: "npm update -g skills", provides: ["kami"] };
const brew: ToolEntry = { id: 2, name: "Brew helper", install: "brew install helper", update: "" };

interface Fixture {
  tools: ToolEntry[];
  runs: Record<number, ToolRun>;
}

function backend(initial: Partial<Fixture> = {}, extra: Parameters<typeof fakeClient>[0] = {}) {
  const fixture: Fixture = { tools: [cli, brew], runs: {}, ...initial };
  const settings = () => ({ version: 3, profiles: [], projects: [], favoriteSources: [], tools: fixture.tools });
  const client = fakeClient({
    "tool/state": () => ({ tools: fixture.tools, runs: fixture.runs, home }),
    state: () => ({ settings: settings() }),
    settings: input => {
      fixture.tools = (input.settings as { tools: ToolEntry[] }).tools;
      return {};
    },
    ...extra,
  });
  return { client, fixture };
}

const renderTools = (client: ReturnType<typeof backend>["client"]) => renderWithApp(<Tools params={new URLSearchParams()} />, { client });

const saved = (client: ReturnType<typeof backend>["client"]) => client.calls.filter(call => call.operation === "settings").map(call => (call.input.settings as { tools: ToolEntry[] }).tools);
const ran = (client: ReturnType<typeof backend>["client"]) => client.calls.filter(call => call.operation === "tool/run").map(call => call.input);

it("lists each tool with its commands, the skills it brings and where it last ran", async () => {
  const { client } = backend({ runs: { 1: { pending: false, code: 0, output: "ok" }, 2: { pending: false, code: 2, output: "no" } } });
  renderTools(client);

  expect(await screen.findByText("Skills CLI")).toBeInTheDocument();
  expect(screen.getByText("npm install -g skills")).toBeInTheDocument();
  expect(screen.getByText("npm update -g skills")).toBeInTheDocument();
  expect(screen.getByText("kami")).toBeInTheDocument();
  expect(screen.getByText("Reuses the install command")).toBeInTheDocument();
  expect(screen.getByText("Last run · exit 0")).toBeInTheDocument();
  expect(screen.getByText("Last run · exit 2")).toBeInTheDocument();
});

it("says what is missing and how to add a tool when none are saved", async () => {
  renderTools(backend({ tools: [] }).client);

  expect(await screen.findByText("No tools saved")).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: "Add tool" })[0]!);
  expect(screen.getByRole("dialog", { name: "Add a tool" })).toBeInTheDocument();
});

it("asks for a name and an install command next to the field and saves nothing until both are given", async () => {
  const { client } = backend();
  renderTools(client);
  await userEvent.click((await screen.findAllByRole("button", { name: "Add tool" }))[0]!);

  await userEvent.click(screen.getByRole("button", { name: "Save tool" }));
  const name = screen.getByRole("textbox", { name: "Name" });
  expect(name).toBeInvalid();
  expect(name).toHaveAccessibleDescription("Name the tool.");
  expect(name).toHaveFocus();

  await userEvent.type(name, "Linter");
  await userEvent.click(screen.getByRole("button", { name: "Save tool" }));
  const install = screen.getByRole("textbox", { name: "Install command" });
  expect(install).toHaveAccessibleDescription("Add an install command.");
  expect(install).toHaveFocus();
  expect(saved(client)).toEqual([]);
});

it("saves a new tool with its provided skills and runs nothing", async () => {
  const { client } = backend();
  renderTools(client);
  await userEvent.click((await screen.findAllByRole("button", { name: "Add tool" }))[0]!);

  await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "  Linter ");
  await userEvent.type(screen.getByRole("textbox", { name: "Install command" }), "npm i -g lint");
  await userEvent.type(screen.getByRole("textbox", { name: /Skills it brings/ }), "style, review style");
  await userEvent.click(screen.getByRole("button", { name: "Save tool" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const [tools] = saved(client);
  expect(tools?.slice(0, 2)).toEqual([cli, brew]);
  expect(tools?.[2]).toMatchObject({ name: "Linter", install: "npm i -g lint", update: "", provides: ["style", "review"] });
  expect(ran(client)).toEqual([]);
  expect(await screen.findByText("Linter")).toBeInTheDocument();
});

it("edits a tool in place and keeps the form with the server's reason when saving fails", async () => {
  const { client } = backend({}, { settings: () => fail("A skill can only come from one tool.") });
  renderTools(client);
  await userEvent.click(await screen.findByRole("button", { name: "Edit Skills CLI" }));

  const install = screen.getByRole("textbox", { name: "Install command" });
  expect(install).toHaveValue("npm install -g skills");
  await userEvent.clear(install);
  await userEvent.type(install, "npm i -g skills@2");
  await userEvent.click(screen.getByRole("button", { name: "Save tool" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("A skill can only come from one tool.");
  expect(screen.getByRole("textbox", { name: "Install command" })).toHaveValue("npm i -g skills@2");
});

it("keeps the tool's position and id when an edit is saved", async () => {
  const { client } = backend();
  renderTools(client);
  await userEvent.click(await screen.findByRole("button", { name: "Edit Skills CLI" }));

  const name = screen.getByRole("textbox", { name: "Name" });
  await userEvent.clear(name);
  await userEvent.type(name, "Skills CLI 2");
  await userEvent.click(screen.getByRole("button", { name: "Save tool" }));

  await waitFor(() => expect(saved(client)).toHaveLength(1));
  expect(saved(client)[0]).toEqual([{ ...cli, name: "Skills CLI 2" }, brew]);
});

it("removes only the entry after confirming, and says the installed tool stays", async () => {
  const { client } = backend();
  renderTools(client);

  const more = await screen.findByRole("button", { name: "More for Brew helper" });
  await userEvent.click(more);
  const menu = document.getElementById(more.getAttribute("aria-controls") ?? "")!;
  await userEvent.click(within(menu).getByRole("button", { name: "Remove entry…" }));
  const confirm = screen.getByRole("dialog", { name: "Remove Brew helper?" });
  expect(confirm).toHaveTextContent("does not uninstall");
  expect(saved(client)).toEqual([]);
  await userEvent.click(within(confirm).getByRole("button", { name: "Remove entry" }));

  await waitFor(() => expect(saved(client)).toEqual([[cli]]));
  await waitFor(() => expect(screen.queryByText("Brew helper")).not.toBeInTheDocument());
});

it("copies a command without running it, under a label that says so", async () => {
  const user = userEvent.setup();
  const { client } = backend();
  renderTools(client);

  await user.click(await screen.findByRole("button", { name: "Copy install command for Skills CLI" }));

  expect(await navigator.clipboard.readText()).toBe("npm install -g skills");
  expect(await screen.findByText(/Nothing was run/)).toBeInTheDocument();
  expect(ran(client)).toEqual([]);
});

it("shows the exact command and where it runs, and runs it only on the Run command button", async () => {
  const { client } = backend({}, { "tool/run": () => ({ code: 0, output: "installed", reapplied: [], warnings: [] }) });
  renderTools(client);

  await userEvent.click(await screen.findByRole("button", { name: "Run install for Skills CLI" }));
  const dialog = screen.getByRole("dialog", { name: "Run install for Skills CLI" });
  expect(within(dialog).getByText("npm install -g skills")).toBeInTheDocument();
  expect(within(dialog).getByText(home)).toBeInTheDocument();
  expect(ran(client)).toEqual([]);

  await userEvent.click(within(dialog).getByRole("button", { name: "Run command" }));
  await waitFor(() => expect(ran(client)).toEqual([{ id: 1, update: false }]));
});

it("runs the update command, or the install command when there is no update command", async () => {
  const { client } = backend({}, { "tool/run": () => ({ code: 0, output: "", reapplied: [], warnings: [] }) });
  renderTools(client);

  await userEvent.click(await screen.findByRole("button", { name: "Run update for Brew helper" }));
  const dialog = screen.getByRole("dialog", { name: "Run update for Brew helper" });
  expect(within(dialog).getByText("brew install helper")).toBeInTheDocument();
  expect(within(dialog).getByText(/no update command/i)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Run command" }));

  await waitFor(() => expect(ran(client)).toEqual([{ id: 2, update: true }]));
});

it("streams output while the command runs and keeps it readable with the exit code afterwards", async () => {
  let finish: (value: unknown) => void = () => {};
  const finished = new Promise(resolve => { finish = resolve; });
  const { client, fixture } = backend({}, {
    "tool/run": async () => {
      fixture.runs[1] = { pending: true, output: "Fetching package\n" };
      return finished;
    },
  });
  renderTools(client);
  await userEvent.click(await screen.findByRole("button", { name: "Run install for Skills CLI" }));
  const dialog = screen.getByRole("dialog", { name: "Run install for Skills CLI" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Run command" }));
  expect(await within(dialog).findByText(/Fetching package/, {}, { timeout: 3000 })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Running…" })).toBeDisabled();

  fixture.runs[1] = { pending: true, output: "Fetching package\nLinking skills\n" };
  expect(await within(dialog).findByText(/Linking skills/, {}, { timeout: 3000 })).toBeInTheDocument();

  fixture.runs[1] = { pending: false, code: 0, output: "Fetching package\nLinking skills\nDone\n", reapplied: ["kami"], warnings: ["kami is turned off, but Skills CLI installed it again."] };
  finish({ code: 0 });
  expect(await within(dialog).findByText("Exit 0")).toBeInTheDocument();
  expect(within(dialog).getByText(/Done/)).toBeInTheDocument();
  expect(within(dialog).getByText(/kami is turned off/)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Run again" })).toBeEnabled();
});

it("reports a failed run by its exit code and keeps the output", async () => {
  const { client, fixture } = backend({}, {
    "tool/run": () => {
      fixture.runs[2] = { pending: false, code: 127, output: "helper: not found\n" };
      return { code: 127, output: "helper: not found\n", reapplied: [], warnings: [] };
    },
  });
  renderTools(client);
  await userEvent.click(await screen.findByRole("button", { name: "Run install for Brew helper" }));
  const dialog = screen.getByRole("dialog", { name: "Run install for Brew helper" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Run command" }));

  expect(await within(dialog).findByText("Exit 127")).toBeInTheDocument();
  expect(within(dialog).getByText(/helper: not found/)).toBeInTheDocument();
});

it("shows a command that could not start as a failure with the reason", async () => {
  const { client, fixture } = backend({}, {
    "tool/run": () => {
      fixture.runs[2] = { pending: false, code: 1, output: "The tool command could not start: spawn ENOENT" };
      return fail("The tool command could not start: spawn ENOENT");
    },
  });
  renderTools(client);
  await userEvent.click(await screen.findByRole("button", { name: "Run install for Brew helper" }));
  const dialog = screen.getByRole("dialog", { name: "Run install for Brew helper" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Run command" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not start");
  expect(within(dialog).getByRole("button", { name: "Run again" })).toBeEnabled();
});

it("reviews every command before an all-tools run, then runs them one at a time and carries on after a failure", async () => {
  const { client } = backend({}, {
    "tool/run": input => ({ code: input.id === 1 ? 1 : 0, output: `output ${String(input.id)}`, reapplied: [], warnings: [] }),
  });
  renderTools(client);

  await userEvent.click(await screen.findByRole("button", { name: "More tool actions" }));
  await userEvent.click(screen.getByRole("button", { name: "Update all tools…" }));
  const dialog = screen.getByRole("dialog", { name: "Update all tools" });
  expect(within(dialog).getByText("npm update -g skills")).toBeInTheDocument();
  expect(within(dialog).getByText("brew install helper")).toBeInTheDocument();
  expect(ran(client)).toEqual([]);

  await userEvent.click(within(dialog).getByRole("button", { name: "Run all commands" }));

  expect(await within(dialog).findByText("Failed · exit 1")).toBeInTheDocument();
  expect(await within(dialog).findByText("Complete")).toBeInTheDocument();
  expect(ran(client)).toEqual([{ id: 1, update: true }, { id: 2, update: true }]);
  expect(within(dialog).getByText("output 1")).toBeInTheDocument();
});
