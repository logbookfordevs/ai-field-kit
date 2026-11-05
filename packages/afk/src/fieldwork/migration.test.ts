import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { definition } from "./local-state.js";
import { FieldworkOperations } from "./operations.js";
import { SettingsStore } from "./settings.js";

let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;

const videoGroups = [
  { source: "https://github.com/owner/motion", skills: ["reel"] },
  { source: "https://github.com/owner/watch", skills: ["watch"] },
];

function legacySettings(): Record<string, unknown> {
  return {
    version: 1,
    configurationId: "real-config",
    welcomeDismissed: true,
    profiles: [
      { id: "stack-video", name: "Video", source: videoGroups[0]!.source, skills: ["reel", "watch"], groups: videoGroups },
      { id: "profile-solo", name: "Solo", source: "owner/solo", skills: ["solo"] },
    ],
    projects: [{ name: "Work", path: join(home, "work") }],
    tools: [
      { id: 1, name: "Waypoint", install: "curl waypoint | bash", update: "waypoint update" },
      { id: 2, name: "Plannotator", install: "curl plannotator | bash", update: "" },
      { id: 3, name: "Orchestrator", install: "npm i orchestrator", update: "" },
      { id: 4, name: "Yggtree", install: "curl yggtree | bash", update: "yggtree update" },
    ],
    favoriteSources: [{ name: "Later", source: "owner/later", description: "Try this" }, { name: "Picked", source: "owner/picked", skills: ["one"] }],
    stacks: [
      { manifest: { version: 1, id: "atlas", name: "Atlas", sources: [
        { name: "Atlas Skills", source: "https://github.com/me/atlas", skills: ["atlas-a", "atlas-gone"] },
        { name: "Other", source: "other/skills", skills: ["other-a"] },
      ] } },
      { manifest: { version: 1, id: "video", name: "Video Stack", description: "For video", sources: [
        { name: "Motion", source: "https://github.com/owner/motion", skills: ["reel"] },
        { name: "Watch", source: "https://github.com/owner/watch", skills: ["watch"] },
      ] } },
      { manifest: { version: 1, id: "loose", name: "Loose", sources: [{ name: "Loose", source: "owner/loose", skills: ["free"] }] }, origin: "https://example.com/loose.json" },
    ],
    savedSkills: [{ scope: "Global", savedAt: "2026-10-16T04:50:17.986Z", skills: [{ name: "atlas-a", available: true, invocation: "" }] }],
    agentRules: { destinations: [{ id: "claude", name: "Claude", kind: "claude", path: join(home, "CLAUDE.md") }] },
  };
}

async function skill(name: string, source?: string): Promise<void> {
  await mkdir(join(home, ".agents/skills", name), { recursive: true });
  await writeFile(join(home, ".agents/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name}\n---\n`);
  if (source) {
    const path = join(home, ".agents/.skill-lock.json");
    const lock = await readFile(path, "utf8").then(text => JSON.parse(text) as { skills: Record<string, unknown> }, () => ({ skills: {} as Record<string, unknown> }));
    lock.skills[name] = { source };
    await writeFile(path, JSON.stringify(lock));
  }
}

async function writeLegacy(settings = legacySettings()): Promise<void> {
  await writeFile(store.path, JSON.stringify(settings, null, 2));
}

async function portable(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(store.path, "utf8")) as Record<string, unknown>;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-migration-"));
  await mkdir(join(home, ".afk"), { recursive: true });
  await mkdir(join(home, "work"), { recursive: true });
  store = new SettingsStore(home);
  operations = new FieldworkOperations(store);
  await skill("atlas-a", "me/atlas");
  await skill("atlas-new", "me/atlas");
  await skill("other-a", "other/skills");
  await skill("unrelated", "someone/else");
  await skill("waypoint", join(home, "releases/waypoint"));
  await skill("plannotator");
  await skill("plannotator-review");
  await skill("orchestrator", "owner/orchestrator");
});

