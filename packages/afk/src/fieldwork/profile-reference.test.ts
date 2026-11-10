import { expect, it } from "vitest";
import { emptySettings } from "./settings.js";
import { resolveProfile } from "./skills.js";

it("matches names without case sensitivity and rejects ambiguous names while retaining ID lookup", () => {
  const settings = emptySettings();
  settings.profiles = ["one", "two"].map(id => ({ id, name: "PStack", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] }));
  expect(() => resolveProfile(settings, "pstack")).toThrow(/Multiple packs/);
  expect(resolveProfile(settings, "one").id).toBe("one");
  settings.profiles.pop();
  expect(resolveProfile(settings, " pstack ").id).toBe("one");
  expect(() => resolveProfile(settings, "missing")).toThrow(/not found/);
});
