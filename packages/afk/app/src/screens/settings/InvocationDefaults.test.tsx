import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";
import { InvocationDefaults } from "@/screens/settings/InvocationDefaults";

const snapshot = (preferences: Record<string, string>) => ({ home: "/h", settings: { projects: [], preferences }, projectStatuses: {} });

it("lists only Global overrides, with their mode in words", async () => {
  renderWithApp(<InvocationDefaults />, { client: fakeClient({ state: () => snapshot({ "Global|kami": "Manual only", "Studio|kami": "Automatic allowed", "Global|atlas": "Automatic allowed" }) }) });

  const list = await screen.findByRole("list", { name: "Global overrides" });
  expect(list.textContent).toContain("kami");
  expect(list.textContent).toContain("atlas");
  expect(list.textContent).not.toContain("Studio");
  expect(screen.getByRole("link", { name: "Adjust in Skills" })).toHaveAttribute("href", "#/skills");
});

it("says every skill follows its own file when nothing is overridden", async () => {
  renderWithApp(<InvocationDefaults />, { client: fakeClient({ state: () => snapshot({}) }) });

  expect(await screen.findByText(/No Global overrides/)).toBeInTheDocument();
});
