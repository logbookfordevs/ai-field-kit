import { renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ClientProvider } from "@/api/ClientProvider";
import { screen as skills } from "@/screens/skills";
import { agentFolders, appState, entry } from "@/screens/skills/fixtures";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const Screen = skills.Screen;

function renderSkills(params = "", state = appState()) {
  const client = fakeClient({ state: () => state, "agent-folders/state": () => agentFolders, "backup/state": () => ({ status: { state: "saved" }, attention: [], unpushed: [] }) });
  renderWithApp(<Screen params={new URLSearchParams(params)} />, { client });
  return client;
}

async function rows() {
  const list = await screen.findByRole("list", { name: "Skills" });
  return within(list).getAllByRole("listitem");
}

function rowFor(name: string) {
  return screen.getByRole("button", { name }).closest("li") as HTMLElement;
}

it("lists every Global skill with where it comes from, derived from its placement", async () => {
  renderSkills();

  const listed = await rows();

  expect(listed).toHaveLength(7);
  expect(rowFor("kami")).toHaveTextContent("Core");
  expect(rowFor("kami")).toHaveTextContent("Plans a change before writing code.");
  expect(rowFor("hairline")).toHaveTextContent("Pack · Writing");
  expect(rowFor("atlas-review")).toHaveTextContent("Tool · Atlas");
  expect(rowFor("local-notes")).toHaveTextContent("This machine");
  expect(rowFor("stray")).toHaveTextContent("To review");
  expect(rowFor("north-plan")).toHaveTextContent("Not on this machine");
});

it("puts skills to review first and offers to show only them", async () => {
  renderSkills();
  const listed = await rows();
  expect(within(listed[0]!).getByRole("button", { name: "stray" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Show it" }));

  expect(await rows()).toHaveLength(1);
  expect(screen.getByRole("combobox", { name: "Comes from" })).toHaveValue("review");
});

it("opens filtered to review from the address", async () => {
  renderSkills("from=review");

  expect(await rows()).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Show it" })).not.toBeInTheDocument();
});

it("searches names and descriptions and filters by state and invocation", async () => {
  renderSkills();
  await rows();

  await userEvent.type(screen.getByRole("searchbox", { name: "Find a skill" }), "prose");
  expect((await rows()).map(row => within(row).getAllByRole("button")[0]!.textContent)).toEqual(["quill"]);
  expect(screen.getByText("Showing 1 of 7")).toBeInTheDocument();

  await userEvent.clear(screen.getByRole("searchbox", { name: "Find a skill" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "State" }), "off");
  expect((await rows()).map(row => within(row).getAllByRole("button")[0]!.textContent)).toEqual(["north-plan", "quill"]);

  await userEvent.selectOptions(screen.getByRole("combobox", { name: "State" }), "manual");
  expect((await rows()).map(row => within(row).getAllByRole("button")[0]!.textContent)).toEqual(["quill"]);
});

it("filters by where skills come from, with counts for each place", async () => {
  renderSkills();
  await rows();
  const from = screen.getByRole("combobox", { name: "Comes from" });

  expect(within(from).getAllByRole("option").map(option => option.textContent)).toEqual([
    "Anywhere (7)", "Core (3)", "This machine (1)", "To review (1)", "Pack · Writing (1)", "Tool · Atlas (1)",
  ]);
  await userEvent.selectOptions(from, "pack:Writing");

  expect((await rows()).map(row => within(row).getAllByRole("button")[0]!.textContent)).toEqual(["hairline"]);
});

it("says when nothing matches and clears the filters", async () => {
  renderSkills();
  await rows();

  await userEvent.type(screen.getByRole("searchbox", { name: "Find a skill" }), "zzz");

  expect(screen.getByRole("heading", { name: "No skill matches “zzz”" })).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
  expect(await rows()).toHaveLength(7);
});

it("explains an empty machine", async () => {
  const empty = appState({ global: [] });
  empty.kit.core = [];
  empty.kit.undecided = [];
  renderSkills("", empty);

  expect(await screen.findByRole("heading", { name: "No skills on this machine yet" })).toBeInTheDocument();
});

it("stays fast and stable with 160 skills", async () => {
  const many = appState({ global: Array.from({ length: 160 }, (_, index) => entry(`skill-${String(index).padStart(3, "0")}`)) });
  many.kit.core = [];
  many.kit.undecided = [];
  renderSkills("", many);

  expect(await rows()).toHaveLength(160);
  await userEvent.type(screen.getByRole("searchbox", { name: "Find a skill" }), "skill-15");
  expect(await rows()).toHaveLength(10);
});

it("shows the review count in the navigation as text", async () => {
  const client = fakeClient({ state: () => appState() });
  const wrapper = ({ children }: { children: ReactNode }) => <ClientProvider client={client}>{children}</ClientProvider>;

  const hook = renderHook(() => skills.useAttention(), { wrapper });

  await waitFor(() => expect(hook.result.current).toEqual({ text: "1 to review", tone: "attention" }));
});

it("shows no navigation signal while the state has no kit yet", async () => {
  const client = fakeClient({ state: () => ({ settings: appState().settings }) });
  const wrapper = ({ children }: { children: ReactNode }) => <ClientProvider client={client}>{children}</ClientProvider>;

  const hook = renderHook(() => skills.useAttention(), { wrapper });

  await waitFor(() => expect(client.calls).toHaveLength(1));
  expect(hook.result.current).toBeNull();
});

it("starts with the search from the address, as Overview's Find a skill sends it", async () => {
  renderSkills("q=hairline");

  expect(await rows()).toHaveLength(1);
  expect(rowFor("hairline")).toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: /Find a skill/ })).toHaveValue("hairline");
});
