import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";
import { isSkillPostInstall, loadSkillManifest, localManifestDir, type SkillManifestItem } from "../manifest.js";
import { validateEditableManifest } from "../manifest-editor.js";
import { runArea } from "../setup.js";
import type { CliOptions, Runtime } from "../types.js";
import { runSkillsCommand } from "./commands.js";
import { runSkillInstalls, runSkillPostInstall } from "./post-install.js";

const roots: string[] = [];
beforeEach(() => vi.stubEnv("CODEX_HOME", ""));
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "afk-post-install-"));
  roots.push(root);
  const options: CliOptions = {
    homeDir: join(root, "home"), cwd: join(root, "project"), repoDir: root,
    agents: ["codex"], selectedSkillAgentIds: [], selectedSkillIds: ["design"],
    setupScope: "global", scopeExplicit: true, dryRun: false, verbose: false, yes: true,
    allSkills: false, skillAddArgs: [], skillAddProfileIds: [], skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false, selectedMcpIds: [], selectedToolIds: [], selectedHookIds: [],
    rulesRef: "main", rulesSource: "local", initOnly: false, empty: false, refreshDefaults: false,
    defaultsSource: "", defaultsSourceExplicit: false, defaultSourceUpdate: "", manifestLocal: false,
    manifestConfigureLocal: false, manifestConfigureFromCurrent: false, manifestShowReact: false,
    manifestShowVisualize: false, selectedManifestCategories: [], setupManifestsPrepared: true,
  };
  const item: SkillManifestItem = {
    id: "design", label: "Design", source: "https://github.com/example/design", args: ["--skill", "design"],
    default: true, postInstall: [{ type: "copy", agent: "codex", from: "agents", to: "agents", extension: ".toml" }],
  };
  const output: string[] = [];
  const runtime: Runtime = { io: { stdout: (message) => output.push(message), stderr: (message) => output.push(message) }, spawn: vi.fn(async () => ({ code: 0 })) };
  const skillDir = join(options.homeDir, ".agents", "skills", "design");
  const target = join(options.homeDir, ".codex", "agents", "designer.toml");
  const install = (directory = skillDir, content = "name = 'designer'\n") => {
    write(join(directory, "SKILL.md"), "---\nname: design\ndescription: Design\n---\nDesign skill.\n");
    write(join(directory, "agents", "designer.toml"), content);
    write(join(directory, "agents", "openai.yaml"), "display_name: Design\n");
  };
  const saveCatalog = (items = [item]) => {
    write(join(localManifestDir(options.homeDir), "skills.json"), JSON.stringify({ version: 1, defaultSource: "", items }));
  };
  saveCatalog();
  return { root, options, item, runtime, output, skillDir, target, install, saveCatalog };
}

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

test("copies only matching files, refreshes managed copies, and preserves user edits", async () => {
  const f = fixture();
  f.install();
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.equal(readFileSync(f.target, "utf8"), "name = 'designer'\n");
  assert.equal(existsSync(join(dirname(f.target), "openai.yaml")), false);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.match(f.output.join("\n"), /0 copied; 1 unchanged/);
  f.install(f.skillDir, "name = 'new designer'\n");
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.equal(readFileSync(f.target, "utf8"), "name = 'new designer'\n");
  write(f.target, "my custom agent");
  f.install(f.skillDir, "next upstream version");
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.equal(readFileSync(f.target, "utf8"), "my custom agent");
  assert.match(f.output.join("\n"), /skill installed; post-install action failed.*Preserved conflicting file/);
});

test("preflights conflicts before copying any file and preserves destination symlinks", async () => {
  const f = fixture();
  f.install();
  write(join(f.skillDir, "agents", "a.toml"), "new agent");
  write(f.target, "existing user agent");
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.equal(existsSync(join(dirname(f.target), "a.toml")), false);
  rmSync(f.target);
  const outside = join(f.root, "outside.toml");
  write(outside, "outside");
  symlinkSync(outside, f.target);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.equal(readFileSync(outside, "utf8"), "outside");
});

test("accepts exact-source links, preserves them across updates, and copies missing agents", async () => {
  const f = fixture();
  f.install();
  write(join(f.skillDir, "agents", "missing.toml"), "missing agent");
  mkdirSync(dirname(f.target), { recursive: true });
  const source = join(f.skillDir, "agents", "designer.toml");
  symlinkSync(source, f.target);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.equal(readlinkSync(f.target), source);
  assert.equal(readFileSync(join(dirname(f.target), "missing.toml"), "utf8"), "missing agent");
  f.install(f.skillDir, "updated agent");
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.ok(lstatSync(f.target).isSymbolicLink());
  assert.equal(readFileSync(f.target, "utf8"), "updated agent");
  const receipts = readFileSync(join(f.options.homeDir, ".agents", "afk", "skill-post-install.json"), "utf8");
  assert.equal(receipts.includes("designer.toml"), false);
});

