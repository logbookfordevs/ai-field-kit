import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import type { RulesDestinationState, RulesPreview, RulesState, RulesTargetPreview } from "../../../../src/fieldwork/rules.js";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { screen as rules } from "@/screens/rules";
import { draftStore } from "@/screens/rules/store";

const codex: RulesDestinationState = { id: "codex", name: "Codex", kind: "codex", path: "~/.codex/AGENTS.md", status: "outdated", reason: "Saved rules differ from this file." };
const claude: RulesDestinationState = { id: "claude", name: "Claude", kind: "claude", path: "~/.claude/CLAUDE.md", status: "off", reason: "Not connected." };

const base = (overrides: Partial<RulesState> = {}): RulesState => ({
  folder: "/Users/ana/.afk",
  canonicalExists: true,
  files: [{ path: "AGENTS.md", content: "# Rules\n\nSee {{testing.md}}" }, { path: "references/testing.md", content: "# Testing" }],
  filesHash: "h1",
  destinations: [codex, claude],
  errors: [],
  ...overrides,
});

const target = (overrides: Partial<RulesTargetPreview> = {}): RulesTargetPreview => ({ ...codex, before: "old line", after: "new line", region: "region", currentRegion: "region", references: [], ...overrides });
const previewOf = (...targets: RulesTargetPreview[]): RulesPreview => ({ filesHash: "h1", targets, errors: [] });

function setup(handlers: Record<string, (input: Record<string, unknown>) => unknown> = {}, state: RulesState = base()) {
  const client = fakeClient({ "rules/state": () => state, ...handlers } as never);
  renderWithApp(<rules.Screen params={new URLSearchParams()} />, { client });
  return client;
}

const callsTo = (client: ReturnType<typeof setup>, operation: string) => client.calls.filter(call => call.operation === operation);

beforeEach(() => draftStore.reset());

it("previews the selected destinations, writes nothing until confirmed, then syncs that exact preview", async () => {
  const preview = previewOf(target());
  const result = { preview, settings: {}, state: base({ destinations: [{ ...codex, status: "current", reason: "Up to date." }, claude] }) };
  const client = setup({ "rules/preview": () => preview, "rules/sync": () => result });
  await screen.findByRole("button", { name: "Sync saved rules" });

  await userEvent.click(screen.getByRole("button", { name: "Sync saved rules" }));

  const dialog = await screen.findByRole("dialog", { name: "Sync saved rules" });
  expect(callsTo(client, "rules/preview")).toEqual([{ operation: "rules/preview", input: { ids: ["codex"] } }]);
  expect(within(dialog).getByText("~/.codex/AGENTS.md")).toBeInTheDocument();
  expect(within(dialog).getByRole("region", { name: "Changes to ~/.codex/AGENTS.md" })).toHaveTextContent("new line");
  expect(callsTo(client, "rules/sync")).toEqual([]);

  await userEvent.click(within(dialog).getByRole("button", { name: "Sync 1 destination" }));

  expect(callsTo(client, "rules/sync")).toEqual([{ operation: "rules/sync", input: { ids: ["codex"], preview } }]);
  expect(await screen.findByRole("dialog", { name: "Sync complete" })).toBeInTheDocument();
});

