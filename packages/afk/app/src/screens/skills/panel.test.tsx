import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import type { OperationName } from "@/api/operations";
import { screen as skills } from "@/screens/skills";
import type { SkillEditorView } from "@/screens/skills/api";
import { agentFolders, appState, editorView } from "@/screens/skills/fixtures";
import { fakeClient, fail } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const Screen = skills.Screen;

function setup(view: (input: Record<string, unknown>) => SkillEditorView = input => editorView(String(input.name)), edit: (input: Record<string, unknown>) => unknown = () => ({ ok: true })) {
  const client = fakeClient({
    state: () => appState(),
    "agent-folders/state": () => agentFolders,
    "backup/state": () => ({ status: { state: "saved" }, attention: [], unpushed: [] }),
    "skill/editor": view,
    "skill/edit": edit,
    "skill/read": input => ({ path: "/work/site/.agents/skills/site-deploy", files: ["SKILL.md"], file: input.file, content: "# Deploy\n" }),
  });
  renderWithApp(<Screen params={new URLSearchParams()} />, { client });
  return client;
}

const calls = (client: ReturnType<typeof setup>, operation: OperationName) => client.calls.filter(call => call.operation === operation).map(call => call.input);

async function openPanel(name: string) {
  await userEvent.click(await screen.findByRole("button", { name }));
  return screen.getByRole("dialog", { name });
}

it("shows a skill's details, where it lives and the agents that follow its choice", async () => {
  setup();

  const panel = await openPanel("kami");

  expect(panel).toHaveAccessibleDescription("Core");
  expect(panel).toHaveTextContent("Plans a change before writing code.");
  expect(panel).toHaveTextContent("On every machine, always on, backed up.");
  expect(panel).toHaveTextContent("Claude Code and Pi read the disable-model-invocation line in SKILL.md. Codex reads agents/openai.yaml, which AFK writes too. Other agents: unknown.");
  expect(await within(panel).findByRole("textbox", { name: "SKILL.md" })).toHaveValue(editorView("kami").content);
});

it("names the agents in the list's invocation note too", async () => {
  setup();
  await screen.findByRole("list", { name: "Skills" });

  await userEvent.click(screen.getByRole("button", { name: "How Manual and Automatic work" }));

  expect(screen.getByRole("note")).toHaveTextContent("Claude Code and Pi read the disable-model-invocation line in SKILL.md.");
});

it("saves an edit as one change and reports it", async () => {
  const client = setup();
  const panel = await openPanel("kami");
  const text = await within(panel).findByRole("textbox", { name: "SKILL.md" });

  await userEvent.type(text, "More.");
  expect(panel).toHaveTextContent("Unsaved edit");
  await userEvent.click(within(panel).getByRole("button", { name: "Save edit" }));

  await waitFor(() => expect(calls(client, "skill/edit")).toEqual([{ name: "kami", file: "SKILL.md", content: `${editorView("kami").content}More.` }]));
  expect(await within(panel).findByText("Saved")).toBeInTheDocument();
});

it("asks before saving an edit to a skill that updates from its repository", async () => {
  const client = setup(input => editorView(String(input.name), { updates: "ask", source: "fieldnotes/agent-skills" }));
  const panel = await openPanel("kami");
  expect(await within(panel).findByText(/Saving asks whether to keep your version/)).toBeInTheDocument();
  await userEvent.type(within(panel).getByRole("textbox", { name: "SKILL.md" }), "Mine.");

  await userEvent.click(within(panel).getByRole("button", { name: "Save edit" }));
  expect(calls(client, "skill/edit")).toEqual([]);
  const ask = within(panel).getByRole("group", { name: "Updates" });
  await userEvent.click(within(ask).getByRole("button", { name: "Keep my version" }));

  await waitFor(() => expect(calls(client, "skill/edit")).toEqual([{ name: "kami", file: "SKILL.md", content: `${editorView("kami").content}Mine.`, updates: "keep" }]));
});

it("refuses to close with an unsaved edit until it is saved or reverted", async () => {
  setup();
  const panel = await openPanel("kami");
  await userEvent.type(await within(panel).findByRole("textbox", { name: "SKILL.md" }), "Draft");

  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "kami" })).toBeInTheDocument();
  expect(within(panel).getByText("Save or revert your edit before closing.")).toBeInTheDocument();

  await userEvent.click(within(panel).getByRole("button", { name: "Revert" }));
  await userEvent.click(within(panel).getAllByRole("button", { name: "Close" })[0]!);
  expect(screen.queryByRole("dialog", { name: "kami" })).not.toBeInTheDocument();
});

it("shows the reason when a save is refused", async () => {
  setup(undefined, () => fail("SKILL.md must start with valid YAML frontmatter between --- lines."));
  const panel = await openPanel("kami");
  await userEvent.type(await within(panel).findByRole("textbox", { name: "SKILL.md" }), "x");

  await userEvent.click(within(panel).getByRole("button", { name: "Save edit" }));

  expect(await within(panel).findByText("SKILL.md must start with valid YAML frontmatter between --- lines.")).toBeInTheDocument();
  expect(within(panel).getByText("Unsaved edit")).toBeInTheDocument();
});

it("opens tool skills read-only with the reason", async () => {
  setup(input => editorView(String(input.name), { readOnly: "Atlas installs and updates this skill, so edits would be overwritten." }));

  const panel = await openPanel("atlas-review");

  const text = await within(panel).findByRole("textbox", { name: "SKILL.md" });
  expect(text).toHaveAttribute("readonly");
  expect(panel).toHaveTextContent("Read-only. Atlas installs and updates this skill");
  expect(within(panel).queryByRole("button", { name: "Save edit" })).not.toBeInTheDocument();
  expect(within(panel).queryByRole("button", { name: "Delete…" })).not.toBeInTheDocument();
});

it("previews the file and switches files", async () => {
  const client = setup();
  const panel = await openPanel("kami");
  await within(panel).findByRole("textbox", { name: "SKILL.md" });

  await userEvent.click(within(panel).getByRole("radio", { name: "Preview" }));
  expect(within(panel).getByText("Write the plan first.")).toBeInTheDocument();
  expect(within(panel).queryByText(/description: Plans a change/)).not.toBeInTheDocument();

  await userEvent.selectOptions(within(panel).getByRole("combobox", { name: "File" }), "references/notes.md");
  await waitFor(() => expect(calls(client, "skill/editor").at(-1)).toEqual({ name: "kami", file: "references/notes.md" }));
});

it("opens Edit files with the cursor in the text", async () => {
  setup();
  await screen.findByRole("list", { name: "Skills" });
  const trigger = screen.getByRole("button", { name: "More for kami" });
  await userEvent.click(trigger);

  await userEvent.click(within(document.getElementById(trigger.getAttribute("aria-controls")!)!).getByRole("button", { name: "Edit files" }));

  await waitFor(() => expect(screen.getByRole("textbox", { name: "SKILL.md" })).toHaveFocus());
});
