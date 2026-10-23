import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { applyBundle, exportBundle, inspectBundle } from "./bundle.js";
import { emptySettings, SettingsStore } from "./settings.js";

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-bundle-"));
  folders.push(home);
  const store = new SettingsStore(home);
  await store.save(emptySettings());
  return { home, store, root: dirname(store.path) };
}

function zip(files: { path: string; content: string; linked?: boolean }[], compressed = false): string {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path);
    const raw = Buffer.from(file.content);
    const data = compressed ? deflateRawSync(raw) : raw;
    let crc = 0xffffffff;
    for (const byte of raw) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(compressed ? 8 : 0, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    locals.push(header, name, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(0x314, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(compressed ? 8 : 0, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    if (file.linked) entry.writeUInt32LE(0xa1ff0000, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]).toString("base64");
}

function archive(extra: { path: string; content: string; linked?: boolean }[] = [], prefix = "", compressed = false): string {
  return zip([
    { path: `${prefix}settings.json`, content: JSON.stringify(emptySettings()) },
    { path: `${prefix}AGENTS.md`, content: "Use careful reasoning." },
    ...extra,
  ], compressed);
}

describe("AFK workspace bundles", () => {
  it("exports portable files and imports only explicitly mapped destinations with inactive profiles", async () => {
    const source = await fixture();
    const settings = await source.store.read();
    settings.profiles.push({ id: "video", name: "Video", source: "repo", skills: ["render"], ready: true, enabled: ["Global"] });
    settings.managedLinks = { "/machine/skill": "/machine/source" };
    settings.independentSkills = { Global: ["render"] };
    settings.projects.push({ name: "Demo", path: "/old-machine/project" });
    settings.agentRules = { destinations: [{ id: "codex", name: "Codex", kind: "codex", path: "/old-machine/AGENTS.md" }], receipts: { codex: { region: "machine-owned region", references: {}, lastSync: new Date().toISOString() } } };
    await source.store.save(settings);
    await mkdir(join(source.root, "references"));
    await writeFile(join(source.root, "AGENTS.md"), "Read {{review.md}}.");
    await writeFile(join(source.root, "references/review.md"), "Review carefully.");
    const exported = await exportBundle(source.store);
    const inspected = inspectBundle(exported.base64);
    expect(inspected.files).toContainEqual({ path: "references/review.md", content: "Review carefully." });
    expect(inspected.settings.managedLinks).toEqual({});
    expect(inspected.settings.agentRules?.receipts).toEqual({});
    expect(inspected.settings.profiles[0]).toMatchObject({ ready: false, enabled: [] });
    const target = await fixture();
    await mkdir(join(target.root, "references"));
    await writeFile(join(target.root, "AGENTS.md"), "Old local rules.");
    await writeFile(join(target.root, "references/obsolete.md"), "Old managed reference.");
    await writeFile(join(target.root, "references/notes.txt"), "Unrelated file.");
    const destination = join(target.home, "agent/AGENTS.md");
    const projectPath = join(target.home, "new-project");
    await applyBundle(target.store, exported.base64, [{ id: "codex", path: destination }], [{ name: "Demo", path: projectPath }]);
    expect(await readFile(join(target.root, "AGENTS.md"), "utf8")).toBe("Read {{review.md}}.");
    expect(await readFile(join(target.root, "references/notes.txt"), "utf8")).toBe("Unrelated file.");
    expect(await readdir(join(target.root, "references"))).not.toContain("obsolete.md");
    const imported = await target.store.read();
    expect(imported.agentRules?.destinations[0]?.path).toBe(destination);
    expect(imported.agentRules?.receipts).toEqual({});
    expect(imported.projects).toEqual([{ name: "Demo", path: projectPath }]);
    await expect(readFile(destination)).rejects.toMatchObject({ code: "ENOENT" });
    const backups = await readdir(join(target.root, ".backups"));
    expect(backups).toHaveLength(1);
    const backup = inspectBundle((await readFile(join(target.root, ".backups", backups[0]!))).toString("base64"));
    expect(backup.files.find(file => file.path === "AGENTS.md")?.content).toBe("Old local rules.");
  });

  it("reads standard deflated ZIPs with a single folder wrapper", () => {
    const result = inspectBundle(archive([{ path: "afk/references/development.md", content: "Development notes." }], "afk/", true));
    expect(result.files.map(file => file.path)).toEqual(["AGENTS.md", "references/development.md"]);
  });

  it.each([
    ["traversal", "../escape.md", false],
    ["absolute path", "/AGENTS.md", false],
    ["duplicate file", "AGENTS.md", false],
    ["unrecognized file", "secret.txt", false],
    ["symlink", "references/linked.md", true],
  ])("rejects %s entries", (_label, path, linked) => {
    expect(() => inspectBundle(archive([{ path, content: "bad", linked }]))).toThrow();
  });

  it("rejects altered contents, missing references and invalid settings before overwriting local files", async () => {
    const { store, root } = await fixture();
    await writeFile(join(root, "AGENTS.md"), "Keep these rules.");
    const corrupted = Buffer.from(archive(), "base64");
    const location = corrupted.indexOf("Use careful reasoning.");
    corrupted[location] = "X".charCodeAt(0);
    await expect(applyBundle(store, corrupted.toString("base64"), [])).rejects.toThrow("checksum");
    const missing = zip([{ path: "settings.json", content: JSON.stringify(emptySettings()) }, { path: "AGENTS.md", content: "Read {{missing.md}}." }]);
    await expect(applyBundle(store, missing, [])).rejects.toThrow("Missing reference");
    const missingLink = zip([{ path: "settings.json", content: JSON.stringify(emptySettings()) }, { path: "AGENTS.md", content: "Read [development](references/missing.md)." }]);
    await expect(applyBundle(store, missingLink, [])).rejects.toThrow("Missing reference");
    const invalid = zip([{ path: "settings.json", content: JSON.stringify({ version: 99 }) }, { path: "AGENTS.md", content: "New rules." }]);
    await expect(applyBundle(store, invalid, [])).rejects.toThrow("Unsupported settings");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("Keep these rules.");
    await expect(readdir(join(root, ".backups"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects excessively expanding files", () => {
    expect(() => inspectBundle(archive([{ path: "references/bomb.md", content: "x".repeat(6 * 1024 * 1024) }], "", true))).toThrow("limit");
  });

  it("refuses to lose current skill activation or agent sync ownership", async () => {
    const { store } = await fixture();
    const settings = await store.read();
    settings.profiles.push({ id: "video", name: "Video", source: "repo", skills: ["render"], ready: true, enabled: ["Global"] });
    await store.save(settings);
    await expect(applyBundle(store, archive(), [])).rejects.toThrow("Disable managed skills");
    settings.profiles[0]!.enabled = [];
    settings.agentRules = { destinations: [{ id: "codex", name: "Codex", kind: "codex", path: "/agent/AGENTS.md" }], receipts: { codex: { region: "owned", references: {}, lastSync: new Date().toISOString() } } };
    await store.save(settings);
    await expect(applyBundle(store, archive(), [])).rejects.toThrow("disconnect synced rule destinations");
  });

  it("never writes through existing canonical symlinks", async () => {
    const { store, root, home } = await fixture();
    const external = join(home, "external.md");
    await writeFile(external, "Keep external content.");
    await symlink(external, join(root, "AGENTS.md"));
    await expect(applyBundle(store, archive(), [])).rejects.toThrow("symlink");
    expect(await readFile(external, "utf8")).toBe("Keep external content.");
  });

  it("rejects case-only reference renames before changing canonical files", async () => {
    const { store, root } = await fixture();
    await mkdir(join(root, "references"));
    await writeFile(join(root, "AGENTS.md"), "Original rules.");
    await writeFile(join(root, "references/FOO.md"), "Original reference.");
    const incoming = archive([{ path: "references/foo.md", content: "New reference." }]);
    await expect(applyBundle(store, incoming, [])).rejects.toThrow("only letter case");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("Original rules.");
    expect(await readFile(join(root, "references/FOO.md"), "utf8")).toBe("Original reference.");
    expect(await readdir(join(root, "references"))).toEqual(["FOO.md"]);
    await expect(readdir(join(root, ".backups"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves canonical rules and unrelated files when an incoming reference collides with a directory", async () => {
    const { store, root } = await fixture();
    await mkdir(join(root, "references/foo.md"), { recursive: true });
    await writeFile(join(root, "references/foo.md/notes.txt"), "Unrelated nested notes.");
    await writeFile(join(root, "AGENTS.md"), "Original rules.");
    const originalSettings = await readFile(store.path, "utf8");
    const incoming = archive([{ path: "references/foo.md", content: "New reference." }]);
    await expect(applyBundle(store, incoming, [])).rejects.toThrow("regular file");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("Original rules.");
    expect(await readFile(join(root, "references/foo.md/notes.txt"), "utf8")).toBe("Unrelated nested notes.");
    expect(await readFile(store.path, "utf8")).toBe(originalSettings);
    await expect(readdir(join(root, ".backups"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores all previous files when saving imported settings fails after canonical writes", async () => {
    const { store, root } = await fixture();
    await mkdir(join(root, "references"));
    await writeFile(join(root, "AGENTS.md"), "Original rules.");
    await writeFile(join(root, "references/old.md"), "Original reference.");
    await writeFile(join(root, "references/notes.txt"), "Unrelated notes.");
    const originalSettings = await readFile(store.path, "utf8");
    vi.spyOn(store, "save").mockImplementationOnce(async () => { throw new Error("Simulated settings save failure."); });
    await expect(applyBundle(store, archive([{ path: "references/new.md", content: "New reference." }]), [])).rejects.toThrow("Simulated settings save failure");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe("Original rules.");
    expect(await readFile(join(root, "references/old.md"), "utf8")).toBe("Original reference.");
    expect(await readFile(join(root, "references/notes.txt"), "utf8")).toBe("Unrelated notes.");
    await expect(readFile(join(root, "references/new.md"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(store.path, "utf8")).toBe(originalSettings);
  });
});
