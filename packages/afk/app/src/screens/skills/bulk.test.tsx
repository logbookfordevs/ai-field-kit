import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { OperationName } from "@/api/operations";
import { screen as skills } from "@/screens/skills";
import { agentFolders, appState } from "@/screens/skills/fixtures";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { narrow } from "@/test/viewport";

const Screen = skills.Screen;
const review = { names: ["kami", "quill"], scope: "Global", items: [{ name: "kami", preview: { name: "kami", path: "/lib/kami" } }, { name: "quill", error: "Disable Writing first." }] };

function setup(bulk: (input: Record<string, unknown>) => unknown = input => ({ items: (input.names as string[]).map(name => ({ name, ok: true })), completed: (input.names as string[]).length, failed: 0 })) {
  const client = fakeClient({
    state: () => appState(),
    "agent-folders/state": () => agentFolders,
    "backup/state": () => ({ status: { state: "saved" }, attention: [], unpushed: [] }),
    "skills/bulk": bulk,
    "skills/delete-preview": () => review,
    "skills/update": () => ({ pending: false, phase: "Done", output: "", code: 0, scope: "Global" }),
    "skills/update-state": () => null,
  });
  renderWithApp(<Screen params={new URLSearchParams()} />, { client });
  return client;
}

const calls = (client: ReturnType<typeof setup>, operation: OperationName) => client.calls.filter(call => call.operation === operation).map(call => call.input);

async function pick(...names: string[]) {
  await screen.findByRole("list", { name: "Skills" });
  await userEvent.click(screen.getByRole("button", { name: "Include 1 off" }));
  for (const name of names) await userEvent.click(screen.getByRole("checkbox", { name: `Select ${name}` }));
  return screen.getByRole("group", { name: "Selected skills" });
}

it("turns the selected skills on and off together", async () => {
  const client = setup();
  const bar = await pick("kami", "quill");
  expect(bar).toHaveTextContent("2 selected");

  await userEvent.click(within(bar).getByRole("button", { name: "Turn off" }));

  await waitFor(() => expect(calls(client, "skills/bulk")).toEqual([{ names: ["kami", "quill"], scope: "Global", action: "disable" }]));
});

async function chooseMode(bar: HTMLElement, mode: string) {
  const trigger = within(bar).getByRole("button", { name: "How they start" });
  await userEvent.click(trigger);
  await userEvent.click(within(document.getElementById(trigger.getAttribute("aria-controls") ?? "")!).getByRole("button", { name: mode }));
}

it("sets how the selected skills start, or restores each default, only when a choice is made", async () => {
  const client = setup();
  const bar = await pick("kami");

  await chooseMode(bar, "Manual only");
  await waitFor(() => expect(calls(client, "skills/bulk")).toHaveLength(1));
  await chooseMode(bar, "Each skill’s default");

  await waitFor(() => expect(calls(client, "skills/bulk")).toEqual([
    { names: ["kami"], scope: "Global", action: "invocation", mode: "Manual only" },
    { names: ["kami"], scope: "Global", action: "invocation", mode: "" },
  ]));
});

it("keeps the bar to one line on a phone, with the other actions in a menu", async () => {
  narrow(true);
  try {
    const client = setup();
    const bar = await pick("kami", "quill");

    const trigger = within(bar).getByRole("button", { name: "More actions for selected" });
    const menu = document.getElementById(trigger.getAttribute("aria-controls") ?? "")!;
    const outsideMenu = within(bar).getAllByRole("button").filter(button => !menu.contains(button));
    expect(outsideMenu.map(button => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Turn on", "More actions for selected"]);
    await userEvent.click(trigger);
    await userEvent.click(within(menu).getByRole("button", { name: "Automatic allowed" }));

    await waitFor(() => expect(calls(client, "skills/bulk")).toEqual([{ names: ["kami", "quill"], scope: "Global", action: "invocation", mode: "Automatic allowed" }]));
  } finally { narrow(false); }
});

it("selects what the filters show and counts selected skills hidden by filters", async () => {
  setup();
  await pick("hairline");
  await userEvent.type(screen.getByRole("searchbox", { name: "Find a skill" }), "kami");

  const bar = screen.getByRole("group", { name: "Selected skills" });
  expect(bar).toHaveTextContent("1 hidden by filters");
  await userEvent.click(within(bar).getByRole("button", { name: "Select shown" }));

  expect(bar).toHaveTextContent("2 selected");
  await userEvent.click(within(bar).getByRole("button", { name: "Clear selection" }));
  expect(screen.queryByRole("group", { name: "Selected skills" })).not.toBeInTheDocument();
});

it("keeps failed skills selected and lists why they failed", async () => {
  setup(() => ({ items: [{ name: "kami", ok: true }, { name: "quill", ok: false, error: "Skill not found in the selected scope." }], completed: 1, failed: 1 }));
  const bar = await pick("kami", "quill");

  await userEvent.click(within(bar).getByRole("button", { name: "Turn on" }));

  const dialog = await screen.findByRole("dialog", { name: "Some skills couldn’t be changed" });
  expect(dialog).toHaveTextContent("Skill not found in the selected scope.");
  expect(screen.getByRole("checkbox", { name: "Select quill" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Select kami" })).not.toBeChecked();
});

it("updates the selected skills", async () => {
  const client = setup();
  const bar = await pick("kami", "quill");

  await userEvent.click(within(bar).getByRole("button", { name: "Update" }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Update selected skills" })).getByRole("button", { name: "Update" }));

  await waitFor(() => expect(calls(client, "skills/update")).toEqual([{ scope: "Global", names: ["kami", "quill"] }]));
});

it("reviews the selected deletions, keeps blocked ones and deletes the reviewed rest", async () => {
  const client = setup();
  const bar = await pick("kami", "quill");

  await userEvent.click(within(bar).getByRole("button", { name: "Delete…" }));
  const dialog = screen.getByRole("dialog", { name: "Delete the selected skills?" });
  expect(await within(dialog).findByText("Disable Writing first.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete 1 skill" }));

  await waitFor(() => expect(calls(client, "skills/bulk")).toEqual([{ names: ["kami", "quill"], scope: "Global", action: "delete", expected: review, confirmed: true }]));
});
