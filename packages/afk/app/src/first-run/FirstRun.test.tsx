import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { App } from "@/App";
import { fakeClient, fail, type FakeClient } from "@/test/fake-client";

type Status = Record<string, unknown>;

const backupState = (status: Status) => () => ({
  status: { library: true, state: "off", waiting: 0, attention: 0, held: false, pushing: false, ...status },
  attention: [],
  unpushed: [],
});

const appState = (settings: Record<string, unknown> = {}) => () => ({
  settings: { profiles: [], tools: [], favoriteSources: [], ...settings },
  inventories: { Global: [] },
});

const names = (prefix: string, count: number): string[] => Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);

const skill = (name: string) => ({ name, on: true, from: "owner/repo", originals: [], record: {} });
const stored = (name: string) => ({ name, on: true, from: "owner/repo", originals: [] });

const plan = {
  library: "/home/leo/.afk/library",
  backup: "/home/leo/.afk/library-backups/2026-11-05",
  skills: names("core", 43).map(skill),
  packSkills: names("pack", 24).map(stored),
  machineSkills: names("local", 12).map(stored),
  offToolSkills: [],
  missing: ["lost-skill"],
  toolSkills: names("tool", 5),
  rules: ["AGENTS.md"],
};

afterEach(() => { location.hash = ""; });

function open(client: FakeClient): void {
  render(<App client={client} />);
}

const newMachine = () => fakeClient({ "backup/state": backupState({ library: false }) });

it("opens the app straight away when a library is already in place", async () => {
  open(fakeClient({ "backup/state": backupState({}) }));

  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Welcome to AFK" })).not.toBeInTheDocument();
});