test("rejects unrelated links even with identical content, dangling links, and parent-directory links", async () => {
  const f = fixture();
  f.install();
  mkdirSync(dirname(f.target), { recursive: true });
  const outside = join(f.root, "outside.toml");
  write(outside, readFileSync(join(f.skillDir, "agents", "designer.toml"), "utf8"));
  symlinkSync(outside, f.target);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  rmSync(outside);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.ok(lstatSync(f.target).isSymbolicLink());
  rmSync(dirname(f.target), { recursive: true });
  symlinkSync(join(f.skillDir, "agents"), dirname(f.target));
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
});

test("dry run describes actions without installed source, filesystem writes, or spawning", async () => {
  const f = fixture();
  f.item.postInstall?.push({ type: "command", command: "node", args: ["scripts/setup.mjs", "${SKILL_DIR}"] });
  assert.deepEqual(await runSkillInstalls(f.runtime, { ...f.options, dryRun: true, manifestContents: { "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [f.item] }) } }), { installCode: 0, postInstallCode: 0 });
  assert.match(f.output.join("\n"), /agents\/\*\.toml →/);
  assert.match(f.output.join("\n"), /scripts\/setup.mjs/);
  assert.equal(existsSync(f.skillDir), false);
  assert.equal(existsSync(dirname(f.target)), false);
  assert.equal(existsSync(join(f.options.homeDir, ".agents", "afk", "skill-post-install.json")), false);
  assert.equal(vi.mocked(f.runtime.spawn).mock.calls.length, 0);
});

test("missing source fails visibly and absent harness skips without touching its directory", async () => {
  const f = fixture();
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.match(f.output.join("\n"), /Installed skill not found/);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], { ...f.options, agents: [] }), 0);
  assert.equal(existsSync(dirname(f.target)), false);
  f.install();
  mkdirSync(join(f.options.homeDir, ".codex"), { recursive: true });
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], { ...f.options, agents: [] }), 0);
  assert.ok(existsSync(f.target));
});

test("respects project scope and global CODEX_HOME", async () => {
  const f = fixture();
  const customHome = join(f.root, "custom codex");
  vi.stubEnv("CODEX_HOME", customHome);
  f.install();
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  assert.ok(existsSync(join(customHome, "agents", "designer.toml")));
  assert.equal(existsSync(f.target), false);
  const projectSkill = join(f.options.cwd, ".agents", "skills", "design");
  f.install(projectSkill, "project version");
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], { ...f.options, setupScope: "project" }), 0);
  assert.equal(readFileSync(join(f.options.cwd, ".codex", "agents", "designer.toml"), "utf8"), "project version");
  assert.equal(readFileSync(join(customHome, "agents", "designer.toml"), "utf8"), "name = 'designer'\n");
});

test("explicit harness selections take precedence over detection", async () => {
  const f = fixture();
  f.install();
  mkdirSync(join(f.options.homeDir, ".codex"), { recursive: true });
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], { ...f.options, agents: ["claude"] }), 0);
  assert.equal(existsSync(f.target), false);
  assert.match(f.output.join("\n"), /skipped/);
});

test("empty payloads and corrupt receipts fail without copying", async () => {
  const f = fixture();
  f.install();
  rmSync(join(f.skillDir, "agents", "designer.toml"));
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.match(f.output.join("\n"), /No matching files/);
  f.install();
  write(join(f.options.homeDir, ".agents", "afk", "skill-post-install.json"), '{"version":1,"files":"broken"}');
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.equal(existsSync(f.target), false);
});

test("skill symlinks work but a copy source symlink cannot escape the installed skill", async () => {
  const f = fixture();
  const realSkill = join(f.root, "linked skill");
  f.install(realSkill);
  mkdirSync(dirname(f.skillDir), { recursive: true });
  symlinkSync(realSkill, f.skillDir);
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 0);
  rmSync(join(realSkill, "agents"), { recursive: true });
  const outside = join(f.root, "outside");
  write(join(outside, "private.toml"), "private");
  symlinkSync(outside, join(realSkill, "agents"));
  assert.equal(await runSkillPostInstall(f.runtime, [f.item], f.options), 1);
  assert.equal(existsSync(join(dirname(f.target), "private.toml")), false);
});

test("source installs gate actions, and commands receive the skill cwd and expanded arguments", async () => {
  const f = fixture();
  f.item.postInstall = [{ type: "command", agent: "codex", command: "node", args: ["setup.mjs", "${SKILL_DIR}", "${AGENT_DIR}"] }];
  f.saveCatalog();
  vi.mocked(f.runtime.spawn).mockResolvedValueOnce({ code: 7 });
  assert.deepEqual(await runSkillInstalls(f.runtime, f.options), { installCode: 7, postInstallCode: 0 });
  assert.equal(vi.mocked(f.runtime.spawn).mock.calls.length, 1);
  vi.mocked(f.runtime.spawn).mockImplementation(async (command, _args, cwd) => {
    if (command === "npx") f.install();
    else {
      assert.equal(cwd, f.skillDir);
      return { code: 8 };
    }
    return { code: 0 };
  });
  assert.deepEqual(await runSkillInstalls(f.runtime, f.options), { installCode: 0, postInstallCode: 1 });
  assert.deepEqual(vi.mocked(f.runtime.spawn).mock.calls.at(-1)?.slice(0, 3), ["node", ["setup.mjs", f.skillDir, join(f.options.homeDir, ".codex")], f.skillDir]);
});

