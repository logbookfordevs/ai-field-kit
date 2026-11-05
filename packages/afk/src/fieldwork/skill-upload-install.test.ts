import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./command-runner.js";
import { applyLibraryInit } from "./library-init.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { makeZip } from "./zip.test-helper.js";

let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;
let agents: string;
let claude: string;
let outside: string;

const skill = (name: string, body = "Body."): string => `---\nname: ${name}\ndescription: ${name} does things\n---\n${body}\n`;
const wizardZip = (body = "Body."): Buffer => makeZip([
  { path: "wizard/SKILL.md", data: skill("wizard", body), compress: true },
  { path: "wizard/scripts/run.sh", data: "#!/bin/sh\n", mode: 0o755 },
]);

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function git(...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd: join(home, ".afk/library"), env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" } });
  return result.output.trim();
}

const commits = async (): Promise<string[]> => (await git("log", "--format=%s")).split("\n").filter(Boolean);
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

type Source = "zip" | "skill" | "folder";
type Preview = { upload: string; candidates: { name: string; description: string; files: number; bytes: number; state: string }[] };

async function sourceFor(kind: Source, body = "Body."): Promise<Record<string, unknown>> {
  if (kind === "folder") {
    const folder = join(outside, `folder-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(folder, "wizard/scripts"), { recursive: true });
    await writeFile(join(folder, "wizard/SKILL.md"), skill("wizard", body));
    await writeFile(join(folder, "wizard/scripts/run.sh"), "#!/bin/sh\n", { mode: 0o755 });
    return { folder };
  }
  return { archive: wizardZip(body).toString("base64"), name: kind === "skill" ? "wizard.skill" : "wizard.zip" };
}

async function preview(kind: Source = "zip", body = "Body."): Promise<Preview> {
  return await operations.run("kit/upload-preview", await sourceFor(kind, body)) as Preview;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-upload-install-"));
  outside = await mkdtemp(join(tmpdir(), "afk-upload-source-"));
  store = new SettingsStore(home);
  await store.initialize();
  agents = join(home, ".agents/skills");
  claude = join(home, ".claude/skills");
  await mkdir(claude, { recursive: true });
  await store.save(emptySettings());
  await applyLibraryInit(store);
  operations = new FieldworkOperations(store);
  operations.installRunner = async () => { throw new Error("Uploads never run Skills CLI."); };
  vi.spyOn(SourcePreparation.prototype, "directory").mockRejectedValue(new Error("Uploads never download."));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await operations.close();
  await rm(home, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("previewing an upload", () => {
  it("lists what it found with its size and whether it is already installed", async () => {
    const found = await preview();

    expect(found.candidates).toMatchObject([{ name: "wizard", description: "wizard does things", files: 2, state: "new" }]);
    expect(found.candidates[0]?.bytes).toBe(skill("wizard").length + 10);
  });

  it("writes nothing to the library, the agent folders or the repository", async () => {
    const before = await commits();

    await preview();

    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect(await readdir(agents).catch(() => [])).toEqual([]);
  });

  it("rejects an unsafe archive with a reason and leaves the library as it was", async () => {
    const before = await commits();
    const archive = makeZip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/../../evil", data: "x" }]).toString("base64");

    await expect(operations.run("kit/upload-preview", { archive })).rejects.toThrow(/unsafe/i);
    await expect(operations.run("kit/upload-preview", { archive: makeZip([{ path: "notes.txt", data: "x" }]).toString("base64") })).rejects.toThrow(/No SKILL\.md/);

    expect(await commits()).toEqual(before);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("asks for exactly one kind of upload", async () => {
    await expect(operations.run("kit/upload-preview", {})).rejects.toThrow(/zip|folder/i);
    await expect(operations.run("kit/upload-preview", { archive: "AAAA", folder: outside })).rejects.toThrow(/one/i);
  });

  it("does not offer a skill that a tool installs", async () => {
    const settings = await store.read();
    settings.tools.push({ id: 1, name: "Waypoint", install: "true", update: "", provides: ["wizard"] });
    await store.save(settings);

    expect((await preview()).candidates[0]).toMatchObject({ name: "wizard", state: "tool" });
  });
});

describe.each(["zip", "skill", "folder"] as const)("installing from a %s", kind => {
  it("goes to Core as one commit with its files, record and Core entry, and is on", async () => {
    const before = await commits();
    const { upload } = await preview(kind);

    const result = await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "core" }) as { ok: boolean };

    expect(result.ok).toBe(true);
    const stored = join(home, ".afk/library/skills/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("wizard"));
    expect(await readFile(join(stored, "scripts/run.sh"), "utf8")).toBe("#!/bin/sh\n");
    expect(await json(join(home, ".afk/library/.afk/skills/wizard.json"))).toEqual({ invocation: "" });
    expect((await store.read()).kit?.core).toEqual([{ source: "Uploaded skill", skills: ["wizard"] }]);
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await readlink(join(claude, "wizard"))).toBe(stored);
    const after = await commits();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toBe("Install wizard");
    expect(await git("status", "--porcelain")).toBe("");
    expect(await git("ls-files", "skills/wizard", ".afk/skills/wizard.json")).toContain("skills/wizard/scripts/run.sh");
  });

  it("goes to a new pack saved in the library, off, and turns on without any download", async () => {
    const before = await commits();
    const { upload } = await preview(kind);

    const result = await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "new-pack", packName: "Helpers" }) as { ok: boolean; id: string };

    expect(result.ok).toBe(true);
    const stored = join(home, ".afk/library/skills/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("wizard"));
    const [pack] = (await store.read()).profiles;
    expect(pack).toMatchObject({ id: result.id, name: "Helpers", skills: ["wizard"], source: "Uploaded skill", ready: true, enabled: [] });
    expect((await store.read()).kit?.core).toEqual([]);
    expect(await present(join(agents, "wizard"))).toBe(false);
    expect((await commits()).length).toBe(before.length + 1);
    expect(await git("status", "--porcelain")).toBe("");

    await operations.run("activation", { id: result.id, scope: "Global", enabled: true });

    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await readlink(join(claude, "wizard"))).toBe(stored);
    expect(SourcePreparation.prototype.directory).not.toHaveBeenCalled();
  });

  it("stays on this machine only: stored outside the repository, linked, no commit", async () => {
    const before = await commits();
    const { upload } = await preview(kind);

    await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "machine" });

    const stored = join(home, ".afk/machine/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("wizard"));
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect((await store.read()).machineOnly).toContain("wizard");
    expect(await commits()).toEqual(before);
  });
});

describe("installing an upload into an existing pack", () => {
  it("adds the skill to a pack that is on and links it", async () => {
    await mkdir(join(home, ".afk/packs-cache/other"), { recursive: true });
    await writeFile(join(home, ".afk/packs-cache/other/SKILL.md"), skill("other"));
    const settings = await store.read();
    settings.profiles.push({ id: "profile-docs", name: "Docs", source: "owner/docs", skills: ["other"], enabled: [], ready: true });
    await store.save(settings);
    await operations.run("activation", { id: "profile-docs", scope: "Global", enabled: true });
    const { upload } = await preview();

    await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "profile-docs" });

    const [pack] = (await store.read()).profiles;
    expect(pack?.skills).toEqual(["other", "wizard"]);
    expect(pack?.groups).toEqual([{ source: "owner/docs", skills: ["other"] }, { source: "Uploaded skill", skills: ["wizard"] }]);
    expect(pack?.enabled).toEqual(["Global"]);
    expect(await readlink(join(agents, "wizard"))).toBe(join(home, ".afk/library/skills/wizard"));
  });
});

describe("what an upload cannot do", () => {
  it("is refused as a manifest export for a pack with an uploaded member, with the reason", async () => {
    const { upload } = await preview();
    const { id } = await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "new-pack", packName: "Helpers" }) as { id: string };

    await expect(operations.run("pack/manifest", { id })).rejects.toThrow(/uploaded.*(repository|publish)/i);
  });

  it("is refused for Core with an uploaded member too", async () => {
    const { upload } = await preview();
    await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "core" });

    await expect(operations.run("pack/manifest", { id: "core" })).rejects.toThrow(/uploaded/i);
  });

  it("is not installable by sync or offered as a repository install", async () => {
    const { upload } = await preview();
    await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "core" });
    await rm(join(home, ".afk/library/skills/wizard"), { recursive: true });

    const state = await operations.run("kit/state") as { plan: { install: unknown[] }; core: { name: string; status: string }[] };

    expect(state.core).toMatchObject([{ name: "wizard", status: "missing" }]);
    expect(state.plan.install).toEqual([]);
  });

  it("is never updated automatically, because it has no source", async () => {
    const { upload } = await preview();
    await operations.run("kit/upload-install", { upload, names: ["wizard"], to: "core" });
    const before = await commits();

    await expect(operations.run("skills/update", { scope: "Global", names: ["wizard"] })).resolves.toMatchObject({ code: 1, output: expect.stringMatching(/no recorded source/i) });
    await expect(operations.run("skills/update", { scope: "Global" })).resolves.toMatchObject({ code: 1, output: expect.stringMatching(/no stored skill has a recorded source/i) });

    expect(await commits()).toEqual(before);
    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toBe(skill("wizard"));
  });

  it("refuses Try later, which is for repositories only", async () => {
    const { upload } = await preview();

    await expect(operations.run("kit/upload-install", { upload, names: ["wizard"], to: "later" })).rejects.toThrow(/Core|pack|machine/i);
  });

  it("asks before replacing a skill that is already installed", async () => {
    const first = await preview();
    await operations.run("kit/upload-install", { upload: first.upload, names: ["wizard"], to: "core" });
    const before = await commits();
    const again = await preview("zip", "Second version.");
    expect(again.candidates[0]?.state).toBe("installed");

    await expect(operations.run("kit/upload-install", { upload: again.upload, names: ["wizard"], to: "core" })).rejects.toThrow(/replace/i);
    expect(await commits()).toEqual(before);

    await operations.run("kit/upload-install", { upload: again.upload, names: ["wizard"], to: "core", replace: ["wizard"] });

    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toContain("Second version.");
    expect((await commits())[0]).toBe("Reinstall wizard");
  });

  it("refuses a skill that the upload did not contain, and an expired upload", async () => {
    const { upload } = await preview();

    await expect(operations.run("kit/upload-install", { upload, names: ["ghost"], to: "core" })).rejects.toThrow(/not in this upload/i);
    await expect(operations.run("kit/upload-install", { upload: "missing", names: ["wizard"], to: "core" })).rejects.toThrow(/upload/i);
  });

  it("leaves the library as it was when the pack cannot be saved", async () => {
    const before = await commits();
    const { upload } = await preview();

    await expect(operations.run("kit/upload-install", { upload, names: ["wizard"], to: "new-pack" })).rejects.toThrow(/Name the new pack/);

    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
  });

  it("needs the AFK library to exist first", async () => {
    const fresh = await mkdtemp(join(tmpdir(), "afk-upload-fresh-"));
    try {
      const bare = new FieldworkOperations(new SettingsStore(fresh));
      try {
        const { upload } = await bare.run("kit/upload-preview", { archive: wizardZip().toString("base64") }) as Preview;
        await expect(bare.run("kit/upload-install", { upload, names: ["wizard"], to: "core" })).rejects.toThrow(/library/i);
      } finally { await bare.close(); }
    } finally { await rm(fresh, { recursive: true, force: true }); }
  });
});