it("offers to restore or start a new library on a machine without one, and no way to skip the library", async () => {
  open(newMachine());

  expect(await screen.findByRole("heading", { level: 1, name: "Welcome to AFK" })).toBeInTheDocument();
  const choices = screen.getByRole("group", { name: "How do you want to start?" });
  expect(within(choices).getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["start", "restore"]);
  expect(within(choices).getByRole("radio", { name: /Start a new library/ })).toBeInTheDocument();
  expect(within(choices).getByRole("radio", { name: /Restore my library/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Skip/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
});

it("asks for a choice before continuing", async () => {
  open(newMachine());

  await userEvent.click(await screen.findByRole("button", { name: "Continue" }));

  expect(screen.getByRole("alert")).toHaveTextContent("Choose how to start.");
});

it("previews a new library as one summary line and counted groups, with names behind Show names", async () => {
  const client = fakeClient({ "backup/state": backupState({ library: false }), "library/init-preview": () => plan });
  open(client);

  await userEvent.click(await screen.findByRole("radio", { name: /Start a new library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Start your library" })).toBeInTheDocument();
  expect(screen.getByText(/79 skills/)).toBeInTheDocument();
  const core = screen.getByRole("region", { name: /Core skills/ });
  expect(within(core).getByRole("heading", { name: /Core skills/ })).toHaveTextContent("43");
  expect(within(core).getByText("On every machine, always on, backed up.")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /Pack skills/ })).toHaveTextContent("24");
  expect(screen.getByRole("region", { name: /This machine only/ })).toHaveTextContent("12");
  expect(screen.getByRole("region", { name: /Tool skills/ })).toHaveTextContent("5");
  expect(screen.getByRole("region", { name: /Missing from this machine/ })).toHaveTextContent("1");
  expect(screen.getByText("/home/leo/.afk/library")).toBeInTheDocument();
  expect(screen.getByText("/home/leo/.afk/library-backups/2026-11-05")).toBeInTheDocument();
});

it("never runs skill names together as prose", async () => {
  open(fakeClient({ "backup/state": backupState({ library: false }), "library/init-preview": () => plan }));
  await userEvent.click(await screen.findByRole("radio", { name: /Start a new library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { level: 1, name: "Start your library" });

  const main = screen.getByRole("main");
  for (const paragraph of main.querySelectorAll("p")) {
    const mentioned = plan.skills.filter(entry => paragraph.textContent?.includes(entry.name));
    expect(mentioned.length, paragraph.textContent ?? "").toBeLessThanOrEqual(1);
  }
  const core = screen.getByRole("region", { name: /Core skills/ });
  const disclosure = core.querySelector("details");
  expect(disclosure).not.toHaveAttribute("open");
  expect(within(core).getAllByRole("listitem", { hidden: true })).toHaveLength(43);
});

it("starts the library from exactly the plan that was previewed, then points to Backup", async () => {
  const client = fakeClient({
    "backup/state": backupState({ library: false }),
    "library/init-preview": () => plan,
    "library/init": () => plan,
    welcome: () => ({ ok: true }),
  });
  open(client);
  await userEvent.click(await screen.findByRole("radio", { name: /Start a new library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await userEvent.click(await screen.findByRole("button", { name: "Start the library" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Your library is ready" })).toBeInTheDocument();
  expect(client.calls.find(call => call.operation === "library/init")?.input).toEqual({ expected: plan });
  expect(client.calls.map(call => call.operation)).toContain("welcome");
  expect(screen.getByText(/Backup is off/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Set up backup" }));

  expect(window.location.hash).toBe("#/backup");
  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Your library is ready" })).not.toBeInTheDocument();
});

it("keeps the preview open and says why when starting the library fails", async () => {
  open(fakeClient({
    "backup/state": backupState({ library: false }),
    "library/init-preview": () => plan,
    "library/init": () => fail("This machine's skills changed since the preview. Review the new plan before starting the library."),
  }));
  await userEvent.click(await screen.findByRole("radio", { name: /Start a new library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await userEvent.click(await screen.findByRole("button", { name: "Start the library" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("changed since the preview");
  expect(screen.getByRole("button", { name: "Start the library" })).toBeEnabled();
});

it("starts an empty library when there is nothing on the machine to move", async () => {
  const empty = { ...plan, skills: [], packSkills: [], machineSkills: [], missing: [], toolSkills: [], rules: [] };
  open(fakeClient({ "backup/state": backupState({ library: false }), "library/init-preview": () => empty }));
  await userEvent.click(await screen.findByRole("radio", { name: /Start a new library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  expect(await screen.findByText(/No skills to move yet/)).toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start the library" })).toBeInTheDocument();
});

it("on a library that AFK started empty, offers backup instead of starting one, and lets you skip it", async () => {
  const client = fakeClient({
    "backup/state": backupState({ fresh: true }),
    state: appState(),
    welcome: () => ({ ok: true }),
  });
  open(client);

  expect(await screen.findByRole("heading", { level: 1, name: "Welcome to AFK" })).toBeInTheDocument();
  const choices = screen.getByRole("group", { name: "How do you want to start?" });
  expect(within(choices).getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["backup", "restore"]);
  expect(within(choices).queryByRole("radio", { name: /Start a new library/ })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
  expect(client.calls.map(call => call.operation)).toContain("welcome");
  expect(client.calls.map(call => call.operation)).not.toContain("library/init");
});

it("does not ask again once the welcome was dismissed", async () => {
  open(fakeClient({ "backup/state": backupState({ fresh: true }), state: appState({ welcomeDismissed: true }) }));

  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
});

it("opens Backup from the backup choice", async () => {
  open(fakeClient({ "backup/state": backupState({ fresh: true }), state: appState(), welcome: () => ({ ok: true }) }));

  await userEvent.click(await screen.findByRole("radio", { name: /Back up this machine/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => expect(window.location.hash).toBe("#/backup"));
  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
});

const repositories = [
  { name: "leo/afk-library", url: "https://github.com/leo/afk-library.git", private: true, pushedAt: "2026-11-04T14:02:00Z" },
  { name: "leo/dotfiles", url: "https://github.com/leo/dotfiles.git", private: false },
];

const summary = {
  repository: "https://github.com/leo/afk-library.git",
  linked: names("core", 43),
  adopted: ["kami", "atlas"],
  movedAside: [{ name: "writer", to: "/home/leo/.afk/replaced/2026-11-05/writer" }],
  choices: 12,
  folders: [],
  packs: ["Writing"],
  tools: [],
};

const tools = [
  { id: 7, name: "gstack", install: "npx gstack install", update: "", provides: ["office-hours"] },
  { id: 9, name: "docs-kit", install: "curl https://example.com/install.sh | sh", update: "" },
];

function restoreClient(handlers: Parameters<typeof fakeClient>[0] = {}): FakeClient {
  return fakeClient({
    "backup/state": backupState({ library: false }),
    "restore/repositories": () => repositories,
    "restore/inspect": () => ({ repository: summary.repository, coreSkills: 43, packs: 1, tools: 0 }),
    "restore/start": () => summary,
    welcome: () => ({ ok: true }),
    ...handlers,
  });
}

async function chooseRestore(): Promise<void> {
  await userEvent.click(await screen.findByRole("radio", { name: /Restore my library/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

it("lists the GitHub repositories to restore from", async () => {
  open(restoreClient());

  await chooseRestore();

  expect(await screen.findByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument();
  const list = await screen.findByRole("list", { name: "Your repositories" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(within(list).getByText("leo/afk-library")).toBeInTheDocument();
  expect(within(list).getByText(/private · last pushed 2026-11-04/)).toBeInTheDocument();
});

it("checks the repository, restores it and summarises what moved aside", async () => {
  const client = restoreClient();
  open(client);
  await chooseRestore();

  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Your library is back" })).toBeInTheDocument();
  expect(client.calls.filter(call => call.operation.startsWith("restore/")).map(call => [call.operation, call.input])).toEqual([
    ["restore/repositories", {}],
    ["restore/inspect", { repository: repositories[0]!.url }],
    ["restore/start", { repository: repositories[0]!.url }],
  ]);
  expect(client.calls.map(call => call.operation)).toContain("welcome");
  expect(screen.getByText("43 Core skills on · 12 choices applied")).toBeInTheDocument();
  const aside = screen.getByRole("region", { name: /Your copy was different/ });
  expect(within(aside).getByText("writer")).toBeInTheDocument();
  expect(within(aside).getByText("/home/leo/.afk/replaced/2026-11-05/writer")).toBeInTheDocument();
  expect(screen.getByText(/Packs start off/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Open AFK" }));

  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
});

it("does not mention moved-aside copies when nothing was different", async () => {
  open(restoreClient({ "restore/start": () => ({ ...summary, movedAside: [], adopted: [], packs: [] }) }));
  await chooseRestore();

  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));

  await screen.findByRole("heading", { level: 1, name: "Your library is back" });
  expect(screen.queryByText(/Your copy was different/)).not.toBeInTheDocument();
});

it("restores from a pasted address and asks for one when it is empty", async () => {
  const client = restoreClient({ "restore/repositories": () => [] });
  open(client);
  await chooseRestore();
  expect(await screen.findByText(/No repositories found/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Restore from this address" }));
  expect(screen.getByText("Paste the repository first.")).toBeInTheDocument();
  expect(screen.getByLabelText("Or paste a repository")).toHaveAttribute("aria-invalid", "true");

  await userEvent.type(screen.getByLabelText("Or paste a repository"), "leo/afk-library");
  await userEvent.click(screen.getByRole("button", { name: "Restore from this address" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Your library is back" })).toBeInTheDocument();
  expect(client.calls.find(call => call.operation === "restore/start")?.input).toEqual({ repository: "leo/afk-library" });
});

it("explains a repository that is not an AFK library and stays on the picker", async () => {
  const client = restoreClient({ "restore/inspect": () => fail("That repository is not an AFK library. Add it to Try later instead if it holds skills.") });
  open(client);
  await chooseRestore();

  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/dotfiles" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("not an AFK library");
  expect(screen.getByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument();
  expect(client.calls.map(call => call.operation)).not.toContain("restore/start");
});

it("shows progress while restoring, and cancelling returns to the picker without an error", async () => {
  let release: (value: unknown) => void = () => undefined;
  const client = restoreClient({ "restore/start": () => new Promise(resolve => { release = resolve; }), "restore/cancel": () => ({ ok: true }) });
  open(client);
  await chooseRestore();

  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Restoring leo/afk-library" })).toBeInTheDocument();
  expect(await screen.findByText(/Found an AFK library with 43 Core skills, 1 pack and 0 tools/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument();
  expect(client.calls.map(call => call.operation)).toContain("restore/cancel");
  release(summary);
  await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("runs only the tools that were ticked, then reports which ran", async () => {
  const client = restoreClient({
    "restore/start": () => ({ ...summary, tools }),
    "tool/run": input => ({ code: input.id === 7 ? 0 : 1, output: "", reapplied: [], warnings: [] }),
  });
  open(client);
  await chooseRestore();
  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Run your tools?" })).toBeInTheDocument();
  expect(screen.getByText("npx gstack install")).toBeInTheDocument();
  expect(screen.getByText(/Provides office-hours/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Run tools" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Tick a tool to run, or skip.");
  expect(client.calls.map(call => call.operation)).not.toContain("tool/run");

  await userEvent.click(screen.getByRole("checkbox", { name: /gstack/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: /docs-kit/ }));
  await userEvent.click(screen.getByRole("button", { name: "Run 2 tools" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Your library is back" })).toBeInTheDocument();
  expect(client.calls.filter(call => call.operation === "tool/run").map(call => call.input)).toEqual([{ id: 7 }, { id: 9 }]);
  expect(screen.getByText("43 Core skills on · 12 choices applied · 1 tool ran")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("docs-kit could not run");
});

it("runs no tool when they are skipped", async () => {
  const client = restoreClient({ "restore/start": () => ({ ...summary, tools }) });
  open(client);
  await chooseRestore();
  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));

  await userEvent.click(await screen.findByRole("button", { name: /Skip, I’ll run them from Tools/ }));

  expect(await screen.findByRole("heading", { level: 1, name: "Your library is back" })).toBeInTheDocument();
  expect(client.calls.map(call => call.operation)).not.toContain("tool/run");
});

it("finishes an interrupted restore from the repository it was using, with no other way in", async () => {
  const client = restoreClient({ "backup/state": backupState({ library: true, restoring: summary.repository }) });
  open(client);

  expect(await screen.findByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument();
  expect(screen.getByText(/did not finish/)).toBeInTheDocument();
  expect(screen.getByLabelText("Or paste a repository")).toHaveValue(summary.repository);
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it("filters a long repository list", async () => {
  const many = Array.from({ length: 30 }, (_, index) => ({ name: `leo/repo-${index}`, url: `https://example.com/${index}.git`, private: true }));
  open(restoreClient({ "restore/repositories": () => many }));
  await chooseRestore();

  await userEvent.type(await screen.findByLabelText("Filter repositories"), "repo-2");

  const list = screen.getByRole("list", { name: "Your repositories" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(11);
});

it("shows a tool's output while it runs", async () => {
  let finish: (value: unknown) => void = () => undefined;
  open(restoreClient({
    "restore/start": () => ({ ...summary, tools }),
    "tool/run": () => new Promise(resolve => { finish = resolve; }),
    "tool/state": () => ({ tools, runs: { 7: { pending: true, output: "Fetching gstack…\nLinked office-hours\n" } }, home: "/home/leo" }),
  }));
  await chooseRestore();
  await userEvent.click(await screen.findByRole("button", { name: "Restore leo/afk-library" }));
  await userEvent.click(await screen.findByRole("checkbox", { name: /gstack/ }));
  await userEvent.click(screen.getByRole("button", { name: "Run 1 tool" }));

  expect(await screen.findByRole("heading", { level: 1, name: "Running gstack" })).toBeInTheDocument();
  expect(await screen.findByLabelText("Output of gstack")).toHaveTextContent("Linked office-hours");
  finish({ code: 0, output: "", reapplied: [], warnings: [] });
  expect(await screen.findByRole("heading", { level: 1, name: "Your library is back" })).toBeInTheDocument();
});

it("opens the restore picker when Settings asks to restore the library", async () => {
  location.hash = "#/overview?start=restore";
  open(restoreClient());

  expect(await screen.findByRole("heading", { level: 1, name: "Which repository is your library?" })).toBeInTheDocument();
});

it("opens the new-library preview when Settings asks to start one", async () => {
  location.hash = "#/overview?start=library";
  open(fakeClient({ "backup/state": backupState({ library: false }), "library/init-preview": () => plan }));

  expect(await screen.findByRole("heading", { level: 1, name: "Start your library" })).toBeInTheDocument();
});

it("ignores a request to start a library when this machine already has one", async () => {
  location.hash = "#/overview?start=library";
  open(fakeClient({ "backup/state": backupState({}) }));

  expect(await screen.findByRole("navigation", { name: "Sections" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Start your library" })).not.toBeInTheDocument();
});
