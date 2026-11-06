import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { Page } from "@/shell/Page";
import { Shell } from "@/shell/Shell";
import { navigation } from "@/screens/registry";
import type { ScreenDefinition } from "@/screens/types";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

const labels = ["Overview", "Skills", "Packs", "Sources", "Agent rules", "Tools", "Backup", "Settings"];

it("lists every section in the left navigation and marks the current one", () => {
  renderWithApp(<Shell />);

  const nav = screen.getByRole("navigation", { name: "Sections" });
  expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(labels);
  expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
});

it("opens a section from the navigation and moves focus to its heading", async () => {
  renderWithApp(<Shell />);
  const nav = screen.getByRole("navigation", { name: "Sections" });

  await userEvent.click(within(nav).getByRole("link", { name: "Backup" }));

  expect(window.location.hash).toBe("#/backup");
  const heading = screen.getByRole("heading", { level: 1, name: "Backup" });
  expect(heading).toHaveFocus();
  expect(within(nav).getByRole("link", { name: "Backup" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
});

it("offers every section from the phone Section menu, with the same signals", async () => {
  const flagged: ScreenDefinition[][] = navigation.map(group => group.map(item => item.id === "skills" ? { ...item, useAttention: () => ({ text: "2 to review" }) } : item));
  renderWithApp(<Shell navigation={flagged} />);
  const section = screen.getByRole("combobox", { name: "Section" });
  expect(within(section).getAllByRole("option").map(option => option.textContent)).toEqual(labels.map(label => label === "Skills" ? "Skills · 2 to review" : label));

  await userEvent.selectOptions(section, "skills");

  expect(screen.getByRole("heading", { level: 1, name: "Skills" })).toHaveFocus();
  expect(section).toHaveValue("skills");
});

it("shows a screen's attention signal as readable text next to its name", () => {
  const flagged: ScreenDefinition[][] = navigation.map(group => group.map(item => item.id === "backup" ? { ...item, useAttention: () => ({ text: "Off", tone: "quiet" as const }) } : item));
  renderWithApp(<Shell navigation={flagged} />);

  const link = within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: /Backup/ });
  expect(link).toHaveAccessibleName("Backup Off");
  expect(within(link).getByText("Off")).not.toHaveAttribute("aria-hidden");
});

it("opens the section named in the address and falls back to Overview", () => {
  window.location.hash = "#/packs";
  const { unmount } = renderWithApp(<Shell />);
  expect(screen.getByRole("heading", { level: 1, name: "Packs" })).toBeInTheDocument();
  unmount();

  window.location.hash = "#/nowhere";
  renderWithApp(<Shell />);
  expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
});

it("passes address parameters to the screen and follows back/forward", async () => {
  function Echo({ params }: { params: URLSearchParams }) {
    return <Page title="Skills"><p>Filter: {params.get("from") ?? "all"}</p></Page>;
  }
  const echo: ScreenDefinition[][] = navigation.map(group => group.map(item => item.id === "skills" ? { ...item, Screen: Echo } : item));
  window.location.hash = "#/skills?from=review";
  renderWithApp(<Shell navigation={echo} />);
  expect(screen.getByText("Filter: review")).toBeInTheDocument();

  act(() => {
    window.location.hash = "#/skills?from=core";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  expect(screen.getByText("Filter: core")).toBeInTheDocument();
});

it("skips to the content without leaving the section", async () => {
  window.location.hash = "#/tools";
  renderWithApp(<Shell />);

  await userEvent.tab();
  const skip = screen.getByRole("link", { name: "Skip to content" });
  expect(skip).toHaveFocus();
  await userEvent.keyboard("{Enter}");

  expect(screen.getByRole("main")).toHaveFocus();
  expect(window.location.hash).toBe("#/tools");
});

it("shows the running version and offers an available update", async () => {
  renderWithApp(<Shell />, { client: fakeClient({}, { version: { current: "2.1.0", latest: "2.2.0", available: true } }) });

  expect((await screen.findAllByText("AFK 2.1.0 · 2.2.0 is available"))[0]).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Update & restart" })[0]).toBeInTheDocument();
});

it("keeps one update state for the rail and the phone menu, so an update is offered once", async () => {
  const client = fakeClient({}, { version: { current: "2.1.0", latest: "2.2.0", available: true } });
  let stateReads = 0;
  const updateState = client.app.updateState;
  client.app.updateState = async () => { stateReads++; return await updateState(); };
  renderWithApp(<Shell />, { client });
  const rail = screen.getByRole("complementary", { name: "AFK" });

  await userEvent.click(await within(rail).findByRole("button", { name: "Update & restart" }));

  expect(stateReads).toBe(1);
  expect(screen.queryByRole("button", { name: "Update & restart" })).not.toBeInTheDocument();
  expect(screen.getAllByText("AFK 2.1.0 · Starting update…")).toHaveLength(2);
});

it("shows what the updater printed when an update fails, and how to finish it", async () => {
  const client = fakeClient({}, { version: { current: "2.1.0", latest: "2.2.0", available: true } });
  client.app.update = async () => ({ ok: true, value: { started: true } });
  let job = { pending: true, phase: "Installing AFK 2.2.0…", output: "" };
  client.app.updateState = async () => ({ ok: true, value: job });
  renderWithApp(<Shell />, { client });
  const rail = screen.getByRole("complementary", { name: "AFK" });
  await within(rail).findByText("AFK 2.1.0 · Installing AFK 2.2.0…");

  job = { pending: false, phase: "Update failed", output: "npm ERR! EACCES /usr/local/lib", error: "The updater exited with code 1." } as typeof job;

  await userEvent.click(await within(rail).findByText("Update details", {}, { timeout: 3000 }));
  expect(within(rail).getByText("npm ERR! EACCES /usr/local/lib")).toBeVisible();
  expect(within(rail).getByText((_, element) => element?.tagName === "P" && /retry, or run afk update in your terminal/.test(element.textContent ?? ""))).toBeInTheDocument();
});

it("exits AFK on request and says the app is closed", async () => {
  const exits: string[] = [];
  renderWithApp(<Shell />, { client: fakeClient({}, { exit: () => { exits.push("exit"); } }) });

  await userEvent.click(within(screen.getByRole("complementary", { name: "AFK" })).getByRole("button", { name: "Exit AFK" }));

  expect(await screen.findByRole("heading", { level: 1, name: "AFK is closed" })).toHaveFocus();
  expect(exits).toEqual(["exit"]);
  expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
});
