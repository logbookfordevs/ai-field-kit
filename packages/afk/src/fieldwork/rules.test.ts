import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { RULES_END, RULES_START, RulesWorkspace } from "./rules.js";

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-rules-")); folders.push(home);
  const store = new SettingsStore(home);
  const settings = emptySettings();
  await store.save(settings);
  const rules = new RulesWorkspace(store);
  await rules.saveFiles([{ path: "AGENTS.md", content: "Read {{guide.md}}\n" }, { path: "references/guide.md", content: "Development guidance\n" }]);
  const target = join(home, ".codex/AGENTS.md");
  return { home, store, settings, rules, target };
}

describe("Agent rules managed regions", () => {
  it("syncs new Claude destinations to AGENTS.md without touching an existing CLAUDE.md", async () => {
    const { home, settings, rules } = await fixture();
    const legacy = join(home, ".claude/CLAUDE.md");
    await mkdir(dirname(legacy), { recursive: true });
    await writeFile(legacy, "Existing Claude instructions\n");
    await rules.sync(settings, ["claude"]);
    expect(await readFile(join(home, ".claude/AGENTS.md"), "utf8")).toContain(RULES_START);
    expect(await readFile(legacy, "utf8")).toBe("Existing Claude instructions\n");
  });

  it("keeps an explicitly configured legacy Claude destination and its ownership", async () => {
    const { home, settings, rules, store } = await fixture();
    const legacy = join(home, ".claude/CLAUDE.md");
    await rules.saveDestination(settings, { id: "claude", name: "Claude", kind: "claude", path: legacy });
    await rules.sync(settings, ["claude"]);
    const persisted = await store.read();
    await rules.sync(persisted, ["claude"]);
    expect(await readFile(legacy, "utf8")).toContain(RULES_START);
    expect(persisted.agentRules?.receipts.claude).toBeDefined();
    await expect(readFile(join(home, ".claude/AGENTS.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves exact outside bytes and CRLF, copies references, and skips writes on a repeated sync", async () => {
    const { settings, rules, target } = await fixture();
    await mkdir(dirname(target), { recursive: true });
    const original = "# User rules\r\nDo this.\r\n";
    await writeFile(target, original);
    await rules.sync(settings, ["codex"]);
    const written = await readFile(target, "utf8");
    expect(written.startsWith(original)).toBe(true);
    expect(written).toContain(`${RULES_START}\r\n`);
    expect(written).toContain(join(dirname(target), "afk-rules/codex/references/guide.md"));
    const firstFiles = await readdir(dirname(target));
    await rules.sync(settings, ["codex"]);
    expect(await readdir(dirname(target))).toEqual(firstFiles);
    const suffix = "\r\nUser appendix with trailing spaces.  \r\n";
    await writeFile(target, written + suffix);
    await rules.saveFiles([{ path: "AGENTS.md", content: "Changed guidance" }]);
    await rules.sync(settings, ["codex"]);
    expect(await readFile(target, "utf8")).toBe(`${original}\r\n${RULES_START}\r\nChanged guidance\r\n${RULES_END}${suffix}`);
    await expect(readFile(join(dirname(target), "afk-rules/codex/references/guide.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("blocks missing nested references, while allowing saving a draft", async () => {
    const { rules, settings, target } = await fixture();
    await rules.saveFiles([{ path: "AGENTS.md", content: "{{guide.md}}" }, { path: "references/guide.md", content: "[missing](nested/missing.md)" }]);
    await expect(rules.sync(settings, ["codex"])).rejects.toThrow("Missing reference");
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("resolves tokens inside Markdown links and nested reference links", async () => {
    const { rules, settings, target } = await fixture();
    await rules.saveFiles([{ path: "AGENTS.md", content: "[Guide]({{guide.md}})" }, { path: "references/guide.md", content: "[nested](nested/info.md)" }, { path: "references/nested/info.md", content: "[parent](../guide.md)" }]);
    await rules.sync(settings, ["codex"]);
    const root = join(dirname(target), "afk-rules/codex/references");
    expect(await readFile(target, "utf8")).toContain(`[Guide](${join(root, "guide.md")})`);
    expect(await readFile(join(root, "nested/info.md"), "utf8")).toContain(join(root, "guide.md"));
  });

  it("requires exact reviewed state and preserves destination edits", async () => {
    const { rules, settings, target } = await fixture();
    await rules.sync(settings, ["codex"]);
    const preview = await rules.preview(settings, ["codex"]);
    await writeFile(target, (await readFile(target, "utf8")) + "\nNew user note.");
    await expect(rules.sync(settings, ["codex"], preview)).rejects.toThrow("changed after preview");
    expect(await readFile(target, "utf8")).toContain("New user note.");
  });

  it("does not claim existing regions, requires adoption, and then syncs adopted edits", async () => {
    const { rules, settings, target } = await fixture();
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `Existing\n${RULES_START}\nEdited in agent file\n${RULES_END}\nTail`);
    const preview = await rules.preview(settings, ["codex"]);
    expect(preview.targets[0]?.status).toBe("conflict");
    const adopted = await rules.adopt(settings, "codex");
    expect(adopted).toBe("Edited in agent file");
    await rules.saveFiles([{ path: "AGENTS.md", content: adopted }]);
    const synced = await rules.sync(settings, ["codex"]);
    expect(synced.preview.targets[0]?.status).toBe("current");
    expect(await readFile(target, "utf8")).toBe(`Existing\n${RULES_START}\nEdited in agent file\n${RULES_END}\nTail`);
  });

  it("refuses malformed markers and still syncs other selected destinations", async () => {
    const { rules, settings, target, home } = await fixture();
    await mkdir(dirname(target), { recursive: true });
    const broken = `${RULES_START}\nUnfinished region`;
    await writeFile(target, broken);
    const result = await rules.sync(settings, ["codex", "claude"]);
    expect(result.preview.targets[0]?.status).toBe("conflict");
    expect(result.preview.targets[1]?.status).toBe("current");
    expect(await readFile(target, "utf8")).toBe(broken);
    expect(await readFile(join(home, ".claude/AGENTS.md"), "utf8")).toContain(RULES_END);
    await expect(rules.overwrite(settings, "codex", "")).rejects.toThrow("markers are broken");
  });

  it("protects externally edited reference copies and supports explicit reviewed overwrite", async () => {
    const { rules, settings, target } = await fixture();
    await rules.sync(settings, ["codex"]);
    const reference = join(dirname(target), "afk-rules/codex/references/guide.md");
    await writeFile(reference, "External edit");
    const preview = await rules.preview(settings, ["codex"]);
    expect(preview.targets[0]?.reason).toContain("reference was changed");
    const result = await rules.sync(settings, ["codex"]);
    expect(result.preview.targets[0]?.status).toBe("conflict");
    expect(await readFile(reference, "utf8")).toBe("External edit");
    const accepted = await rules.overwrite(settings, "codex", preview.targets[0]!.currentRegion!, preview);
    expect(accepted.preview.targets[0]?.status).toBe("current");
    expect(await readFile(reference, "utf8")).toBe("Development guidance\n");
  });

  it("recreates an externally removed managed region only after explicit review", async () => {
    const { rules, settings, target } = await fixture();
    await rules.sync(settings, ["codex"]);
    await writeFile(target, "User removed the managed block.");
    const preview = await rules.preview(settings, ["codex"]);
    expect(preview.targets[0]?.status).toBe("conflict");
    const result = await rules.overwrite(settings, "codex", "", preview);
    expect(result.preview.targets[0]?.status).toBe("current");
    expect(await readFile(target, "utf8")).toContain(`User removed the managed block.\n\n${RULES_START}`);
  });

  it("never overwrites unrelated reference collisions even with overwrite consent", async () => {
    const { rules, settings, target } = await fixture();
    const reference = join(dirname(target), "afk-rules/codex/references/guide.md");
    await mkdir(dirname(reference), { recursive: true });
    await writeFile(reference, "User owned");
    await writeFile(target, `${RULES_START}\nOld rules\n${RULES_END}`);
    const preview = await rules.preview(settings, ["codex"]);
    const result = await rules.overwrite(settings, "codex", preview.targets[0]!.currentRegion!, preview);
    expect(result.preview.targets[0]?.status).toBe("conflict");
    expect(await readFile(reference, "utf8")).toBe("User owned");
  });

  it("disconnects only owned content and keeps unrelated files", async () => {
    const { rules, settings, target } = await fixture();
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "Keep this\n");
    await rules.sync(settings, ["codex"]);
    const unrelated = join(dirname(target), "afk-rules/user.md");
    await writeFile(unrelated, "Unrelated");
    await rules.disconnect(settings, "codex", true);
    expect(await readFile(target, "utf8")).toBe("Keep this\n\n");
    expect(await readFile(unrelated, "utf8")).toBe("Unrelated");
    expect(settings.agentRules?.destinations.some(d => d.id === "codex")).toBe(false);
  });

  it("restores rules and ownership when disconnect cannot save the settings receipt", async () => {
    const { rules, settings, target, store } = await fixture();
    await rules.sync(settings, ["codex"]);
    const original = await readFile(target, "utf8");
    const receipt = structuredClone(settings.agentRules);
    const fail = vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Settings disk is full"));
    await expect(rules.disconnect(settings, "codex", true)).rejects.toThrow("disk is full");
    fail.mockRestore();
    expect(await readFile(target, "utf8")).toBe(original);
    expect(settings.agentRules).toEqual(receipt);
    expect(await readFile(join(dirname(target), "afk-rules/codex/references/guide.md"), "utf8")).toBe("Development guidance\n");
    expect((await rules.preview(settings, ["codex"])).targets[0]?.status).toBe("current");
  });

  it("rolls back destination writes when saving first-sync ownership fails", async () => {
    const { rules, settings, target, store } = await fixture();
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "Original user rules");
    const fail = vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Settings disk is full"));
    await expect(rules.sync(settings, ["codex", "claude"])).rejects.toThrow("disk is full");
    fail.mockRestore();
    expect(await readFile(target, "utf8")).toBe("Original user rules");
    expect(settings.agentRules).toBeUndefined();
    await expect(readFile(join(dirname(target), "afk-rules/codex/references/guide.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.skipIf(process.getuid?.() === 0)("restores the managed region when a reference directory refuses cleanup", async () => {
    const { rules, settings, target } = await fixture();
    await rules.sync(settings, ["codex"]);
    const original = await readFile(target, "utf8");
    const references = join(dirname(target), "afk-rules/codex/references");
    await chmod(references, 0o500);
    try {
      await expect(rules.disconnect(settings, "codex", true)).rejects.toMatchObject({ code: "EACCES" });
      expect(await readFile(target, "utf8")).toBe(original);
      expect(settings.agentRules?.receipts.codex).toBeDefined();
    } finally { await chmod(references, 0o700); }
  });

  it("requires reload when canonical files changed outside the editor", async () => {
    const { rules, store } = await fixture();
    const state = await rules.state(await store.read());
    await writeFile(join(dirname(store.path), "AGENTS.md"), "External change");
    await expect(rules.saveFiles([{ path: "AGENTS.md", content: "Stale draft" }], state.filesHash)).rejects.toThrow("Reload before saving");
    expect(await readFile(join(dirname(store.path), "AGENTS.md"), "utf8")).toBe("External change");
  });

  it("rejects case-only renames and directory collisions without changing canonical files", async () => {
    const { rules, store } = await fixture();
    const root = dirname(store.path);
    await rules.saveFiles([{ path: "AGENTS.md", content: "Before" }, { path: "references/FOO.md", content: "Keep" }]);
    await expect(rules.saveFiles([{ path: "AGENTS.md", content: "After" }, { path: "references/foo.md", content: "Replacement" }])).rejects.toThrow("Case-only");
    expect(await readFile(join(root, "references/FOO.md"), "utf8")).toBe("Keep");
    await mkdir(join(root, "references/blocked.md"));
    await writeFile(join(root, "references/blocked.md/user.txt"), "Unrelated");
    await expect(rules.saveFiles([{ path: "AGENTS.md", content: "After" }, { path: "references/blocked.md", content: "Replacement" }])).rejects.toThrow("regular file");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("Before");
    expect(await readFile(join(root, "references/blocked.md/user.txt"), "utf8")).toBe("Unrelated");
  });

  it("rejects traversal, source aliases, symlink targets, and duplicate destination aliases", async () => {
    const { rules, settings, home, target, store } = await fixture();
    await expect(rules.saveFiles([{ path: "AGENTS.md", content: "x" }, { path: "references/../../escape.md", content: "x" }])).rejects.toThrow("Markdown files");
    await mkdir(dirname(target), { recursive: true });
    const outside = join(home, "outside.md"); await writeFile(outside, "User"); await symlink(outside, target);
    expect((await rules.preview(settings, ["codex"])).targets[0]?.status).toBe("conflict");
    const alias = join(home, "source-alias"); await symlink(dirname(store.path), alias);
    await expect(rules.saveDestination(settings, { id: "source", name: "Source", kind: "custom", path: join(alias, "AGENTS.md") })).rejects.toThrow("source folder");
    await rm(target); await writeFile(target, "User");
    const codexAlias = join(home, "codex-alias"); await symlink(dirname(target), codexAlias);
    await expect(rules.saveDestination(settings, { id: "duplicate", name: "Duplicate", kind: "custom", path: join(codexAlias, "AGENTS.md") })).rejects.toThrow("already uses");
    await expect(rules.saveDestination(settings, { id: "relative", name: "Relative", kind: "custom", path: "somewhere/AGENTS.md" })).rejects.toThrow("absolute");
  });

  it("keeps references isolated for two targets in the same directory", async () => {
    const { rules, settings, target } = await fixture();
    await rules.saveDestination(settings, { id: "other", name: "Other", kind: "custom", path: join(dirname(target), "OTHER.md") });
    const result = await rules.sync(settings, ["codex", "other"]);
    expect(result.preview.targets.map(target => target.status)).toEqual(["current", "current"]);
  });

  it("moves the complete canonical workspace without deleting the original or syncing targets", async () => {
    const { store, home, rules, target } = await fixture();
    const original = store.path;
    const destination = join(home, "Drive/afk/settings.json");
    await store.relocate(destination);
    expect(await readFile(join(dirname(destination), "AGENTS.md"), "utf8")).toContain("{{guide.md}}");
    expect(await readFile(join(dirname(destination), "references/guide.md"), "utf8")).toContain("Development guidance");
    expect(await readFile(original, "utf8")).toContain('"version"');
    expect((await rules.state(await store.read())).folder).toBe(dirname(destination));
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses workspace relocation reference symlinks and destination collisions before copying", async () => {
    const { store, home } = await fixture();
    const original = store.path;
    const newFolder = join(home, "Destination"); await mkdir(newFolder);
    await writeFile(join(newFolder, "AGENTS.md"), "User");
    await expect(store.relocate(join(newFolder, "settings.json"))).rejects.toThrow("already exists");
    expect(store.path).toBe(original);
    await rm(join(newFolder, "AGENTS.md"));
    await rm(join(dirname(original), "references"), { recursive: true });
    await symlink(newFolder, join(dirname(original), "references"));
    await expect(store.relocate(join(newFolder, "settings.json"))).rejects.toThrow("symbolic links");
    await expect(readFile(join(newFolder, "AGENTS.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
