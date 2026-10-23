import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";
import { emptySettings } from "./settings.js";
import { resolveProfile } from "./skills.js";

it("matches names without case sensitivity and rejects ambiguous names while retaining ID lookup", () => {
  const settings = emptySettings();
  settings.profiles = ["one", "two"].map(id => ({ id, name: "PStack", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] }));
  expect(() => resolveProfile(settings, "pstack")).toThrow(/Multiple profiles/);
  expect(resolveProfile(settings, "one").id).toBe("one");
  settings.profiles.pop();
  expect(resolveProfile(settings, " pstack ").id).toBe("one");
  expect(() => resolveProfile(settings, "missing")).toThrow(/not found/);
});

const client = readFileSync(new URL("../../web/client.js", import.meta.url), "utf8");
const commands = client.slice(client.indexOf("function profileUsageCommands("), client.indexOf("invoke=async"));

it("shows name-based CLI and skill usage, safely quoting names with spaces and apostrophes", () => {
  const profile = { id: "profile-one", name: "Writer's Room" };
  const context = createContext({ profiles: [profile], profile });
  runInContext(commands, context);
  const usage = runInContext("profileUsageCommands(profile)", context) as { command: string; skill: string };
  expect(usage.command).toBe("afk profiles use 'Writer'\\''s Room'");
  expect(usage.skill).toBe("/afk-cli use profile 'Writer'\\''s Room'");
});

it("uses the ID in usage commands when a profile name is ambiguous", () => {
  const profile = { id: "profile-one", name: "PStack" };
  const context = createContext({ profiles: [profile, { id: "profile-two", name: "pstack" }], profile });
  runInContext(commands, context);
  expect(runInContext("profileUsageCommands(profile).command", context)).toBe("afk profiles use profile-one");
  expect(runInContext("profileUsageCommands(profile).duplicates", context)).toBe(true);
});