test("setup reports post-install failure while retaining successful skill storage policy", async () => {
  const f = fixture();
  f.item.startDisabled = true;
  f.saveCatalog();
  vi.mocked(f.runtime.spawn).mockImplementation(async () => { f.install(); return { code: 0 }; });
  write(f.target, "user content");
  assert.equal(await runArea("skills", f.runtime, f.options), 1);
  assert.ok(existsSync(join(f.options.homeDir, ".agents", "skills", ".disabled", "design", "SKILL.md")));
  assert.equal(readFileSync(f.target, "utf8"), "user content");
});

test("profile installs run catalog-owned actions", async () => {
  const f = fixture();
  write(join(localManifestDir(f.options.homeDir), "profiles.json"), JSON.stringify({ version: 2, alwaysOn: [], items: [{ id: "design-profile", name: "Design Profile", catalogSkills: ["design"], packages: [] }] }));
  vi.mocked(f.runtime.spawn).mockImplementation(async () => { f.install(); return { code: 0 }; });
  assert.equal(await runArea("profiles", f.runtime, { ...f.options, selectedSkillProfileIds: ["design-profile"] }), 0);
  assert.ok(existsSync(f.target));
});

test("skills add runs existing catalog hooks for newly locked skills", async () => {
  const f = fixture();
  vi.mocked(f.runtime.spawn).mockImplementation(async () => {
    f.install();
    write(join(f.options.homeDir, ".agents", ".skill-lock.json"), JSON.stringify({ version: 3, skills: {
      design: { source: "example/design", sourceType: "github", skillPath: "skills/design/SKILL.md", updatedAt: "2026-09-07" },
    } }));
    return { code: 0 };
  });
  assert.equal(await runSkillsCommand(["skills", "add", "example/design", "--agent", "codex"], f.runtime, { ...f.options, agents: [] }), 0);
  assert.ok(existsSync(f.target));
});

test("updates refresh copies and restore disabled storage; failed updates do not run actions", async () => {
  const f = fixture();
  f.install();
  await runSkillPostInstall(f.runtime, [f.item], f.options);
  const disabled = join(dirname(f.skillDir), ".disabled", "design");
  mkdirSync(dirname(disabled), { recursive: true });
  renameSync(f.skillDir, disabled);
  vi.mocked(f.runtime.spawn).mockImplementation(async () => { f.install(f.skillDir, "updated"); return { code: 0 }; });
  assert.equal(await runSkillsCommand(["skills", "update", "design"], f.runtime, f.options), 0);
  assert.equal(readFileSync(f.target, "utf8"), "updated");
  assert.ok(existsSync(join(disabled, "SKILL.md")));
  assert.equal(existsSync(f.skillDir), false);
  vi.mocked(f.runtime.spawn).mockImplementation(async () => { f.install(f.skillDir, "failed update"); return { code: 4 }; });
  assert.equal(await runSkillsCommand(["skills", "update", "design"], f.runtime, f.options), 4);
  assert.equal(readFileSync(f.target, "utf8"), "updated");
});

test("update dry run previews actions without spawning or changing copies", async () => {
  const f = fixture();
  assert.equal(await runSkillsCommand(["skills", "update", "design"], f.runtime, { ...f.options, dryRun: true }), 0);
  assert.equal(vi.mocked(f.runtime.spawn).mock.calls.length, 0);
  assert.equal(existsSync(f.target), false);
  assert.match(f.output.join("\n"), /Preview only/);
});

test("catalog validation rejects malformed actions and whole-source hooks in both read and edit paths", () => {
  const f = fixture();
  assert.ok(isSkillPostInstall(f.item.postInstall, f.item.args));
  assert.equal(isSkillPostInstall(f.item.postInstall, []), false);
  assert.equal(isSkillPostInstall(f.item.postInstall, ["--skill", "design", "--skill", "another"]), false);
  for (const action of [
    { type: "copy", agent: "codex", from: "../secrets", to: "agents" },
    { type: "copy", agent: "codex", from: "agents", to: "/absolute" },
    { type: "copy", agent: "unknown", from: "agents", to: "agents" },
    { type: "command", command: "", args: [] },
    { type: "command", command: "node", args: "setup.mjs" },
  ]) {
    const manifest = { version: 1, defaultSource: "", items: [{ ...f.item, postInstall: [action] }] };
    assert.ok(validateEditableManifest("skills", manifest).length > 0);
    assert.throws(() => loadSkillManifest({ ...f.options, manifestContents: { "skills.json": JSON.stringify(manifest) } }));
  }
});