describe("dry run", () => {
  it("reports what would change without touching the settings file", async () => {
    await writeLegacy();
    const before = await readFile(store.path, "utf8");

    const preview = await operations.run("migration/preview", { core: "atlas", follow: ["me/atlas"] }) as {
      required: boolean;
      fingerprint: string;
      report: { stacks: { id: string; becomes: string }[]; added: { name: string }[]; preserved: Record<string, number>; dropped: { savedSkills: number }; core: { source: string; skills: string[] }[]; packs: { id: string }[] };
    };

    expect(preview.required).toBe(true);
    expect(preview.report.stacks).toEqual([
      expect.objectContaining({ id: "atlas", becomes: "core" }),
      expect.objectContaining({ id: "video", becomes: "pack" }),
      expect.objectContaining({ id: "loose", becomes: "pack" }),
    ]);
    expect(preview.report.added.map(item => item.name)).toEqual(["atlas-new"]);
    expect(preview.report.core[0]).toMatchObject({ source: "https://github.com/me/atlas", skills: ["atlas-a", "atlas-gone", "atlas-new"] });
    expect(preview.report.packs.map(pack => pack.id).sort()).toEqual(["profile-solo", "stack-loose", "stack-video"]);
    expect(preview.report.preserved).toMatchObject({ sources: 2, tools: 4, projects: 1, rulesDestinations: 1, profiles: 2 });
    expect(preview.report.dropped.savedSkills).toBe(1);
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("asks which stack is Core instead of assuming one, and reports none when unset", async () => {
    await writeLegacy();

    const preview = await operations.run("migration/preview", {}) as { report: { stacks: { becomes: string }[]; core: unknown[] } };

    expect(preview.report.stacks.every(stack => stack.becomes === "pack")).toBe(true);
    expect(preview.report.core).toEqual([]);
  });

  it("rejects a Core choice that does not exist", async () => {
    await writeLegacy();

    await expect(operations.run("migration/preview", { core: "missing" })).rejects.toThrow(/stack/i);
  });

  it("suggests tool links from matching names, leaving tools without skills out", async () => {
    await writeLegacy();

    const preview = await operations.run("migration/preview", { core: "atlas" }) as { report: { tools: { name: string; provides: string[]; linked: boolean }[] } };

    expect(preview.report.tools).toEqual([
      expect.objectContaining({ name: "Waypoint", provides: ["waypoint"], linked: true }),
      expect.objectContaining({ name: "Plannotator", provides: ["plannotator", "plannotator-review"], linked: true }),
      expect.objectContaining({ name: "Orchestrator", provides: ["orchestrator"], linked: true }),
    ]);
  });
});

describe("applying", () => {
  async function apply(choices: Record<string, unknown> = { core: "atlas", follow: ["me/atlas"] }): Promise<Record<string, unknown>> {
    const preview = await operations.run("migration/preview", choices) as { fingerprint: string };
    return await operations.run("migration/apply", { ...choices, fingerprint: preview.fingerprint }) as Record<string, unknown>;
  }

  it("writes the new format and preserves every definition", async () => {
    await writeLegacy();

    await apply();

    const saved = await portable() as { version: number; kit: { core: { source: string; name?: string; skills: string[]; follow?: boolean }[] }; favoriteSources: unknown[]; tools: { id: number; install: string; provides?: string[] }[]; projects: unknown[]; profiles: { id: string; description?: string; origin?: string; sourceNames?: Record<string, string> }[]; agentRules: unknown; configurationId: string; welcomeDismissed: boolean };
    const legacy = legacySettings() as { favoriteSources: unknown[]; projects: unknown[]; agentRules: unknown };
    expect(saved.version).toBe(2);
    expect(saved).not.toHaveProperty("stacks");
    expect(saved).not.toHaveProperty("savedSkills");
    expect(saved.configurationId).toBe("real-config");
    expect(saved.welcomeDismissed).toBe(true);
    expect(saved.favoriteSources).toEqual(legacy.favoriteSources);
    expect(saved.projects).toEqual(legacy.projects);
    expect(saved.agentRules).toEqual(legacy.agentRules);
    expect(saved.kit.core).toEqual([
      { name: "Atlas Skills", source: "https://github.com/me/atlas", skills: ["atlas-a", "atlas-gone", "atlas-new"], follow: true },
      { name: "Other", source: "other/skills", skills: ["other-a"] },
    ]);
    expect(saved.tools.map(tool => [tool.id, tool.install])).toEqual([[1, "curl waypoint | bash"], [2, "curl plannotator | bash"], [3, "npm i orchestrator"], [4, "curl yggtree | bash"]]);
    expect(saved.tools[0]!.provides).toEqual(["waypoint"]);
    expect(saved.tools[3]).not.toHaveProperty("provides");
    const video = saved.profiles.find(profile => profile.id === "stack-video")!;
    expect(video.description).toBe("For video");
    expect(video.sourceNames).toEqual({ "https://github.com/owner/motion": "Motion", "https://github.com/owner/watch": "Watch" });
    expect(saved.profiles.find(profile => profile.id === "stack-loose")).toMatchObject({ name: "Loose", source: "owner/loose", skills: ["free"], origin: "https://example.com/loose.json" });
  });

  it("keeps a pack on, with its links, because its member definition did not change", async () => {
    await writeLegacy();
    const link = join(home, ".agents/skills/reel");
    const target = join(home, ".agents/skills/.disabled/reel");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "SKILL.md"), "---\nname: reel\ndescription: reel\n---\n");
    await symlink(target, link, "dir");
    const video = { source: videoGroups[0]!.source, skills: ["reel", "watch"], groups: videoGroups };
    await mkdir(join(home, ".afk/local"), { recursive: true });
    await writeFile(store.localPath("real-config"), JSON.stringify({
      version: 1, profiles: { "stack-video": { definition: definition(video as never), enabled: ["Global"], ready: true } },
      preferences: { "Global|reel": "Manual only" }, managedLinks: { [link]: target }, independentSkills: {}, ruleReceipts: {}, projectPaths: { Work: join(home, "work") },
    }));

    await apply();

    const settings = await store.read();
    expect(settings.profiles.find(profile => profile.id === "stack-video")).toMatchObject({ enabled: ["Global"], ready: true });
    expect(settings.managedLinks[link]).toBe(target);
    expect(settings.preferences["Global|reel"]).toBe("Manual only");
  });

  it("leaves a permanent copy that later saves never rotate away", async () => {
    await writeLegacy();
    const original = await readFile(store.path, "utf8");

    const result = await apply() as { backup: string };

    expect(await readFile(result.backup, "utf8")).toBe(original);
    const settings = await store.read();
    for (let index = 0; index < 25; index++) {
      settings.favoriteSources.push({ name: `Later ${index}`, source: `owner/later-${index}` });
      await store.save(settings);
    }
    expect(await readFile(result.backup, "utf8")).toBe(original);
  });

  it("refuses to apply when the settings file changed after the dry run", async () => {
    await writeLegacy();
    const preview = await operations.run("migration/preview", { core: "atlas" }) as { fingerprint: string };
    const edited = legacySettings();
    (edited.favoriteSources as unknown[]).push({ name: "New", source: "owner/new" });
    await writeLegacy(edited);

    await expect(operations.run("migration/apply", { core: "atlas", fingerprint: preview.fingerprint })).rejects.toThrow(/changed/i);
    expect((await portable()).version).toBe(1);
  });

  it("honours skipped tool links", async () => {
    await writeLegacy();

    await apply({ core: "atlas", skipTools: ["Orchestrator"] });

    const tools = (await portable() as { tools: { name: string; provides?: string[] }[] }).tools;
    expect(tools.find(tool => tool.name === "Orchestrator")).not.toHaveProperty("provides");
    expect(tools.find(tool => tool.name === "Waypoint")!.provides).toEqual(["waypoint"]);
  });

  it("keeps a linked pack's own members and warns when its stack picks differ", async () => {
    const settings = legacySettings();
    const stacks = settings.stacks as { manifest: { id: string; sources: { skills: string[] }[] } }[];
    stacks.find(stack => stack.manifest.id === "video")!.manifest.sources[0]!.skills.push("extra");
    await writeLegacy(settings);

    const preview = await operations.run("migration/preview", { core: "atlas" }) as { report: { warnings: string[] } };

    expect(preview.report.warnings.join(" ")).toContain("extra");
    expect(preview.report.warnings.join(" ")).toContain("Video");
  });

  it("resolves a skill picked from two sources to the first and warns", async () => {
    const settings = legacySettings();
    const stacks = settings.stacks as { manifest: { id: string; sources: { skills: string[] }[] } }[];
    stacks.find(stack => stack.manifest.id === "atlas")!.manifest.sources[1]!.skills.push("atlas-a");
    await writeLegacy(settings);

    const preview = await operations.run("migration/preview", { core: "atlas" }) as { report: { warnings: string[]; core: { skills: string[] }[] } };

    expect(preview.report.core[1]!.skills).toEqual(["other-a"]);
    expect(preview.report.warnings.join(" ")).toContain("atlas-a");
  });

  it("reports nothing to do on an already migrated file", async () => {
    await writeLegacy();
    await apply();

    const preview = await operations.run("migration/preview", {}) as { required: boolean };

    expect(preview.required).toBe(false);
    await expect(operations.run("migration/apply", { fingerprint: "x" })).rejects.toThrow(/already/i);
  });
});

