import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("walks through all six pages with back, skip, finish, and restart without configuration mutations", () => {
  const panel = { hidden: true, innerHTML: "" };
  const focus = vi.fn(), request = vi.fn(), navigate = vi.fn();
  const context = createContext({
    $: (id: string) => id === "featureTour" ? panel : { focus, addEventListener: vi.fn() },
    esc: String, button: (label: string) => label, navigate: (page: string) => { navigate(page); runInContext("renderTour()", context); },
    closeModal: vi.fn(), request, toast: vi.fn(),
  });
  runInContext(readFileSync(new URL("../../web/onboarding.js", import.meta.url), "utf8"), context);
  runInContext("startTour()", context);
  expect(panel.hidden).toBe(false);
  expect(panel.innerHTML).toContain("1 of 6");
  runInContext("moveTour(1);moveTour(-1)", context);
  expect(navigate.mock.calls.map(call => call[0])).toEqual(["Installed Skills", "Profiles", "Installed Skills"]);
  for (let step = 0; step < 5; step++) runInContext("moveTour(1)", context);
  expect(navigate.mock.calls.slice(-5).map(call => call[0])).toEqual(["Profiles", "Sources & Stacks", "Agent rules", "Tools", "Settings"]);
  expect(panel.innerHTML).toContain("Finish tour");
  runInContext("endTour(true)", context);
  expect(panel.hidden).toBe(true);
  runInContext("startTour();endTour()", context);
  expect(panel.hidden).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
