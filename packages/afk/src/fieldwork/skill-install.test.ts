import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings.js";
import { installSkills, type InstallRunner, type InstallProgress } from "./skill-install.js";
import { SkillLibrary } from "./skills.js";
const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.map(home => rm(home, { recursive: true, force: true }))); homes.length = 0; });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-install-test-")); homes.push(home);
  const store = new SettingsStore(home); await store.initialize();
  return { home, store, settings: await store.read() };
}
it("replaces terminal spinner frames instead of accumulating them in installation output", async () => {
  const f = await fixture();
  const result = await installSkills(f.store, f.settings, [{ source: "owner/repo" }], "Global", "universal", "Test", () => {}, undefined, async (_cwd, _env, _args, output) => {
    output("Source ready\n");
    for (let i = 0; i < 30; i++) output(`\u001b[1G\u001b[2K${i % 2 ? "◒" : "◐"} Cloning repository…`);
    output("\u001b[1G\u001b[2KCloned repository\nWarning: retained\nWarning: retained\n");
    return 0;
  });
  expect(result.output).not.toContain("Cloning repository");
  expect(result.output).toContain("Source ready\nCloned repository\nWarning: retained\nWarning: retained\n");
});
it("installs selected source groups sequentially with literal arguments and an explicit agent", async () => {
  const f = await fixture(), calls: string[][] = [], progress: InstallProgress[] = [];
  const runner: InstallRunner = async (cwd, env, args, output) => {
    expect(cwd).toBe(f.home); expect(env.HOME).toBe(f.home); expect(env.XDG_STATE_HOME).toBe("");
    calls.push(args); output("installed\n"); return 0;
  };
  const result = await installSkills(f.store, f.settings, [{ source: "owner/repo'$(ignored)", skills: ["review"] }, { source: "owner/other" }], "Global", "claude-code", "Studio", value => progress.push(value), undefined, runner);
  expect(calls).toEqual([["owner/repo'$(ignored)", "--skill", "review", "-g", "--agent", "claude-code", "--yes"], ["owner/other", "--skill", "*", "-g", "--agent", "claude-code", "--yes"]]);
  expect(result).toMatchObject({ completed: 2, total: 2, code: 0, pending: false });
  expect(progress.some(value => value.pending && value.completed === 1)).toBe(true);
  expect(result.output).toContain("installed");
});
it("runs project installation in its configured directory without global flags", async () => {
  const f = await fixture(); f.settings.projects.push({ name: "Studio", path: "~/Demo Studio" });
  await installSkills(f.store, f.settings, [{ source: "owner/repo", skills: ["video"] }], "Studio", "universal", "Video", () => {}, undefined, async (cwd, _env, args) => {
    expect(cwd).toBe(join(f.home, "Demo Studio")); expect(args).not.toContain("-g"); expect(args).toContain("universal"); return 0;
  });
});
it("stops on a failed source and retains completed installations", async () => {
  const f = await fixture(); let calls = 0;
  const file = join(f.home, "completed");
  const result = await installSkills(f.store, f.settings, [{ source: "one" }, { source: "two" }, { source: "three" }], "Global", "codex", "Studio", () => {}, undefined, async () => {
    calls++; if (calls === 1) { await writeFile(file, "installed"); return 0; } return 7;
  });
  expect(calls).toBe(2); expect(result).toMatchObject({ completed: 1, code: 7, pending: false }); expect(await readFile(file, "utf8")).toBe("installed");
});
it("cancels the running source and never starts later groups", async () => {
  const f = await fixture(), controller = new AbortController(); let calls = 0;
  const result = await installSkills(f.store, f.settings, [{ source: "one" }, { source: "two" }], "Global", "codex", "Studio", () => {}, controller.signal, async (_cwd, _env, _args, _output, signal) => {
    calls++; expect(signal).toBe(controller.signal); controller.abort(); return 1;
  });
  expect(calls).toBe(1); expect(result).toMatchObject({ cancelled: true, code: 130, pending: false });
});
it("rejects interactive agents, missing project paths and malformed selections before execution", async () => {
  const f = await fixture(); const runner: InstallRunner = async () => { throw new Error("must not run"); };
  await expect(installSkills(f.store, f.settings, [{ source: "one" }], "Global", "interactive", "Studio", () => {}, undefined, runner)).rejects.toThrow(/explicit/);
  await expect(installSkills(f.store, f.settings, [{ source: "one" }], "Missing", "codex", "Studio", () => {}, undefined, runner)).rejects.toThrow(/configured project/);
  await expect(installSkills(f.store, f.settings, [{ source: "one", skills: [] }], "Global", "codex", "Studio", () => {}, undefined, runner)).rejects.toThrow(/valid sources/);
});

async function installFreshSkill(home: string, name: string): Promise<void> {
  const folder = join(home, ".agents/skills", name);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "SKILL.md"), `---\nname: ${name}\ndescription: Fresh copy from the source.\n---\n\nBody\n`);
}
it("restores saved invocation choices onto freshly installed skills", async () => {
  const f = await fixture();
  f.settings.preferences["Global|wizard"] = "Manual only";
  f.settings.preferences["Global|review"] = "Automatic allowed";
  const result = await installSkills(f.store, f.settings, [{ source: "owner/repo" }], "Global", "universal", "Sync this machine", () => {}, undefined, async () => {
    await installFreshSkill(f.home, "wizard"); await installFreshSkill(f.home, "review"); await installFreshSkill(f.home, "untouched");
    return 0;
  });
  const inventory = await new SkillLibrary(f.store).inventory(await f.store.read(), "Global");
  const invocation = (name: string) => inventory.find(entry => entry.name === name)?.invocation;
  expect(result).toMatchObject({ code: 0, phase: "Installation complete" });
  expect(invocation("wizard")).toEqual({ claude: "Manual only", codex: "Manual only" });
  expect(invocation("review")).toEqual({ claude: "Automatic allowed", codex: "Automatic allowed" });
  expect(result.output).toContain("wizard");
  expect(await readFile(join(f.home, ".agents/skills/untouched/SKILL.md"), "utf8")).not.toContain("disable-model-invocation");
  expect((await f.store.read()).preferences["Global|wizard"]).toBe("Manual only");
});
it("keeps a successful installation when a saved choice cannot be restored", async () => {
  const f = await fixture();
  f.settings.preferences["Global|broken"] = "Manual only";
  const result = await installSkills(f.store, f.settings, [{ source: "owner/repo" }], "Global", "universal", "Test", () => {}, undefined, async () => {
    const folder = join(f.home, ".agents/skills/broken");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "SKILL.md"), "no frontmatter here\n");
    return 0;
  });
  expect(result).toMatchObject({ code: 0, phase: "Installation complete" });
  expect(result.output).toMatch(/Could not restore.*broken/s);
});
