import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { Schedule } from "@/screens/settings/Schedule";

const off = { scope: "Global", enabled: false, frequency: "weekly", time: "09:00", weekday: 1, running: false };

function setup(state: Record<string, unknown> = off) {
  const client = fakeClient({ "skills/schedule-state": () => state, "skills/schedule": input => ({ ...state, ...input }) });
  renderWithApp(<Schedule />, { client });
  return client;
}

const saved = (client: ReturnType<typeof setup>) => client.calls.filter(call => call.operation === "skills/schedule").map(call => call.input);

it("turns automatic updates on with the schedule shown", async () => {
  const client = setup();

  await userEvent.click(await screen.findByRole("switch", { name: "Update Global skills automatically" }));

  expect(saved(client)).toEqual([{ enabled: true, frequency: "weekly", time: "09:00", weekday: 1 }]);
});

it("offers a day only for weekly updates and saves a change right away", async () => {
  const client = setup({ ...off, enabled: true, nextRunAt: Date.UTC(2026, 10, 9, 9, 0) });
  const repeat = await screen.findByLabelText("Repeat");
  expect(screen.getByLabelText("Day")).toHaveValue("1");

  await userEvent.selectOptions(repeat, "daily");

  expect(saved(client)).toEqual([{ enabled: true, frequency: "daily", time: "09:00", weekday: 1 }]);
});

it("says when the last automatic run failed and keeps its output within reach", async () => {
  setup({ ...off, lastResult: { at: Date.UTC(2026, 10, 2, 9, 0), code: 1, phase: "update", output: "network down" } });

  expect(await screen.findByText(/Failed; original skills unchanged/)).toBeInTheDocument();
  expect(screen.getByText("network down")).toBeInTheDocument();
});

it("says an update is running now", async () => {
  setup({ ...off, enabled: true, running: true });

  expect(await screen.findByText(/Updating Global skills now/)).toBeInTheDocument();
});
