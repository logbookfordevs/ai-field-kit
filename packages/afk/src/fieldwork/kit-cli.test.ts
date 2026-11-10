import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runKit, runMigrate } from "./kit-cli.js";
import { emptySettings, SettingsStore, type Settings } from "./settings.js";

let home: string;
let store: SettingsStore;
let output: string[];
const log = (text: string): void => { output.push(text); };

async function skill(name: string, source: string): Promise<void> {
  await mkdir(join(home, ".agents/skills", name), { recursive: true });
  await writeFile(join(home, ".agents/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name}\n---\n`);
  const path = join(home, ".agents/.skill-lock.json");
  const lock = await readFile(path, "utf8").then(text => JSON.parse(text) as { skills: Record<string, unknown> }, () => ({ skills: {} as Record<string, unknown> }));
  lock.skills[name] = { source };
  await writeFile(path, JSON.stringify(lock));
}

async function configure(patch: Partial<Settings>): Promise<void> {
  await store.save({ ...emptySettings(), ...patch });
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-kit-cli-"));
  store = new SettingsStore(home);
  output = [];
  await configure({});
});

describe("afk kit", () => {
  it("lists what differs from this machine", async () => {
    await skill("stranger", "someone/else");
    await configure({ kit: { core: [{ source: "me/core", skills: ["absent"] }] } });

    expect(await runKit([], store, { log })).toBe(0);

    expect(output.join("\n")).toContain("missing absent");
    expect(output.join("\n")).toContain("stranger  someone/else");
  });

  it("adds a skill with one command, reading its source from the machine", async () => {
    await skill("found", "someone/found");

    expect(await runKit(["add", "found"], store, { log })).toBe(0);

    expect((await store.read()).kit!.core).toEqual([{ source: "someone/found", skills: ["found"] }]);
  });

  it("adds to a pack by name and drops from it", async () => {
    await skill("found", "owner/art");
    await skill("kept", "owner/art");
    await configure({ profiles: [{ id: "pack-1", name: "Art", source: "owner/art", skills: ["kept"], enabled: [], ready: true }] });

    await runKit(["add", "found", "--pack", "art"], store, { log });
    expect((await store.read()).profiles[0]!.skills).toEqual(["kept", "found"]);

    await runKit(["drop", "found", "--pack", "Art"], store, { log });
    expect((await store.read()).profiles[0]!.skills).toEqual(["kept"]);
  });

  it("explains itself when used wrongly", async () => {
    await expect(runKit(["add"], store, { log })).rejects.toThrow(/afk kit add/);
    await expect(runKit(["add", "x", "--wat"], store, { log })).rejects.toThrow(/Unknown option/);
  });
});

describe("afk migrate", () => {
  const legacy = { version: 1, configurationId: "real", profiles: [], projects: [], tools: [], favoriteSources: [], stacks: [{ manifest: { version: 1, id: "mine", name: "Mine", sources: [{ name: "One", source: "owner/one", skills: ["one"] }] } }] };

  it("is a dry run unless told to apply", async () => {
    await writeFile(store.path, JSON.stringify(legacy));
    const before = await readFile(store.path, "utf8");

    expect(await runMigrate(["--core", "mine"], store, { log })).toBe(0);

    expect(output.join("\n")).toContain("Mine (mine): 1 skill → Core");
    expect(output.join("\n")).toContain("nothing was written");
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("applies when told to, and says where the old file is", async () => {
    await writeFile(store.path, JSON.stringify(legacy));

    expect(await runMigrate(["--core", "mine", "--apply"], store, { log })).toBe(0);

    expect((await store.read()).kit!.core).toEqual([{ name: "One", source: "owner/one", skills: ["one"] }]);
    expect(output.join("\n")).toContain("pre-kit-");
  });

  it("has nothing to do on current settings", async () => {
    expect(await runMigrate([], store, { log })).toBe(0);

    expect(output.join("\n")).toContain("Nothing to do");
  });
});
