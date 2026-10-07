import { afterEach, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { updateSkills, type UpdateRunner } from "./skill-update.js";
const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.map(home => rm(home, { recursive: true, force: true }))); homes.length = 0; });
const text = (version: string): string => `---\nname: sample\ndescription: Fixture\n---\n${version}\n`;
async function fixture(project = false) {
  const home = await mkdtemp(join(tmpdir(), "afk-update-test-")); homes.push(home);
  const store = new SettingsStore(home); await store.initialize(); const settings = await store.read();
  const scope = project ? "Project" : "Global";
  if (project) settings.projects.push({ name: scope, path: join(home, "project") });
  await store.save(settings);
  const root = new SkillLibrary(store).root(settings, scope), path = join(root, ".disabled/sample");
  await mkdir(path, { recursive: true }); await writeFile(join(path, "SKILL.md"), text("old"));
  const receipt = project ? join(root, "../../skills-lock.json") : join(home, ".agents/.skill-lock.json");
  await writeFile(receipt, JSON.stringify({ version: 3, skills: { sample: { source: "fixture" } } }));
  return { home, store, settings, scope, root, path, receipt };
}
function runner(project = false, code = 0): UpdateRunner {
  return async (cwd, env, args, output) => {
    expect(args).toEqual([project ? "-p" : "-g", "-y"]);
    const root = join(project ? cwd : env.HOME!, ".agents/skills");
    await writeFile(join(root, "sample/SKILL.md"), text("new")); output("Updated sample\n"); return code;
  };
}
it("retains update errors without accumulating terminal progress redraws", async () => {
  const f = await fixture();
  const result = await updateSkills(f.store, f.settings, f.scope, () => {}, async (_cwd, _env, _args, output) => {
    output("Checking skills\n◐ Downloading");
    output("\r\u001b[2K◒ Downloading");
    output("\r\u001b[2KDownload failed\nError: connection lost\n");
    return 1;
  });
  expect(result.output).toBe("Checking skills\nDownload failed\nError: connection lost\n");
  expect(result.code).toBe(1);
});
it("updates disabled storage without exposing it through the shared Claude folder", async () => {
  const f = await fixture(); await mkdir(join(f.home, ".claude")); await symlink(f.root, join(f.home, ".claude/skills"));
  const result = await updateSkills(f.store, f.settings, f.scope, () => {}, runner());
  expect(result).toMatchObject({ code: 0, updated: 1, pending: false });
  expect(await readFile(join(f.path, "SKILL.md"), "utf8")).toContain("new");
  await expect(readFile(join(f.root, "sample/SKILL.md"))).rejects.toThrow();
  await expect(readFile(join(f.home, ".claude/skills/sample/SKILL.md"))).rejects.toThrow();
});
it("keeps existing availability links and native invocation preferences", async () => {
  const f = await fixture(); await new SkillLibrary(f.store).toggle(f.settings, "sample", f.scope);
  await setInvocation(f.store, f.settings, "sample", f.scope, "Manual only");
  await updateSkills(f.store, f.settings, f.scope, () => {}, runner());
  const [entry] = await new SkillLibrary(f.store).inventory(f.settings, f.scope);
  expect(entry).toMatchObject({ available: true, invocation: { claude: "Manual only", codex: "Manual only" } });
  expect(await readFile(join(f.root, "sample/SKILL.md"), "utf8")).toContain("new");
});
it("preserves originals and receipts after an upstream failure", async () => {
  const f = await fixture(), receipt = await readFile(f.receipt, "utf8");
  expect(await updateSkills(f.store, f.settings, f.scope, () => {}, runner(false, 1))).toMatchObject({ code: 1 });
  expect(await readFile(join(f.path, "SKILL.md"), "utf8")).toContain("old");
  expect(await readFile(f.receipt, "utf8")).toBe(receipt);
});
it("updates project disabled storage with its project receipt", async () => {
  const f = await fixture(true);
  expect(await updateSkills(f.store, f.settings, f.scope, () => {}, runner(true))).toMatchObject({ updated: 1 });
  expect(await readFile(join(f.path, "SKILL.md"), "utf8")).toContain("new");
  await expect(readFile(join(f.root, "sample/SKILL.md"))).rejects.toThrow();
});
it("rejects intervening edits before replacing any originals", async () => {
  const f = await fixture();
  await expect(updateSkills(f.store, f.settings, f.scope, () => {}, async (...args) => {
    await runner()(...args); await writeFile(join(f.path, "SKILL.md"), text("user edit")); return 0;
  })).rejects.toThrow("changed during");
  expect(await readFile(join(f.path, "SKILL.md"), "utf8")).toContain("user edit");
});
it("leaves unchanged skills untouched", async () => {
  const f = await fixture();
  expect(await updateSkills(f.store, f.settings, f.scope, () => {}, async () => 0)).toMatchObject({ updated: 0, code: 0 });
});

it("cancels a running staged update without changing originals or receipts", async () => {
  const f = await fixture(), controller = new AbortController(), receipt = await readFile(f.receipt, "utf8");
  const result = await updateSkills(f.store, f.settings, f.scope, () => {}, async (...args) => {
    await runner()(...args); controller.abort(); return 0;
  }, controller.signal);
  expect(result).toMatchObject({ code: 130, cancelled: true, pending: false });
  expect(await readFile(join(f.path, "SKILL.md"), "utf8")).toContain("old");
  expect(await readFile(f.receipt, "utf8")).toBe(receipt);
});
it("stops before starting Skills CLI when already cancelled", async () => {
  const f = await fixture(), controller = new AbortController(); controller.abort();
  let called = false;
  const result = await updateSkills(f.store, f.settings, f.scope, () => {}, async () => { called = true; return 0; }, controller.signal);
  expect(result.cancelled).toBe(true); expect(called).toBe(false);
});

it("updates only the requested skill and keeps other copies and receipts intact", async () => {
  const f = await fixture();
  const other = join(f.root, ".disabled/other"); await mkdir(other); await writeFile(join(other, "SKILL.md"), text("other old"));
  const original = JSON.parse(await readFile(f.receipt, "utf8")); original.skills.other = { source: "other-source" }; await writeFile(f.receipt, JSON.stringify(original));
  const result = await updateSkills(f.store, f.settings, f.scope, () => {}, async (cwd, env, args) => {
    expect(args).toEqual(["sample", "-g", "-y"]);
    const stage = join(env.HOME!, ".agents");
    expect(JSON.parse(await readFile(join(stage, ".skill-lock.json"), "utf8")).skills.other).toBeUndefined();
    await writeFile(join(stage, "skills/sample/SKILL.md"), text("new")); return 0;
  }, undefined, ["sample"]);
  expect(result.updated).toBe(1);
  expect(await readFile(join(other, "SKILL.md"), "utf8")).toContain("other old");
  expect(JSON.parse(await readFile(f.receipt, "utf8")).skills.other).toEqual(original.skills.other);
});
it("reports missing tracking metadata for a requested skill instead of pretending it updated", async () => {
  const f = await fixture(); await writeFile(f.receipt, JSON.stringify({ skills: {} }));
  await expect(updateSkills(f.store, f.settings, f.scope, () => {}, runner(), undefined, ["sample"])).rejects.toThrow("no Skills CLI update receipt");
});
