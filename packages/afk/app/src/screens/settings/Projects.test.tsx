import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { Projects } from "@/screens/settings/Projects";

const snapshot = {
  home: "/Users/ana",
  settings: { projects: [{ name: "Studio", path: "/Users/ana/Code/studio" }, { name: "Old", path: "/Users/ana/gone" }], preferences: {} },
  projectStatuses: { Studio: "present", Old: "missing" },
};

const listings: Record<string, { path: string; parent: string; folders: string[] }> = {
  "/Users/ana": { path: "/Users/ana", parent: "/Users", folders: ["Code", "Notes"] },
  "/Users/ana/Code": { path: "/Users/ana/Code", parent: "/Users/ana", folders: ["site"] },
  "/Users/ana/Code/site": { path: "/Users/ana/Code/site", parent: "/Users/ana/Code", folders: [] },
};

function setup(handlers = {}) {
  const client = fakeClient({
    state: () => snapshot,
    folders: input => ({ ...listings[String(input.path)], files: [], settings: false }),
    ...handlers,
  });
  renderWithApp(<Projects />, { client });
  return client;
}

const saves = (client: ReturnType<typeof setup>) => client.calls.filter(call => call.operation === "project/save");

it("lists each project with its folder, and says when a folder is gone", async () => {
  setup();

  const list = await screen.findByRole("list", { name: "Projects" });
  expect(within(list).getByText("/Users/ana/Code/studio")).toBeInTheDocument();
  expect(within(list).getByText("Project folder not found")).toBeInTheDocument();
  expect(within(list).getByRole("button", { name: "Choose folder for Old" })).toBeInTheDocument();
  expect(within(list).queryByRole("button", { name: "Choose folder for Studio" })).not.toBeInTheDocument();
});

it("adds a project by browsing to its folder and naming it", async () => {
  const client = setup({ "project/save": () => ({ ok: true }) });
  await screen.findByText("Studio");

  await userEvent.click(screen.getByRole("button", { name: "Add project" }));
  const browser = screen.getByRole("dialog", { name: "Choose project folder" });
  await userEvent.click(await within(browser).findByRole("button", { name: /^Code/ }));
  await userEvent.click(await within(browser).findByRole("button", { name: /^site/ }));
  await userEvent.click(within(browser).getByRole("button", { name: "Use this folder" }));

  const naming = await screen.findByRole("dialog", { name: "Name this project" });
  expect(within(naming).getByLabelText("Project name")).toHaveValue("site");
  await userEvent.clear(within(naming).getByLabelText("Project name"));
  await userEvent.type(within(naming).getByLabelText("Project name"), "Site");
  await userEvent.click(within(naming).getByRole("button", { name: "Save project" }));

  expect(saves(client)).toEqual([{ operation: "project/save", input: { name: "Site", path: "/Users/ana/Code/site" } }]);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("refuses a project name that is already taken before asking AFK", async () => {
  const client = setup();
  await screen.findByText("Studio");
  await userEvent.click(screen.getByRole("button", { name: "Add project" }));
  await userEvent.click(await within(screen.getByRole("dialog")).findByRole("button", { name: "Use this folder" }));

  const naming = await screen.findByRole("dialog", { name: "Name this project" });
  await userEvent.clear(within(naming).getByLabelText("Project name"));
  await userEvent.type(within(naming).getByLabelText("Project name"), "Studio");
  await userEvent.click(within(naming).getByRole("button", { name: "Save project" }));

  expect(within(naming).getByText("Choose a unique project name.")).toBeInTheDocument();
  expect(saves(client)).toEqual([]);
});

it("points a project at a new folder when its old one is missing", async () => {
  const client = setup({ "project/save": () => ({ ok: true }) });
  await screen.findByText("Old");

  await userEvent.click(screen.getByRole("button", { name: "Choose folder for Old" }));
  const browser = screen.getByRole("dialog", { name: "Choose project folder" });
  await userEvent.click(await within(browser).findByRole("button", { name: /^Code/ }));
  await userEvent.click(await within(browser).findByRole("button", { name: "Use this folder" }));

  expect(saves(client)).toEqual([{ operation: "project/save", input: { previous: "Old", name: "Old", path: "/Users/ana/Code" } }]);
});

it("edits a project, keeping the dialog open with AFK's reason when it refuses", async () => {
  let reply: unknown = fail("Studio has packs on. Turn them off first.");
  const client = setup({ "project/save": () => reply });
  await screen.findByText("Studio");

  await userEvent.click(screen.getByRole("button", { name: "Edit Studio" }));
  const dialog = screen.getByRole("dialog", { name: "Edit project" });
  await userEvent.clear(within(dialog).getByLabelText("Folder"));
  await userEvent.type(within(dialog).getByLabelText("Folder"), "/Users/ana/Code/new");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save project" }));

  expect(await within(dialog).findByText("Studio has packs on. Turn them off first.")).toBeInTheDocument();
  expect(saves(client)).toEqual([{ operation: "project/save", input: { previous: "Studio", name: "Studio", path: "/Users/ana/Code/new" } }]);

  reply = { ok: true };
  await userEvent.click(within(dialog).getByRole("button", { name: "Save project" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("removes a project definition only after confirming, and reports a refusal", async () => {
  const client = setup({ "project/remove": () => fail("Disable this project's profiles and managed individual skills before removing its definition.") });
  await screen.findByText("Studio");

  await userEvent.click(screen.getByRole("button", { name: "Remove Studio" }));
  const dialog = screen.getByRole("dialog", { name: "Remove Studio?" });
  expect(client.calls.some(call => call.operation === "project/remove")).toBe(false);
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove project" }));

  expect(client.calls).toContainEqual({ operation: "project/remove", input: { name: "Studio" } });
  expect(await within(dialog).findByText(/Disable this project's profiles/)).toBeInTheDocument();
});
