import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { OperationName } from "@/api/operations";
import { screen as skills } from "@/screens/skills";
import { agentFolders, appState, entry } from "@/screens/skills/fixtures";
import { fakeClient, fail } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const Screen = skills.Screen;
const preview = { name: "kami", scope: "Global", path: "/home/.afk/library/skills/kami", available: true, links: [], copies: [], claudeSharesStorage: false, retainedCopies: [], fingerprint: "f1", storage: "library" };

function setup(state = appState(), extra: Partial<Record<OperationName, (input: Record<string, unknown>) => unknown>> = {}) {
  const client = fakeClient({
    state: () => state,
    "agent-folders/state": () => agentFolders,
    "backup/state": () => ({ status: { state: "saved" }, attention: [], unpushed: [] }),
    "skill/availability": () => ({ ok: true }),
    invocation: () => ({ ok: true }),
    "kit/add": () => ({ ok: true }),
    "kit/drop": () => ({ ok: true }),
    "kit/machine-only": () => ({ ok: true }),
    "kit/install": () => ({ pending: false, code: 0 }),
    "skill/adopt": () => ({ ok: true }),
    "skill/delete-preview": () => preview,
    "skill/delete": () => ({ ok: true }),
    "skill/resolve-duplicate": () => ({ ok: true }),
    "skills/update": () => ({ pending: false, phase: "Done", output: "", code: 0, updated: 1, scope: "Global" }),
    "skills/update-state": () => null,
    "tool/run": () => ({ code: 0, output: "atlas: updated" }),
    ...extra,
  });
  renderWithApp(<Screen params={new URLSearchParams()} />, { client });
  return client;
}

const calls = (client: ReturnType<typeof setup>, operation: OperationName) => client.calls.filter(call => call.operation === operation).map(call => call.input);

async function row(name: string) {
  await screen.findByRole("list", { name: "Skills" });
  return screen.getByRole("button", { name }).closest("li") as HTMLElement;
}

async function openMenu(name: string) {
  const trigger = within(await row(name)).getByRole("button", { name: `More for ${name}` });
  await userEvent.click(trigger);
  return within(document.getElementById(trigger.getAttribute("aria-controls") ?? "")!);
}

async function menuItem(name: string, item: string) {
  return (await openMenu(name)).getByRole("button", { name: item });
}

it("turns a skill off with its switch and offers to undo", async () => {
  const client = setup();

  await userEvent.click(within(await row("kami")).getByRole("switch", { name: "kami" }));

  await waitFor(() => expect(calls(client, "skill/availability")).toEqual([{ name: "kami", scope: "Global", enabled: false }]));
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await waitFor(() => expect(calls(client, "skill/availability")).toEqual([{ name: "kami", scope: "Global", enabled: false }, { name: "kami", scope: "Global", enabled: true }]));
});

it("chooses Manual or Automatic with a two-way choice", async () => {
  const client = setup();
  const group = within(await row("kami")).getByRole("group", { name: "How kami starts" });
  expect(within(group).getByRole("radio", { name: "Automatic" })).toBeChecked();

  await userEvent.click(within(group).getByRole("radio", { name: "Manual" }));

  await waitFor(() => expect(calls(client, "invocation")).toEqual([{ name: "kami", scope: "Global", mode: "Manual only" }]));
});

it("explains a switch a pack controls instead of letting it fight the pack", async () => {
  setup();

  const control = within(await row("hairline")).getByRole("switch", { name: "hairline" });

  expect(control).toBeDisabled();
  expect(control).toHaveAccessibleDescription("On through Writing. Turn the pack on or off in Packs.");
});

