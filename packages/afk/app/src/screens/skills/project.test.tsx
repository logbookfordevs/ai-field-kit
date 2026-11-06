import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { OperationName } from "@/api/operations";
import { screen as skills } from "@/screens/skills";
import { agentFolders, appState } from "@/screens/skills/fixtures";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const Screen = skills.Screen;
const sharing = { scope: "Site", status: "missing", source: "/work/site/.agents/skills", destination: "/work/site/.claude/skills" };

function setup(state = appState()) {
  const client = fakeClient({
    state: () => state,
    "agent-folders/state": () => agentFolders,
    "backup/state": () => ({ status: { state: "saved" }, attention: [], unpushed: [] }),
    invocation: () => ({ ok: true }),
    "skills/bulk": input => ({ items: (input.names as string[]).map(name => ({ name, ok: true })), completed: 1, failed: 0 }),
    "skills/update": () => ({ pending: false, phase: "Done", output: "", code: 0, scope: "Site" }),
    "skills/update-state": () => null,
    "skills-sharing/state": () => sharing,
    "skills-sharing/set": () => ({ ok: true }),
    "skill/read": input => ({ path: "/work/site/.agents/skills/site-deploy", files: ["SKILL.md"], file: input.file, content: "# Deploy\n" }),
  });
  renderWithApp(<Screen params={new URLSearchParams("scope=Site")} />, { client });
  return client;
}

const calls = (client: ReturnType<typeof setup>, operation: OperationName) => client.calls.filter(call => call.operation === operation).map(call => call.input);

it("lists a project's own skills and changes how they start in that project", async () => {
  const client = setup();
  const list = await screen.findByRole("list", { name: "Skills in Site" });
  expect(screen.getByRole("combobox", { name: "Scope" })).toHaveValue("Site");
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);

  await userEvent.click(within(list).getByRole("radio", { name: "Manual" }));

  await waitFor(() => expect(calls(client, "invocation")).toEqual([{ name: "site-deploy", scope: "Site", mode: "Manual only" }]));
});

it("changes the selected project skills without on/off, which projects don't have", async () => {
  const client = setup();
  await screen.findByRole("list", { name: "Skills in Site" });

  await userEvent.click(screen.getByRole("checkbox", { name: "Select site-deploy" }));
  const bar = screen.getByRole("group", { name: "Selected skills" });
  expect(within(bar).queryByRole("button", { name: "Turn off" })).not.toBeInTheDocument();
  const trigger = within(bar).getByRole("button", { name: "How they start" });
  await userEvent.click(trigger);
  await userEvent.click(within(document.getElementById(trigger.getAttribute("aria-controls") ?? "")!).getByRole("button", { name: "Automatic allowed" }));

  await waitFor(() => expect(calls(client, "skills/bulk")).toEqual([{ names: ["site-deploy"], scope: "Site", action: "invocation", mode: "Automatic allowed" }]));
});

it("updates every skill in the project", async () => {
  const client = setup();
  await screen.findByRole("list", { name: "Skills in Site" });

  await userEvent.click(screen.getByRole("button", { name: "Update all" }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Update skills in Site" })).getByRole("button", { name: "Update" }));

  await waitFor(() => expect(calls(client, "skills/update")).toEqual([{ scope: "Site" }]));
});

it("reviews Claude sharing before connecting the project's folder", async () => {
  const client = setup();
  await screen.findByRole("list", { name: "Skills in Site" });

  await userEvent.click(screen.getByRole("button", { name: "Claude sharing…" }));
  const dialog = screen.getByRole("dialog", { name: "Share skills with Claude" });
  expect(await within(dialog).findByText("/work/site/.claude/skills")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Share with Claude" }));

  await waitFor(() => expect(calls(client, "skills-sharing/set")).toEqual([{ scope: "Site", enabled: true, expected: sharing }]));
});

it("opens a project skill read-only", async () => {
  setup();

  await userEvent.click(await screen.findByRole("button", { name: "site-deploy" }));

  const panel = screen.getByRole("dialog", { name: "site-deploy" });
  expect(await within(panel).findByRole("textbox", { name: "SKILL.md" })).toHaveAttribute("readonly");
  expect(panel).toHaveTextContent("Project skills are changed in the project’s own repository.");
});

it("shows skills other apps keep in subfolders, read-only", async () => {
  const state = appState();
  state.nestedInventories.Site = [{ name: "vendor-lint", folder: "vendor", path: "/work/site/.agents/skills/vendor/vendor-lint", description: "Lints vendor code.", invocation: { claude: "Manual only", codex: "Manual only" } }];
  setup(state);

  const nested = await screen.findByRole("list", { name: "Skills in subfolders" });

  expect(nested).toHaveTextContent("vendor-lint");
  expect(nested).toHaveTextContent("Manual only · managed outside AFK");
  expect(within(nested).queryByRole("checkbox")).not.toBeInTheDocument();
});

it("explains a project without skills of its own", async () => {
  setup(appState({ project: [] }));

  expect(await screen.findByRole("heading", { name: "This project has no skills of its own yet" })).toBeInTheDocument();
});