describe("the write gate", () => {
  it("blocks every write to a version 1 file that has stacks", async () => {
    await writeLegacy();
    const before = await readFile(store.path, "utf8");

    await expect(operations.run("welcome")).rejects.toThrow(/afk migrate/);
    await expect(operations.run("activation", { id: "profile-solo", scope: "Global", enabled: false })).rejects.toThrow(/afk migrate/);

    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("still reads that file, so the app can show the migration", async () => {
    await writeLegacy();

    const state = await operations.run("state") as { migration: { required: boolean }; settings: { profiles: unknown[] } };

    expect(state.migration.required).toBe(true);
    expect(state.settings.profiles).toHaveLength(2);
  });

  it("upgrades a stackless version 1 file silently, still keeping a permanent copy", async () => {
    const settings = legacySettings();
    delete settings.stacks;
    await writeLegacy(settings);
    const original = await readFile(store.path, "utf8");

    await operations.run("welcome");

    expect((await portable()).version).toBe(2);
    const copies = (await readdir(join(home, ".afk/backups"))).filter(name => name.startsWith("pre-kit-"));
    expect(copies).toHaveLength(1);
    expect(await readFile(join(home, ".afk/backups", copies[0]!), "utf8")).toBe(original);
  });

  it("creates new settings in the new format", async () => {
    await operations.run("welcome");

    expect(await portable()).toMatchObject({ version: 2, kit: { core: [] } });
  });
});
