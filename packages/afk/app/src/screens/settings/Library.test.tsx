import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { Library } from "@/screens/settings/Library";

const state = { home: "/Users/ana", settings: { projects: [], preferences: {} }, projectStatuses: {} };

function setup(status: Record<string, unknown>) {
  renderWithApp(<Library />, { client: fakeClient({ state: () => state, "backup/state": () => ({ status, attention: [], unpushed: [] }) }) });
}

it("shows where the library lives and where it is backed up, with a way to Backup", async () => {
  setup({ library: true, state: "saved", remote: "git@github.com:ana/afk-library.git", waiting: 0, attention: 0, held: false, pushing: false });

  expect(await screen.findByText("/Users/ana/.afk/library")).toBeInTheDocument();
  expect(screen.getByText("git@github.com:ana/afk-library.git")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Backup" })).toHaveAttribute("href", "#/backup");
});

it("says backup is off when there is no remote", async () => {
  setup({ library: true, state: "off", waiting: 0, attention: 0, held: false, pushing: false });

  expect(await screen.findByText("Off")).toBeInTheDocument();
});

it("offers to start or restore a library when there is none", async () => {
  setup({ library: false, state: "off", waiting: 0, attention: 0, held: false, pushing: false });

  expect(await screen.findByRole("link", { name: "Start a new library" })).toHaveAttribute("href", "#/overview?start=library");
  expect(screen.getByRole("link", { name: "Restore my library" })).toHaveAttribute("href", "#/overview?start=restore");
  expect(screen.queryByText("/Users/ana/.afk/library")).not.toBeInTheDocument();
});
