import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import { containsControl, expandPath, SettingsStore, validateSettings, type Settings } from "./settings.js";
import { referenceErrors, validateRulesFiles } from "./rules.js";

const maximumBytes = 5 * 1024 * 1024;
const maximumEntries = 200;
type File = { path: string; content: string };
type Destination = NonNullable<Settings["agentRules"]>["destinations"][number];
export interface InspectedBundle { settings: Settings; files: File[]; destinations: Destination[] }

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function archivePath(path: string): boolean {
  return path.length > 0 && !containsControl(path) && !/[\\:]/.test(path) && !path.startsWith("/") && path.replace(/\/$/, "").split("/").every(part => part && part !== "." && part !== "..");
}

function canonicalPath(path: string): boolean {
  return path === "AGENTS.md" || /^references\/.+\.md$/i.test(path) && archivePath(path);
}

function encodeArchive(files: File[]): Buffer {
  const entries: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path);
    const data = Buffer.from(file.content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    entries.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, central, end]);
}

function decodeArchive(base64: string): File[] {
  if (typeof base64 !== "string" || base64.length > maximumBytes * 2 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error("Choose a valid AFK ZIP bundle under 5 MB.");
  const zip = Buffer.from(base64, "base64");
  if (zip.length < 22 || zip.length > maximumBytes) throw new Error("Choose a valid AFK ZIP bundle under 5 MB.");
  let end = zip.length - 22;
  const earliest = Math.max(0, end - 65535);
  while (end >= earliest && (zip.readUInt32LE(end) !== 0x06054b50 || end + 22 + zip.readUInt16LE(end + 20) !== zip.length)) end--;
  if (end < earliest) throw new Error("ZIP directory is missing.");
  const count = zip.readUInt16LE(end + 10);
  const directorySize = zip.readUInt32LE(end + 12);
  const directoryStart = zip.readUInt32LE(end + 16);
  if (zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6) || zip.readUInt16LE(end + 8) !== count || count > maximumEntries || directoryStart + directorySize !== end) throw new Error("Unsupported ZIP directory or too many files.");
  const files: File[] = [];
  const paths = new Set<string>();
  const ranges: { start: number; end: number }[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let cursor = directoryStart;
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP entry.");
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const crc = zip.readUInt32LE(cursor + 16);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const size = zip.readUInt32LE(cursor + 24);
    const nameSize = zip.readUInt16LE(cursor + 28);
    const extraSize = zip.readUInt16LE(cursor + 30);
    const commentSize = zip.readUInt16LE(cursor + 32);
    const unixType = (zip.readUInt32LE(cursor + 38) >>> 16) & 0xf000;
    const offset = zip.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameSize + extraSize + commentSize > end || flags & ~0x808 || ![0, 8].includes(method) || zip.readUInt16LE(cursor + 34) || unixType && unixType !== 0x8000 && unixType !== 0x4000) throw new Error("ZIP contains an unsupported, encrypted, or linked file.");
    const path = decoder.decode(zip.subarray(cursor + 46, cursor + 46 + nameSize));
    if (!archivePath(path) || paths.has(path)) throw new Error("ZIP contains duplicate or unsafe paths.");
    paths.add(path);
    cursor += 46 + nameSize + extraSize + commentSize;
    total += size;
    if (total > maximumBytes || size > maximumBytes || size > Math.max(1, compressedSize) * 1000) throw new Error("ZIP expands beyond the AFK bundle limit.");
    if (offset + 30 > directoryStart || zip.readUInt32LE(offset) !== 0x04034b50 || zip.readUInt16LE(offset + 6) !== flags || zip.readUInt16LE(offset + 8) !== method) throw new Error("Invalid ZIP local entry.");
    const localNameSize = zip.readUInt16LE(offset + 26);
    const dataStart = offset + 30 + localNameSize + zip.readUInt16LE(offset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > directoryStart || decoder.decode(zip.subarray(offset + 30, offset + 30 + localNameSize)) !== path || !(flags & 8) && (zip.readUInt32LE(offset + 14) !== crc || zip.readUInt32LE(offset + 18) !== compressedSize || zip.readUInt32LE(offset + 22) !== size)) throw new Error("ZIP entry metadata does not match.");
    if (ranges.some(range => offset < range.end && dataEnd > range.start)) throw new Error("ZIP entries overlap.");
    ranges.push({ start: offset, end: dataEnd });
    const compressed = zip.subarray(dataStart, dataEnd);
    const data = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, size) });
    if (data.length !== size || crc32(data) !== crc) throw new Error("ZIP file checksum does not match.");
    if (path.endsWith("/")) {
      if (size !== 0) throw new Error("ZIP directory contains data.");
      continue;
    }
    files.push({ path, content: decoder.decode(data) });
  }
  if (cursor !== end) throw new Error("ZIP directory has unexpected contents.");
  const rootSettings = files.some(file => file.path === "settings.json");
  const candidates = files.filter(file => file.path.endsWith("/settings.json"));
  const prefix = rootSettings ? "" : candidates.length === 1 ? candidates[0]!.path.slice(0, -"settings.json".length) : undefined;
  if (prefix === undefined || prefix.split("/").length > 2) throw new Error("Bundle needs settings.json at its root or inside one folder.");
  return files.map(file => {
    if (!file.path.startsWith(prefix)) throw new Error("ZIP contains files outside the AFK folder.");
    const path = file.path.slice(prefix.length);
    if (path !== "settings.json" && !canonicalPath(path)) throw new Error(`Unsupported bundle file: ${path}`);
    return { path, content: file.content };
  });
}

