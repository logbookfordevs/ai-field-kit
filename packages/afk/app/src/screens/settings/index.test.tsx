import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { screen as settings } from "@/screens/settings";

it("offers every Settings area as its own headed section", async () => {
  const client = fakeClient({
    state: () => ({ home: "/h", settings: { projects: [], preferences: {} }, projectStatuses: {} }),
    "backup/state": () => ({ status: { library: true, state: "off", waiting: 0, attention: 0, held: false, pushing: false }, attention: [], unpushed: [] }),
    "agent-folders/state": () => ({ library: true, folders: [], invocationAgents: { claude: [], codex: [] } }),
    "skills/schedule-state": () => ({ scope: "Global", enabled: false, frequency: "weekly", time: "09:00", weekday: 1, running: false }),
  });
  renderWithApp(<settings.Screen params={new URLSearchParams()} />, { client });

  expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Your library", "Agent folders", "Projects", "Automatic skill updates", "Invocation defaults"]);
  expect(await screen.findByRole("button", { name: "Add project" })).toBeInTheDocument();
});
