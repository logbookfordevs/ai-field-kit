import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KitStatus, SyncPlan } from "./kit.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore, type Settings } from "./settings.js";

let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;

async function skill(name: string, source?: string): Promise<void> {
  await mkdir(join(home, ".agents/skills", name), { recursive: true });
  await writeFile(join(home, ".agents/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} skill\n---\n`);
  if (source) {
    const path = join(home, ".agents/.skill-lock.json");
    const lock = await readFile(path, "utf8").then(text => JSON.parse(text) as { skills: Record<string, unknown> }, () => ({ skills: {} as Record<string, unknown> }));
    lock.skills[name] = { source };
    await writeFile(path, JSON.stringify(lock));
  }
}

async function repository(name: string, skills: string[]): Promise<string> {
  const root = join(home, "repositories", name);
  for (const member of skills) {
    await mkdir(join(root, member), { recursive: true });
    await writeFile(join(root, member, "SKILL.md"), `---\nname: ${member}\ndescription: ${member}\n---\n`);
  }
  return root;
}

async function configure(patch: Partial<Settings>): Promise<void> {
  await store.save({ ...emptySettings(), ...patch });
}

async function status(): Promise<KitStatus> {
  return await operations.run("kit/state") as KitStatus;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-kit-"));
  store = new SettingsStore(home);
  operations = new FieldworkOperations(store);
  await configure({});
});

afterEach(() => vi.restoreAllMocks());

describe("comparing the kit with this machine", () => {
  it("sorts skills into in-kit, missing here and undecided", async () => {
    await skill("kept", "me/core");
    await skill("stranger", "someone/else");
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept", "absent"] }] } });

    const kit = await status();

    expect(kit.core).toEqual([
      expect.objectContaining({ name: "absent", status: "missing", source: "me/core" }),
      expect.objectContaining({ name: "kept", status: "on", source: "me/core" }),
    ]);
    expect(kit.undecided.map(item => item.name)).toEqual(["stranger"]);
    expect(kit.undecided[0]).toMatchObject({ source: "someone/else", installable: true });
    expect(kit.plan.install).toEqual([{ source: "me/core", skills: ["absent"] }]);
  });

  it("does not ask about pack members, tool skills or machine-only skills", async () => {
    await skill("in-pack", "owner/pack");
    await skill("from-tool");
    await skill("just-here", "someone/else");
    await configure({
      tools: [{ id: 1, name: "Tool", install: "install tool", update: "", provides: ["from-tool"] }],
      profiles: [{ id: "pack", name: "Pack", source: "owner/pack", skills: ["in-pack"], enabled: [], ready: true }],
    });
    await operations.run("kit/machine-only", { name: "just-here", enabled: true });

    const kit = await status();

    expect(kit.undecided).toEqual([]);
    expect(kit.machineOnly).toEqual(["just-here"]);
  });

  it("does not ask about skills that are installed but turned off", async () => {
    await mkdir(join(home, ".agents/skills/.disabled/parked"), { recursive: true });
    await writeFile(join(home, ".agents/skills/.disabled/parked/SKILL.md"), "---\nname: parked\ndescription: parked\n---\n");

    expect((await status()).undecided).toEqual([]);
  });

  it("flags a skill with no repository source as something the kit cannot reinstall", async () => {
    await skill("handmade");
    await skill("local-release", "/Users/me/releases/skill");

    const kit = await status();

    expect(kit.undecided.map(item => [item.name, item.installable])).toEqual([["handmade", false], ["local-release", false]]);
  });

  it("reports a Core skill turned off here, and plans to turn it back on", async () => {
    await mkdir(join(home, ".agents/skills/.disabled/resting"), { recursive: true });
    await writeFile(join(home, ".agents/skills/.disabled/resting/SKILL.md"), "---\nname: resting\ndescription: resting\n---\n");
    await configure({ kit: { core: [{ source: "me/core", skills: ["resting"] }] } });

    const kit = await status();

    expect(kit.core[0]).toMatchObject({ name: "resting", status: "off" });
    expect(kit.plan.enable).toEqual(["resting"]);
    expect(kit.plan.install).toEqual([]);
  });

  it("treats a tool as the owner: one tool entry, not separate missing skills", async () => {
    await skill("multi");
    await configure({
      tools: [{ id: 1, name: "Multi", install: "curl multi | bash", update: "multi update", provides: ["multi", "multi-review"] }],
      kit: { core: [{ source: "me/core", skills: ["multi-review"] }] },
    });

    const kit = await status();

    expect(kit.core).toEqual([]);
    expect(kit.plan.install).toEqual([]);
    expect(kit.tools).toEqual([expect.objectContaining({ id: 1, missing: ["multi-review"] })]);
    expect(kit.plan.tools).toEqual([{ id: 1, name: "Multi", command: "curl multi | bash", skills: ["multi-review"] }]);
  });

  it("reports an empty plan when the machine matches", async () => {
    await skill("kept", "me/core");
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept"] }] } });

    expect((await status()).plan).toEqual({ install: [], enable: [], tools: [] });
  });

  it("is included in the app state", async () => {
    await skill("stranger", "someone/else");

    const state = await operations.run("state") as { kit: KitStatus };

    expect(state.kit.undecided.map(item => item.name)).toEqual(["stranger"]);
  });
});

describe("changing the kit", () => {
  it("adds an installed skill to Core using the source it was installed from", async () => {
    await skill("found", "https://github.com/someone/found");

    await operations.run("kit/add", { names: ["found"], to: "core" });

    const kit = await status();
    expect(kit.core).toEqual([expect.objectContaining({ name: "found", source: "https://github.com/someone/found", status: "on" })]);
    expect(kit.undecided).toEqual([]);
  });

  it("groups a second skill under the same source, however it is spelled", async () => {
    await skill("one", "someone/found");
    await skill("two", "https://github.com/someone/found.git");

    await operations.run("kit/add", { names: ["one"], to: "core" });
    await operations.run("kit/add", { names: ["two"], to: "core" });

    const saved = await store.read();
    expect(saved.kit!.core).toEqual([{ source: "someone/found", skills: ["one", "two"] }]);
  });

  it("refuses to add a skill it could never reinstall to Core", async () => {
    await skill("handmade");

    await expect(operations.run("kit/add", { names: ["handmade"], to: "core" })).rejects.toThrow(/tool/i);
    expect((await store.read()).kit!.core).toEqual([]);
  });

  it("accepts an explicit source for a skill that is not installed", async () => {
    await operations.run("kit/add", { names: ["future"], to: "core", source: "someone/future" });

    expect((await status()).core).toEqual([expect.objectContaining({ name: "future", status: "missing", source: "someone/future" })]);
  });

  it("drops a skill from the kit and leaves its files, so it becomes undecided", async () => {
    await skill("kept", "me/core");
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept"] }] } });

    await operations.run("kit/drop", { name: "kept" });

    const kit = await status();
    expect(kit.core).toEqual([]);
    expect(kit.undecided.map(item => item.name)).toEqual(["kept"]);
    expect((await lstat(join(home, ".agents/skills/kept"))).isDirectory()).toBe(true);
    expect((await store.read()).kit!.core).toEqual([]);
  });

  it("keeps a followed source when its last skill is dropped", async () => {
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept"], follow: true }] } });

    await operations.run("kit/drop", { name: "kept" });

    expect((await store.read()).kit!.core).toEqual([{ source: "me/core", skills: [], follow: true }]);
  });

  it("clears the machine-only mark when a skill joins the kit", async () => {
    await skill("found", "someone/found");
    await operations.run("kit/machine-only", { name: "found", enabled: true });

    await operations.run("kit/add", { names: ["found"], to: "core" });

    expect((await status()).machineOnly).toEqual([]);
  });

  it("keeps machine-only marks out of the portable file", async () => {
    await skill("found", "someone/found");

    await operations.run("kit/machine-only", { name: "found", enabled: true });

    expect(await readFile(store.path, "utf8")).not.toContain("found");
    expect((await new SettingsStore(home).read()).machineOnly).toEqual(["found"]);
  });

  it("offers skills a followed source added upstream, without installing them", async () => {
    const directory = await repository("core", ["kept", "brand-new"]);
    vi.spyOn(SourcePreparation.prototype, "discover").mockResolvedValue(["kept", "brand-new"]);
    vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(directory);
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept"], follow: true }, { source: "me/pinned", skills: ["pinned"] }] } });

    const result = await operations.run("kit/upstream") as { sources: { source: string; names: string[] }[] };

    expect(result.sources).toEqual([expect.objectContaining({ source: "me/core", names: ["brand-new"] })]);
    expect((await store.read()).kit!.core[0]!.skills).toEqual(["kept"]);
  });

  it("can follow and unfollow a source", async () => {
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept"] }] } });

    await operations.run("kit/follow", { source: "me/core", follow: true });
    expect((await store.read()).kit!.core[0]!.follow).toBe(true);

    await operations.run("kit/follow", { source: "me/core", follow: false });
    expect((await store.read()).kit!.core[0]).not.toHaveProperty("follow");
  });
});

describe("packs", () => {
  beforeEach(async () => {
    vi.spyOn(SourcePreparation.prototype, "directory").mockImplementation(async source => await repository(source.replace("/", "-"), ["a", "b", "c"]));
  });

  it("adds a member to a pack that is on, keeping it on and exposing the new skill", async () => {
    await operations.run("pack/save", { name: "Art", source: "owner/art", skills: ["a"], prepare: true });
    const id = (await store.read()).profiles[0]!.id;
    await operations.run("activation", { id, scope: "Global", enabled: true });

    await operations.run("kit/add", { names: ["b"], to: id, source: "owner/art" });

    const pack = (await store.read()).profiles[0]!;
    expect(pack.skills).toEqual(["a", "b"]);
    expect(pack.enabled).toEqual(["Global"]);
    expect((await lstat(join(home, ".agents/skills/b"))).isSymbolicLink()).toBe(true);
    expect((await lstat(join(home, ".agents/skills/a"))).isSymbolicLink()).toBe(true);
  });

  it("drops a member from a pack that is on, withdrawing only that link", async () => {
    await operations.run("pack/save", { name: "Art", source: "owner/art", skills: ["a", "b"], prepare: true });
    const id = (await store.read()).profiles[0]!.id;
    await operations.run("activation", { id, scope: "Global", enabled: true });

    await operations.run("kit/drop", { name: "b", from: id });

    const pack = (await store.read()).profiles[0]!;
    expect(pack.skills).toEqual(["a"]);
    expect(pack.enabled).toEqual(["Global"]);
    await expect(lstat(join(home, ".agents/skills/b"))).rejects.toThrow();
    expect((await lstat(join(home, ".agents/skills/a"))).isSymbolicLink()).toBe(true);
  });

  it("restores the pack when a new member cannot be turned on", async () => {
    await operations.run("pack/save", { name: "Art", source: "owner/art", skills: ["a"], prepare: true });
    const id = (await store.read()).profiles[0]!.id;
    await operations.run("activation", { id, scope: "Global", enabled: true });
    const occupied = join(home, ".claude/skills/b");
    await mkdir(occupied, { recursive: true });
    await writeFile(join(occupied, "SKILL.md"), "---\nname: b\ndescription: someone else's b\n---\n");

    await expect(operations.run("kit/add", { names: ["b"], to: id, source: "owner/art" })).rejects.toThrow(/already exists/);

    const pack = (await store.read()).profiles[0]!;
    expect(pack.skills).toEqual(["a"]);
    expect(pack.enabled).toEqual(["Global"]);
    expect((await lstat(join(home, ".agents/skills/a"))).isSymbolicLink()).toBe(true);
    expect(await readFile(join(occupied, "SKILL.md"), "utf8")).toContain("someone else's b");
  });

  it("does not touch a pack that is on when a new member cannot be downloaded", async () => {
    await operations.run("pack/save", { name: "Art", source: "owner/art", skills: ["a"], prepare: true });
    const id = (await store.read()).profiles[0]!.id;
    await operations.run("activation", { id, scope: "Global", enabled: true });
    vi.spyOn(SourcePreparation.prototype, "directory").mockRejectedValue(new Error("offline"));

    await expect(operations.run("kit/add", { names: ["b"], to: id, source: "owner/art" })).rejects.toThrow("offline");

    const pack = (await store.read()).profiles[0]!;
    expect(pack.skills).toEqual(["a"]);
    expect(pack.enabled).toEqual(["Global"]);
    expect((await lstat(join(home, ".agents/skills/a"))).isSymbolicLink()).toBe(true);
  });

  it("refuses to drop a pack's last member, and says how to remove the pack", async () => {
    await configure({ profiles: [{ id: "pack", name: "Pack", source: "owner/art", skills: ["a"], enabled: [], ready: false }] });

    await expect(operations.run("kit/drop", { name: "a", from: "pack" })).rejects.toThrow(/remove/i);
  });

  it("exports a pack, and Core, as a publishable manifest", async () => {
    await configure({
      kit: { core: [{ source: "me/core", name: "Mine", skills: ["kept"] }] },
      profiles: [{ id: "pack", name: "Pack", description: "About", source: "owner/art", skills: ["a", "b"], groups: [{ source: "owner/art", skills: ["a"] }, { source: "owner/qa", skills: ["b"] }], sourceNames: { "owner/art": "Art" }, enabled: [], ready: false }],
    });

    expect(await operations.run("pack/manifest", { id: "pack" })).toEqual({ manifest: { version: 1, id: "pack", name: "Pack", description: "About", sources: [{ name: "Art", source: "owner/art", skills: ["a"] }, { name: "qa", source: "owner/qa", skills: ["b"] }] } });
    expect(await operations.run("pack/manifest", { id: "core" })).toEqual({ manifest: { version: 1, id: "core", name: "Core", sources: [{ name: "Mine", source: "me/core", skills: ["kept"] }] } });
  });

  it("imports a manifest as a pack that stays off", async () => {
    const manifest = { version: 1, id: "shared", name: "Shared", description: "From a friend", sources: [{ name: "Art", source: "owner/art", skills: ["a"] }, { name: "QA", source: "owner/qa", skills: ["b"] }] };

    const preview = await operations.run("pack/import-preview", { manifest }) as { pack: unknown; expected: null };
    await operations.run("pack/import", { ...preview });

    const pack = (await store.read()).profiles.find(profile => profile.id === "stack-shared")!;
    expect(pack).toMatchObject({ name: "Shared", description: "From a friend", skills: ["a", "b"], enabled: [], sourceNames: { "owner/art": "Art", "owner/qa": "QA" } });
    await expect(lstat(join(home, ".agents/skills/a"))).rejects.toThrow();
  });

  it("rejects an import if the saved pack changed since review", async () => {
    const manifest = { version: 1, id: "shared", name: "Shared", sources: [{ name: "Art", source: "owner/art", skills: ["a"] }] };
    const preview = await operations.run("pack/import-preview", { manifest }) as Record<string, unknown>;
    await operations.run("pack/import", preview);

    await expect(operations.run("pack/import", preview)).rejects.toThrow(/changed/i);
  });
});

describe("syncing", () => {
  function runner(): (cwd: string, env: NodeJS.ProcessEnv, args: string[], output: (text: string) => void) => Promise<number> {
    return async (_cwd, _env, args) => {
      for (let index = 0; index < args.length; index++) if (args[index] === "--skill") await skill(args[index + 1]!, args[0]);
      return 0;
    };
  }

  beforeEach(() => { operations.installRunner = runner(); });

  it("installs what is missing and leaves the rest alone", async () => {
    await skill("kept", "me/core");
    await configure({ kit: { core: [{ source: "me/core", skills: ["kept", "absent"] }] } });
    const before = await status();

    const result = await operations.run("kit/sync", { expected: before.plan }) as { status: KitStatus; install?: { code: number } };

    expect(result.install?.code).toBe(0);
    expect(result.status.core.map(item => item.status)).toEqual(["on", "on"]);
    expect(result.status.plan).toEqual({ install: [], enable: [], tools: [] });
  });

  it("refuses a plan that no longer matches the machine", async () => {
    await configure({ kit: { core: [{ source: "me/core", skills: ["absent"] }] } });
    const stale: SyncPlan = { install: [{ source: "me/core", skills: ["other"] }], enable: [], tools: [] };

    await expect(operations.run("kit/sync", { expected: stale })).rejects.toThrow(/changed/i);
  });

  it("never runs a tool's command unless that tool was approved", async () => {
    await configure({ tools: [{ id: 1, name: "Marker", install: `touch ${join(home, "ran")}`, update: "", provides: ["marker"] }] });
    const before = await status();

    const skipped = await operations.run("kit/sync", { expected: before.plan }) as { tools: unknown[]; skippedTools: { id: number }[] };

    expect(skipped.tools).toEqual([]);
    expect(skipped.skippedTools).toEqual([expect.objectContaining({ id: 1 })]);
    await expect(lstat(join(home, "ran"))).rejects.toThrow();

    const approved = await operations.run("kit/sync", { expected: before.plan, runTools: [1] }) as { tools: { id: number; code: number }[] };

    expect(approved.tools).toEqual([expect.objectContaining({ id: 1, code: 0 })]);
    expect((await lstat(join(home, "ran"))).isFile()).toBe(true);
  });

  it("turns a Core skill back on", async () => {
    await mkdir(join(home, ".agents/skills/.disabled/resting"), { recursive: true });
    await writeFile(join(home, ".agents/skills/.disabled/resting/SKILL.md"), "---\nname: resting\ndescription: resting\n---\n");
    await configure({ kit: { core: [{ source: "me/core", skills: ["resting"] }] } });

    const result = await operations.run("kit/sync", { expected: (await status()).plan }) as { status: KitStatus };

    expect(result.status.core[0]!.status).toBe("on");
  });

  it("stops and reports when an installation fails", async () => {
    operations.installRunner = async () => 3;
    await configure({ kit: { core: [{ source: "me/core", skills: ["absent"] }] } });

    const result = await operations.run("kit/sync", { expected: (await status()).plan }) as { install: { code: number }; status: KitStatus };

    expect(result.install.code).toBe(3);
    expect(result.status.core[0]!.status).toBe("missing");
  });
});

describe("tool-owned skills in Installed Skills", () => {
  it("does not update a tool's skill through Skills CLI", async () => {
    await skill("from-tool", "owner/tool");
    await configure({ tools: [{ id: 1, name: "Waypoint", install: "x", update: "y", provides: ["from-tool"] }] });

    await expect(operations.run("skills/update", { scope: "Global", names: ["from-tool"] })).resolves.toMatchObject({ code: 1, output: expect.stringContaining("Waypoint") as string });
  });
});