it("keeps the preview open with the reason when AFK refuses the sync, and offers to preview again", async () => {
  const client = setup({ "rules/preview": () => previewOf(target()), "rules/sync": () => fail("The destination changed since the preview.") });
  await userEvent.click(await screen.findByRole("button", { name: "Sync saved rules" }));
  const dialog = await screen.findByRole("dialog", { name: "Sync saved rules" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Sync 1 destination" }));

  expect(await within(dialog).findByText("The destination changed since the preview.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Preview again" }));
  expect(callsTo(client, "rules/preview")).toHaveLength(2);
});

it("cannot sync without a connected destination chosen", async () => {
  setup({}, base({ destinations: [claude] }));

  expect(await screen.findByText("Choose at least one destination to sync.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sync saved rules" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Include Claude in sync" })).toBeDisabled();
});

it("saves edits with the hash they were based on, and says what is saved", async () => {
  const client = setup({ "rules/save": () => ({}) });
  const editor = await screen.findByRole("textbox", { name: "Contents of AGENTS.md" });

  await userEvent.type(editor, "!");
  expect(screen.getByText("Unsaved · 1 file")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(callsTo(client, "rules/save")).toEqual([{ operation: "rules/save", input: { files: [{ path: "AGENTS.md", content: "# Rules\n\nSee {{testing.md}}!" }, { path: "references/testing.md", content: "# Testing" }], expectedHash: "h1" } }]);
  expect((await screen.findAllByText(/^Saved/)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/^Unsaved/)).not.toBeInTheDocument();
});

it("locks the editor while saving and ignores a second save until the first finishes", async () => {
  let finish: (value: unknown) => void = () => undefined;
  const client = setup({ "rules/save": () => new Promise(resolve => { finish = resolve; }) });
  const editor = await screen.findByRole("textbox", { name: "Contents of AGENTS.md" });
  await userEvent.type(editor, "!");

  await userEvent.keyboard("{Control>}s{/Control}");
  await userEvent.keyboard("{Control>}s{/Control}");

  expect(editor).toHaveAttribute("readonly");
  expect(callsTo(client, "rules/save")).toHaveLength(1);
  finish({});
  expect(await screen.findByRole("button", { name: /^Save/ })).toBeDisabled();
  await waitFor(() => expect(editor).not.toHaveAttribute("readonly"));
  expect(screen.queryByRole("dialog", { name: "The AFK folder changed on disk" })).not.toBeInTheDocument();
});

it("asks before syncing with unsaved edits, then saves and previews in order", async () => {
  const client = setup({ "rules/save": () => ({}), "rules/preview": () => previewOf(target()) });
  await userEvent.type(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" }), "!");

  await userEvent.click(screen.getByRole("button", { name: "Save & sync…" }));
  const prompt = screen.getByRole("dialog", { name: "Save before syncing?" });
  expect(callsTo(client, "rules/save")).toEqual([]);
  await userEvent.click(within(prompt).getByRole("button", { name: "Save & sync" }));

  expect(await screen.findByRole("dialog", { name: "Sync saved rules" })).toBeInTheDocument();
  const order = client.calls.map(call => call.operation).filter(operation => operation === "rules/save" || operation === "rules/preview");
  expect(order).toEqual(["rules/save", "rules/preview"]);
});

it("offers to reload when the folder changed on disk, keeping the typed draft aside", async () => {
  let reply: unknown = fail("The AFK folder changed on disk. Reload before saving.");
  const client = setup({ "rules/save": () => reply });
  await userEvent.type(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" }), "!");

  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  const dialog = await screen.findByRole("dialog", { name: "The AFK folder changed on disk" });
  reply = {};
  await userEvent.click(within(dialog).getByRole("button", { name: "Reload saved files" }));
  expect(callsTo(client, "rules/save")).toHaveLength(1);
  expect(await screen.findByText(/Your previous draft was kept aside/)).toBeInTheDocument();
});

it("starts AGENTS.md from a destination's own text, without AFK's markers", async () => {
  setup({ "rules/existing": () => ({ text: "# Mine\n<!-- AFK:RULES:START -->\nbody\n<!-- AFK:RULES:END -->" }) }, base({ canonicalExists: false, files: [] }));

  await userEvent.click(await screen.findByRole("button", { name: "Copy from Codex’s AGENTS.md" }));

  expect(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" })).toHaveValue("# Mine\nbody");
  expect(screen.getByText("Unsaved · 1 file")).toBeInTheDocument();
});

it("reviews a conflict and brings the destination's rules into the editor as a draft", async () => {
  const conflicted = { ...codex, status: "conflict" as const, reason: "The rules inside the AFK markers were edited outside AFK (destination rules were edited outside AFK)." };
  const client = setup({
    "rules/preview": () => previewOf(target({ status: "conflict", reason: conflicted.reason, before: "<!-- AFK:RULES:START -->\nmine\n<!-- AFK:RULES:END -->", currentRegion: "mine" })),
    "rules/adopt": () => ({ content: "mine" }),
  }, base({ destinations: [conflicted, claude] }));

  await userEvent.click(await screen.findByRole("button", { name: "Review conflict for Codex" }));
  const dialog = await screen.findByRole("dialog", { name: "Destination rules changed" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Bring rules into editor" }));

  expect(callsTo(client, "rules/adopt")).toEqual([{ operation: "rules/adopt", input: { id: "codex" } }]);
  expect(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" })).toHaveValue("mine");
});

it("replaces a conflicted region only with the reviewed region and preview, and withdraws replacing when AFK refuses", async () => {
  const conflicted = { ...codex, status: "conflict" as const, reason: "The rules inside the AFK markers were edited outside AFK (destination rules were edited outside AFK)." };
  const reviewed = previewOf(target({ status: "conflict", reason: conflicted.reason, before: "<!-- AFK:RULES:START -->\nmine\n<!-- AFK:RULES:END -->", currentRegion: "mine" }));
  const client = setup({ "rules/preview": () => reviewed, "rules/overwrite": () => fail("The destination changed. Review again.") }, base({ destinations: [conflicted, claude] }));
  await userEvent.click(await screen.findByRole("button", { name: "Review conflict for Codex" }));
  const dialog = await screen.findByRole("dialog", { name: "Destination rules changed" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Replace AFK region with saved rules" }));

  expect(callsTo(client, "rules/overwrite")).toEqual([{ operation: "rules/overwrite", input: { id: "codex", expectedRegion: "mine", expectedPreview: reviewed } }]);
  expect(await within(dialog).findByText("The destination changed. Review again.")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Replace AFK region with saved rules" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Review again" })).toBeInTheDocument();
});

it("asks for a repair when the destination's markers do not pair up", async () => {
  const conflicted = { ...codex, status: "conflict" as const };
  setup({ "rules/preview": () => previewOf(target({ status: "conflict", before: "<!-- AFK:RULES:START -->\nno end" })) }, base({ destinations: [conflicted, claude] }));

  await userEvent.click(await screen.findByRole("button", { name: "Review conflict for Codex" }));

  const dialog = await screen.findByRole("dialog", { name: "Repair the AFK markers" });
  expect(within(dialog).getByRole("button", { name: "Check again" })).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Replace AFK region with saved rules" })).not.toBeInTheDocument();
});

it("adds a reference as an unsaved draft after checking its path, and links it from AGENTS.md", async () => {
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "Add reference" }));
  const dialog = screen.getByRole("dialog", { name: "Add a supporting reference" });

  await userEvent.type(within(dialog).getByLabelText("Path inside references/"), "notes.txt");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add reference" }));
  expect(within(dialog).getByText(/relative Markdown path/)).toBeInTheDocument();

  await userEvent.clear(within(dialog).getByLabelText("Path inside references/"));
  await userEvent.type(within(dialog).getByLabelText("Path inside references/"), "style.md");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add reference" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "references/style.md" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^AGENTS.md/ }));
  expect(screen.getByRole("textbox", { name: "Contents of AGENTS.md" })).toHaveValue("# Rules\n\nSee {{testing.md}}\n- Style: {{style.md}}");
});

it("removes a reference with an Undo that puts it back", async () => {
  setup();
  await userEvent.click(await screen.findByRole("button", { name: "testing.md" }));
  await userEvent.click(screen.getByRole("button", { name: "More for references/testing.md" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove file" }));

  expect(screen.queryByRole("button", { name: "testing.md" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByRole("button", { name: "testing.md" })).toBeInTheDocument();
});

it("lists missing references before they block a sync", async () => {
  setup({}, base({ files: [{ path: "AGENTS.md", content: "Use {{absent.md}}" }] }));

  expect(await screen.findByText(/No file in references\/ for \{\{absent\.md\}\}/)).toBeInTheDocument();
});

it("checks a new custom destination's path before saving it, and keeps AFK's refusal in the dialog", async () => {
  const client = setup({ "rules/destination": () => fail("That file is already a destination.") });
  await userEvent.click(await screen.findByRole("button", { name: "Add custom destination" }));
  const dialog = screen.getByRole("dialog", { name: "Add a custom destination" });

  await userEvent.type(within(dialog).getByLabelText("Name"), "Cursor");
  await userEvent.type(within(dialog).getByLabelText("Absolute file path"), "relative/AGENTS.md");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save destination" }));
  expect(within(dialog).getByText("Enter a name and an absolute file path beginning with / or ~/.")).toBeInTheDocument();
  expect(callsTo(client, "rules/destination")).toEqual([]);

  await userEvent.clear(within(dialog).getByLabelText("Absolute file path"));
  await userEvent.type(within(dialog).getByLabelText("Absolute file path"), "~/work/AGENTS.md");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save destination" }));

  expect(callsTo(client, "rules/destination")).toEqual([{ operation: "rules/destination", input: { destination: { name: "Cursor", path: "~/work/AGENTS.md", kind: "custom" } } }]);
  expect(await within(dialog).findByText("That file is already a destination.")).toBeInTheDocument();
});

it("disconnects a destination, choosing whether AFK's content is removed", async () => {
  const client = setup({ "rules/disconnect": () => base() });
  await screen.findByRole("button", { name: "Preview Codex" });

  await userEvent.click(screen.getByRole("button", { name: "More for Codex" }));
  await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove AFK content" }));

  expect(callsTo(client, "rules/disconnect")).toEqual([{ operation: "rules/disconnect", input: { id: "codex", clean: true } }]);
});

it("reconnects a destination that was disconnected", async () => {
  const client = setup({ "rules/destination": () => base() });

  await userEvent.click(await screen.findByRole("button", { name: "Reconnect Claude" }));

  expect(callsTo(client, "rules/destination")).toEqual([{ operation: "rules/destination", input: { destination: { id: "claude", name: "Claude", kind: "claude", path: "~/.claude/CLAUDE.md" } } }]);
});

it("keeps unsaved drafts when you leave Agent rules and come back", async () => {
  const client = fakeClient({ "rules/state": () => base() } as never);
  const first = renderWithApp(<rules.Screen params={new URLSearchParams()} />, { client });
  await userEvent.type(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" }), "!");
  first.unmount();

  renderWithApp(<rules.Screen params={new URLSearchParams()} />, { client });

  expect(await screen.findByRole("textbox", { name: "Contents of AGENTS.md" })).toHaveValue("# Rules\n\nSee {{testing.md}}!");
});

it("suggests references after typing {{ and inserts the chosen key", async () => {
  setup({}, base({ files: [{ path: "AGENTS.md", content: "" }, { path: "references/testing.md", content: "# Testing" }, { path: "references/style.md", content: "# Style" }] }));
  const editor = await screen.findByRole("textbox", { name: "Contents of AGENTS.md" });

  await userEvent.type(editor, "{{{{sty");
  const option = await screen.findByRole("option", { name: /style\.md/ });
  expect(screen.queryByRole("option", { name: /testing\.md/ })).not.toBeInTheDocument();
  await userEvent.keyboard("{Enter}");

  expect(option).toBeDefined();
  expect(editor).toHaveValue("{{style.md}}");
});
