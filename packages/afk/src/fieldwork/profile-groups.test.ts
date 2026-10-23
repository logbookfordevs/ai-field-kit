import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definition } from "./local-state.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore, validateSettings } from "./settings.js";

const folders: string[] = [];
let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;

async function repository(name: string, skills: string[]): Promise<string> {
  const root = join(home, "repositories", name);
  for (const skill of skills) {
    await mkdir(join(root, skill), { recursive: true });
    await writeFile(join(root, skill, "SKILL.md"), `---\nname: ${skill}\ndescription: ${skill} from ${name}\n---\n${skill} instructions\n`);
  }
  return root;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-profile-groups-")); folders.push(home);
  store = new SettingsStore(home);
  const directories: Record<string, string> = {
    "owner/art": await repository("art", ["draw", "paint"]),
    "owner/qa": await repository("qa", ["review", "draw"]),
  };
  vi.spyOn(SourcePreparation.prototype, "directory").mockImplementation(async source => {
    const directory = directories[source];
    if (!directory) throw new Error(`Unexpected source ${source}`);
    return directory;
  });
  const settings = emptySettings();
  settings.stacks = [{ manifest: { version: 1, id: "creative", name: "Creative", sources: [
    { name: "Art", source: "owner/art", skills: ["draw", "paint"] },
    { name: "QA", source: "owner/qa", skills: ["review"] },
  ] } }];
  await store.save(settings);
  operations = new FieldworkOperations(store);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await operations.close();
  await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("multi-source profiles", () => {
  it("turns a stack into a profile, preparing each skill from its own source", async () => {
    expect(await operations.run("profile/save", { stack: "creative" })).toEqual({ ok: true, id: "stack-creative" });
    const profile = (await store.read()).profiles[0]!;
    expect(profile).toMatchObject({
      id: "stack-creative", name: "Creative", source: "owner/art", skills: ["draw", "paint", "review"],
      groups: [{ source: "owner/art", skills: ["draw", "paint"] }, { source: "owner/qa", skills: ["review"] }],
      ready: true, enabled: [],
    });
    const stored = join(home, ".agents/skills/.disabled");
    expect(await readFile(join(stored, "draw/SKILL.md"), "utf8")).toContain("draw from art");
    expect(JSON.parse(await readFile(join(stored, "review/.afk-source.json"), "utf8"))).toEqual({ source: "owner/qa" });
  });

  it("activates every member across sources and keeps activation after reloading", async () => {
    await operations.run("profile/save", { stack: "creative" });
    await operations.run("activation", { id: "stack-creative", scope: "Global", enabled: true });
    for (const skill of ["draw", "paint", "review"]) expect(await readlink(join(home, ".agents/skills", skill))).toBe(join(home, ".agents/skills/.disabled", skill));
    expect((await store.read()).profiles[0]?.enabled).toEqual(["Global"]);
    await operations.run("activation", { id: "stack-creative", scope: "Global", enabled: false });
    expect((await store.read()).profiles[0]?.enabled).toEqual([]);
  });

  it("updates the same profile from the stack later, but only while it is off everywhere", async () => {
    await operations.run("profile/save", { stack: "creative" });
    await operations.run("activation", { id: "stack-creative", scope: "Global", enabled: true });
    await expect(operations.run("profile/save", { stack: "creative" })).rejects.toThrow("Disable every scope");
    await operations.run("activation", { id: "stack-creative", scope: "Global", enabled: false });
    const settings = await store.read();
    settings.stacks![0]!.manifest.sources = [{ name: "Art", source: "owner/art", skills: ["paint"] }];
    await store.save(settings);
    await operations.run("profile/save", { stack: "creative", name: "Creative work" });
    const profiles = (await store.read()).profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: "stack-creative", name: "Creative work", source: "owner/art", skills: ["paint"] });
    expect(profiles[0]).not.toHaveProperty("groups");
  });

  it("rejects a skill selected from two sources without preparing anything", async () => {
    await expect(operations.run("profile/save", { name: "Clash", groups: [{ source: "owner/art", skills: ["draw"] }, { source: "owner/qa", skills: ["draw"] }] }))
      .rejects.toThrow("draw is selected from owner/art and owner/qa");
    expect((await store.read()).profiles).toEqual([]);
    expect(SourcePreparation.prototype.directory).not.toHaveBeenCalled();
  });

  it("rejects stack input combined with explicit members and unknown stacks", async () => {
    await expect(operations.run("profile/save", { stack: "creative", skills: ["draw"] })).rejects.toThrow("takes its members from the stack");
    await expect(operations.run("profile/save", { stack: "missing" })).rejects.toThrow("Stack not found");
  });
});

describe("multi-source profile settings", () => {
  const base = { id: "mixed", name: "Mixed", enabled: [], ready: false };

  it("accepts groups that match the members and rejects inconsistent ones", () => {
    const valid = { ...base, source: "owner/art", skills: ["draw", "review"], groups: [{ source: "owner/art", skills: ["draw"] }, { source: "owner/qa", skills: ["review"] }] };
    expect(validateSettings({ ...emptySettings(), profiles: [valid] }).profiles[0]?.groups).toHaveLength(2);
    for (const profile of [
      { ...valid, skills: ["draw"] },
      { ...valid, source: "owner/qa" },
      { ...valid, groups: [{ source: "owner/art", skills: ["draw"] }, { source: "owner/art", skills: ["review"] }] },
      { ...valid, groups: [{ source: "owner/art", skills: ["draw", "review"] }] },
    ]) expect(() => validateSettings({ ...emptySettings(), profiles: [profile] })).toThrow();
  });

  it("keeps the activation fingerprint of existing single-source profiles", () => {
    const profile = { ...base, source: "owner/art", skills: ["draw"] };
    expect(definition(profile)).toBe(createHash("sha256").update(JSON.stringify(["owner/art", ["draw"]])).digest("hex"));
  });
});