it("updates one skill through the protected update", async () => {
  const client = setup();

  await userEvent.click(await menuItem("kami", "Update"));
  const dialog = screen.getByRole("dialog", { name: "Update kami" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Update" }));

  await waitFor(() => expect(calls(client, "skills/update")).toEqual([{ scope: "Global", names: ["kami"] }]));
});

it("updates a tool skill by running its tool and keeps Delete and Move unavailable with reasons", async () => {
  const client = setup();

  const menu = await openMenu("atlas-review");
  expect(menu.getByRole("button", { name: "Delete…" })).toHaveAccessibleDescription("Remove it from the tool instead.");
  expect(menu.getByRole("button", { name: "Move to…" })).toHaveAccessibleDescription("Installed by Atlas.");
  await userEvent.click(menu.getByRole("button", { name: "Update" }));
  await userEvent.click(screen.getByRole("button", { name: "Run Atlas’s update" }));

  await waitFor(() => expect(calls(client, "tool/run")).toEqual([{ id: 7, update: true }]));
  expect(await screen.findByText("atlas: updated")).toBeInTheDocument();
});

it("follows a tool's update output while it runs", async () => {
  let finish: (value: unknown) => void = () => undefined;
  setup(appState(), {
    "tool/run": () => new Promise(resolve => { finish = resolve; }),
    "tool/state": () => ({ tools: [], runs: { 7: { pending: true, output: "Pulling atlas…" } }, home: "/home/leo" }),
  });

  await userEvent.click(await menuItem("atlas-review", "Update"));
  await userEvent.click(screen.getByRole("button", { name: "Run Atlas’s update" }));

  expect(await screen.findByLabelText("Output of Atlas")).toHaveTextContent("Pulling atlas…");
  finish({ code: 0, output: "Pulling atlas…\natlas: updated" });
  expect(await screen.findByText(/atlas: updated/)).toBeInTheDocument();
});

it("says why a skill without a repository can't update", async () => {
  setup();

  const update = await menuItem("local-notes", "Update");

  expect(update).toHaveAttribute("aria-disabled", "true");
  expect(update).toHaveAccessibleDescription("No repository to update from.");
});

it("decides where a skill to review belongs, asking for a choice on submit", async () => {
  const client = setup();

  await userEvent.click(within(await row("stray")).getByRole("button", { name: "Decide…" }));
  const dialog = screen.getByRole("dialog", { name: "Where does stray belong?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Move" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Choose where it goes.");

  await userEvent.click(within(dialog).getByRole("radio", { name: /Core/ }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Add to Core" }));

  await waitFor(() => expect(calls(client, "skill/adopt")).toEqual([{ name: "stray", to: "library" }]));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps a skill to review on this machine, optionally bookmarking its repository", async () => {
  const client = setup();

  await userEvent.click(within(await row("stray")).getByRole("button", { name: "Decide…" }));
  await userEvent.click(screen.getByRole("radio", { name: /This machine only/ }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Also bookmark its repository in Try later" }));
  await userEvent.click(screen.getByRole("button", { name: "Keep on this machine only" }));

  await waitFor(() => expect(calls(client, "skill/adopt")).toEqual([{ name: "stray", to: "machine", bookmark: true }]));
});

it("adds a Core skill to a pack and drops it from Core", async () => {
  const client = setup();

  await userEvent.click(await menuItem("kami", "Move to…"));
  await userEvent.click(screen.getByRole("button", { name: "Add to Writing" }));
  await waitFor(() => expect(calls(client, "kit/add")).toEqual([{ names: ["kami"], to: "p-writing" }]));

  await userEvent.click(await menuItem("kami", "Drop from Core"));
  await waitFor(() => expect(calls(client, "kit/drop")).toEqual([{ name: "kami", from: "core" }]));
});

it("asks again about a skill kept on this machine", async () => {
  const client = setup();

  await userEvent.click(await menuItem("local-notes", "Ask me again where it belongs"));

  await waitFor(() => expect(calls(client, "kit/machine-only")).toEqual([{ name: "local-notes", enabled: false }]));
});

it("installs a Core skill missing from this machine", async () => {
  const client = setup();

  await userEvent.click(within(await row("north-plan")).getByRole("button", { name: "Install" }));

  await waitFor(() => expect(calls(client, "kit/install")).toEqual([{ source: "fieldnotes/agent-skills", names: ["north-plan"], to: "core" }]));
});

it("deletes exactly what was reviewed", async () => {
  const client = setup();

  await userEvent.click(await menuItem("kami", "Delete…"));
  const dialog = screen.getByRole("dialog", { name: /^Delete kami ?\?$/ });
  expect(await within(dialog).findByText("/home/.afk/library/skills/kami")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete kami" }));

  await waitFor(() => expect(calls(client, "skill/delete")).toEqual([{ name: "kami", scope: "Global", expected: preview, confirmed: true }]));
});

it("keeps the delete dialog open with the reason when deleting is refused", async () => {
  setup(appState(), { "skill/delete-preview": () => fail("Disable these profiles before deleting this skill: Writing.") });

  await userEvent.click(await menuItem("hairline", "Delete…"));

  expect(await screen.findByText("Disable these profiles before deleting this skill: Writing.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete hairline" })).toBeDisabled();
});

it("resolves two copies of a skill", async () => {
  const state = appState();
  state.inventories.Global = [entry("kami", { source: "fieldnotes/agent-skills", duplicate: { identical: false } })];
  state.kit.undecided = [];
  const client = setup(state);

  await userEvent.click(within(await row("kami")).getByRole("button", { name: "Resolve…" }));
  await userEvent.click(screen.getByRole("radio", { name: /The installed one/ }));
  await userEvent.click(screen.getByRole("button", { name: "Keep this copy" }));

  await waitFor(() => expect(calls(client, "skill/resolve-duplicate")).toEqual([{ name: "kami", scope: "Global", keep: "installed" }]));
});

it("reapplies a choice the files no longer follow", async () => {
  const state = appState({ preferences: { "Global|kami": "Manual only" } });
  const client = setup(state);

  await userEvent.click(within(await row("kami")).getByRole("button", { name: "Reapply" }));

  await waitFor(() => expect(calls(client, "invocation")).toEqual([{ name: "kami", scope: "Global", mode: "Manual only" }]));
});