function validateReferences(files: File[]): void {
  const errors = referenceErrors(validateRulesFiles(files));
  if (errors.length) throw new Error(errors.join("\n"));
}

export function inspectBundle(base64: string): InspectedBundle {
  const archive = decodeArchive(base64);
  const settingsFile = archive.find(file => file.path === "settings.json");
  if (!settingsFile) throw new Error("Bundle needs settings.json.");
  const settings = validateSettings(JSON.parse(settingsFile.content));
  const files = archive.filter(file => file.path !== "settings.json");
  if (!files.some(file => file.path === "AGENTS.md")) throw new Error("Bundle needs AGENTS.md.");
  validateReferences(files);
  return { settings, files, destinations: settings.agentRules?.destinations ?? [] };
}

async function checkedPath(root: string, path: string): Promise<string> {
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`AFK bundle path crosses a symlink: ${path}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return current;
}

async function checkedImportFile(root: string, path: string): Promise<string> {
  let current = root;
  const parts = path.split("/");
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    try {
      const names = await readdir(current);
      if (names.some(name => name !== part && name.toLowerCase() === part.toLowerCase())) throw new Error(`Import would rename an existing path using only letter case: ${path}`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    current = join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`AFK bundle path crosses a symlink: ${path}`);
      const isFile = index === parts.length - 1;
      if (isFile ? !stat.isFile() : !stat.isDirectory()) throw new Error(`Import needs ${isFile ? "a regular file" : "a folder"} at ${path}. Existing contents are preserved.`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return current;
}

async function workspaceFiles(root: string): Promise<File[]> {
  const files: File[] = [];
  async function collect(path: string): Promise<void> {
    const absolute = await checkedPath(root, path);
    let stat;
    try { stat = await lstat(absolute); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    if (stat.isDirectory()) {
      for (const name of await readdir(absolute)) await collect(`${path}/${name}`);
    } else if (stat.isFile() && canonicalPath(path)) {
      if (stat.size > maximumBytes || files.length >= maximumEntries - 1) throw new Error("AFK folder exceeds the bundle limit.");
      files.push({ path, content: await readFile(absolute, "utf8") });
    }
  }
  await collect("AGENTS.md");
  await collect("references");
  return files;
}

function portableSettings(settings: Settings): Settings {
  const portable = structuredClone(settings);
  portable.profiles.forEach(profile => { profile.enabled = []; profile.ready = false; });
  portable.managedLinks = {};
  portable.independentSkills = {};
  if (portable.agentRules) portable.agentRules.receipts = {};
  return portable;
}

export async function exportBundle(store: SettingsStore): Promise<{ base64: string; name: string }> {
  const settings = portableSettings(await store.read());
  const files = await workspaceFiles(dirname(store.path));
  if (!files.some(file => file.path === "AGENTS.md")) files.unshift({ path: "AGENTS.md", content: "" });
  validateReferences(files);
  const archive = encodeArchive([{ path: "settings.json", content: `${JSON.stringify(settings, null, 2)}\n` }, ...files]);
  if (archive.length > maximumBytes) throw new Error("AFK folder exceeds the bundle limit.");
  return { base64: archive.toString("base64"), name: "afk-workspace.zip" };
}

export async function applyBundle(store: SettingsStore, base64: string, mappings: { id: string; path: string }[], projectMappings?: { name: string; path: string }[]): Promise<void> {
  const imported = inspectBundle(base64);
  const current = await store.read();
  if (current.profiles.some(profile => profile.enabled.length) || Object.keys(current.managedLinks).length || Object.values(current.independentSkills).some(skills => skills.length) || Object.keys(current.agentRules?.receipts ?? {}).length) throw new Error("Disable managed skills and disconnect synced rule destinations before replacing this AFK folder.");
  const settings = portableSettings(imported.settings);
  const ids = new Set(imported.destinations.map(destination => destination.id));
  if (!Array.isArray(mappings) || mappings.some(mapping => !mapping || !ids.has(mapping.id) || typeof mapping.path !== "string" || !mapping.path.trim() || containsControl(mapping.path) || extname(mapping.path).toLowerCase() !== ".md") || new Set(mappings.map(mapping => mapping.id)).size !== mappings.length) throw new Error("Choose valid destination mappings.");
  const mappedPaths = mappings.map(mapping => expandPath(mapping.path, store.home));
  if (new Set(mappedPaths).size !== mappedPaths.length || mappedPaths.some(path => { const distance = relative(dirname(store.path), path); return distance === "" || !distance.startsWith(`..${sep}`) && distance !== ".."; })) throw new Error("Rule destinations must be distinct files outside the AFK folder.");
  if (settings.agentRules) settings.agentRules.destinations = settings.agentRules.destinations.filter(destination => mappings.some(mapping => mapping.id === destination.id)).map(destination => ({ ...destination, path: expandPath(mappings.find(mapping => mapping.id === destination.id)!.path, store.home) }));
  if (projectMappings !== undefined) {
    const projectNames = new Set(settings.projects.map(project => project.name));
    if (!Array.isArray(projectMappings) || projectMappings.some(mapping => !mapping || !projectNames.has(mapping.name) || typeof mapping.path !== "string" || !mapping.path.trim() || containsControl(mapping.path)) || new Set(projectMappings.map(mapping => mapping.name)).size !== projectMappings.length) throw new Error("Choose valid project folder mappings.");
    settings.projects = settings.projects.map(project => {
      const mapping = projectMappings.find(candidate => candidate.name === project.name);
      return mapping ? { ...project, path: expandPath(mapping.path, store.home) } : project;
    });
  }
  validateSettings(settings);
  const root = dirname(store.path);
  const previous = await workspaceFiles(root);
  for (const file of imported.files) {
    if (previous.some(old => old.path !== file.path && old.path.toLowerCase() === file.path.toLowerCase())) throw new Error(`Import would rename an existing path using only letter case: ${file.path}`);
    await checkedImportFile(root, file.path);
  }
  await checkedImportFile(root, store.path.slice(root.length + 1));
  await checkedPath(root, ".backups");
  await mkdir(join(root, ".backups"), { recursive: true });
  const backup = encodeArchive([{ path: "settings.json", content: `${JSON.stringify(current, null, 2)}\n` }, ...previous]);
  await writeFile(join(root, ".backups", `import-${Date.now()}-${randomUUID()}.zip`), backup, { mode: 0o600 });
  const staged: { temporary: string; destination: string }[] = [];
  const written: string[] = [];
  try {
    for (const file of imported.files) {
      const destination = await checkedPath(root, file.path);
      await mkdir(dirname(destination), { recursive: true });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, file.content, { mode: 0o600, flag: "wx" });
      staged.push({ temporary, destination });
    }
    for (const file of staged) { await rename(file.temporary, file.destination); written.push(file.destination); }
    for (const file of previous) if (!imported.files.some(incoming => incoming.path === file.path)) await rm(await checkedPath(root, file.path));
    await store.save(settings);
  } catch (error) {
    const restored = await Promise.allSettled(previous.map(async file => writeFile(await checkedPath(root, file.path), file.content, { mode: 0o600 })));
    const cleaned = await Promise.allSettled(written.filter(path => !previous.some(old => join(root, old.path) === path)).map(async path => {
      const safe = await checkedPath(root, path.slice(root.length + 1));
      const stat = await lstat(safe);
      if (!stat.isFile()) throw new Error(`Import rollback preserved unexpected contents at ${safe}.`);
      await rm(safe);
    }));
    const saved = await Promise.allSettled([store.save(current)]);
    const failures = [...restored, ...cleaned, ...saved].filter(result => result.status === "rejected");
    if (failures.length) {
      const causes: unknown[] = [error];
      for (const failure of failures) causes.push(failure.reason as unknown);
      throw new AggregateError(causes, "Import failed; some files could not be restored. The original AFK folder backup is retained.");
    }
    throw error;
  } finally {
    await Promise.allSettled(staged.map(file => rm(file.temporary, { force: true })));
  }
}
