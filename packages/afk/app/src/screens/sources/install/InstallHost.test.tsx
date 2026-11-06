import { act, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InstallHost } from "@/screens/sources/install/InstallHost";
import { closeInstall, openInstall } from "@/screens/sources/install/store";
import { fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

afterEach(() => closeInstall());

const client = () => fakeClient({
  state: () => ({ settings: { favoriteSources: [], profiles: [], projects: [] }, kit: {} }),
  "kit/install-preview": ({ source }) => ({ source, candidates: [{ name: "kami", description: "Typeset", state: "new" }] }),
  "skills/install-state": () => null,
});

it("shows nothing until another screen asks for the install dialog", () => {
  renderWithApp(<InstallHost />, { client: client() });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens from any screen with a repository, its skills and a destination, and closes again", async () => {
  renderWithApp(<InstallHost />, { client: client() });

  act(() => openInstall({ repository: "fieldnotes/agent-skills", skills: ["kami"], destination: "core" }));

  expect(await screen.findByRole("checkbox", { name: /kami/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /^Core/ })).toBeChecked();

  act(() => closeInstall());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
