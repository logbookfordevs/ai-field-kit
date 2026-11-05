import { chmod, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { parse } from "yaml";
import { containsControl, sameSkillName, skillName } from "./settings.js";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 2000;

export type UploadSource =
  | { archive: Buffer }
  | { files: { path: string; data: Buffer; executable?: boolean }[] }
  | { folder: string };

export interface UploadedSkill {
  name: string;
  description: string;
  files: number;
  bytes: number;
  path: string;
}

interface Entry { path: string; data: Buffer; executable: boolean }

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

const tooLarge = (): Error => new Error(`The upload is too large. Skills can total at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
const tooMany = (): Error => new Error(`The upload has too many files. Skills can hold at most ${MAX_UPLOAD_FILES}.`);

function safePath(path: string): boolean {
  return path.length > 0 && !containsControl(path) && !/[\\:]/.test(path) && !path.startsWith("/")
    && path.replace(/\/$/, "").split("/").every(part => part && part !== "." && part !== "..");
}

function clutter(path: string): boolean {
  return path.split("/").some(part => part === "__MACOSX" || part === ".git" || part === ".DS_Store" || part.startsWith(".afk-"));
}

function readArchive(zip: Buffer): Entry[] {
  const notZip = new Error("That file is not a valid ZIP archive.");
  if (zip.length > MAX_UPLOAD_BYTES) throw tooLarge();
  if (zip.length < 22) throw notZip;
  let end = zip.length - 22;
  const earliest = Math.max(0, end - 65535);
  while (end >= earliest && (zip.readUInt32LE(end) !== 0x06054b50 || end + 22 + zip.readUInt16LE(end + 20) !== zip.length)) end--;
  if (end < earliest) throw notZip;
  const count = zip.readUInt16LE(end + 10);
  const directoryStart = zip.readUInt32LE(end + 16);
  if (zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6) || zip.readUInt16LE(end + 8) !== count || directoryStart + zip.readUInt32LE(end + 12) !== end) throw new Error("This ZIP archive is split or its directory is damaged.");
  if (count > MAX_UPLOAD_FILES * 2) throw tooMany();

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const listed: { path: string; method: number; crc: number; compressedSize: number; size: number; flags: number; offset: number; executable: boolean }[] = [];
  let cursor = directoryStart;
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("This ZIP archive has a damaged entry.");
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10);
    const nameSize = zip.readUInt16LE(cursor + 28), extraSize = zip.readUInt16LE(cursor + 30), commentSize = zip.readUInt16LE(cursor + 32);
    const attributes = zip.readUInt32LE(cursor + 38) >>> 16, unixType = attributes & 0xf000;
    if (cursor + 46 + nameSize + extraSize + commentSize > end) throw new Error("This ZIP archive has a damaged entry.");
    if (unixType === 0xa000) throw new Error("This archive contains a symlink. Skills with links can't be uploaded.");
    if (flags & ~0x808 || ![0, 8].includes(method) || unixType && unixType !== 0x8000 && unixType !== 0x4000) throw new Error("This ZIP archive is encrypted or uses an unsupported feature.");
    let path: string;
    try { path = decoder.decode(zip.subarray(cursor + 46, cursor + 46 + nameSize)); } catch { throw new Error("This ZIP archive has an unsafe file name."); }
    const size = zip.readUInt32LE(cursor + 24), compressedSize = zip.readUInt32LE(cursor + 20);
    total += size;
    if (size > MAX_UPLOAD_BYTES || total > MAX_UPLOAD_BYTES || size > Math.max(1, compressedSize) * 1000) throw tooLarge();
    listed.push({ path, method, flags, crc: zip.readUInt32LE(cursor + 16), compressedSize, size, offset: zip.readUInt32LE(cursor + 42), executable: Boolean(attributes & 0o111) });
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  if (cursor !== end) throw new Error("This ZIP archive has unexpected contents.");

  const entries: Entry[] = [];
  const ranges: { start: number; end: number }[] = [];
  for (const item of listed) {
    const { offset, flags, method, compressedSize, size, crc } = item;
    if (offset + 30 > directoryStart || zip.readUInt32LE(offset) !== 0x04034b50 || zip.readUInt16LE(offset + 6) !== flags || zip.readUInt16LE(offset + 8) !== method) throw new Error("This ZIP archive has a damaged entry.");
    const localNameSize = zip.readUInt16LE(offset + 26);
    const dataStart = offset + 30 + localNameSize + zip.readUInt16LE(offset + 28), dataEnd = dataStart + compressedSize;
    if (dataEnd > directoryStart || !zip.subarray(offset + 30, offset + 30 + localNameSize).equals(Buffer.from(item.path))) throw new Error("This ZIP archive has a damaged entry.");
    if (ranges.some(range => offset < range.end && dataEnd > range.start)) throw new Error("This ZIP archive has overlapping entries.");
    ranges.push({ start: offset, end: dataEnd });
    if (item.path.endsWith("/")) { if (size) throw new Error("This ZIP archive has a damaged entry."); continue; }
    const compressed = zip.subarray(dataStart, dataEnd);
    let data: Buffer;
    try { data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: Math.max(1, size) }); } catch { throw new Error("This ZIP archive has a damaged entry."); }
    if (data.length !== size || crc32(data) !== crc) throw new Error("A file in this ZIP archive does not match its checksum.");
    entries.push({ path: item.path, data, executable: item.executable });
  }
  return entries;
}

async function readFolder(root: string): Promise<{ entries: Entry[]; fallback: string }> {
  const pending: string[] = [""];
  const found: { path: string; absolute: string; executable: boolean; size: number }[] = [];
  let total = 0;
  const top = await lstat(root).catch(() => undefined);
  if (!top?.isDirectory()) throw new Error("Choose a folder.");
  while (pending.length) {
    const relative = pending.pop()!;
    for (const item of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${item.name}` : item.name;
      const absolute = join(root, path);
      if (!safePath(path)) throw new Error(`This folder has an unsafe file name: ${path}`);
      if (clutter(path)) continue;
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`This folder contains a symlink (${path}). Skills with links can't be uploaded.`);
      if (info.isDirectory()) { pending.push(path); continue; }
      if (!info.isFile()) throw new Error(`This folder contains something that is not a regular file: ${path}`);
      total += info.size;
      if (info.size > MAX_UPLOAD_BYTES || total > MAX_UPLOAD_BYTES) throw tooLarge();
      if (found.length >= MAX_UPLOAD_FILES) throw tooMany();
      found.push({ path, absolute, executable: Boolean(info.mode & 0o111), size: info.size });
    }
  }
  const entries: Entry[] = [];
  for (const file of found) entries.push({ path: file.path, data: await readFile(file.absolute), executable: file.executable });
  return { entries, fallback: basename(root) };
}

function frontmatter(text: string): { name?: unknown; description?: unknown } {
  const match = /^---\r?\n((?:[^\n]*\n)*?)---(?:\r?\n|$)/.exec(text);
  if (!match) return {};
  try {
    const value: unknown = parse(match[1] ?? "");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

function checked(entries: Entry[]): Entry[] {
  const seen = new Set<string>();
  let total = 0;
  const files: Entry[] = [];
  for (const entry of entries) {
    if (!safePath(entry.path)) throw new Error(`This upload has an unsafe file path: ${JSON.stringify(entry.path)}`);
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new Error(`This upload lists ${entry.path} more than once (duplicate paths).`);
    seen.add(key);
    if (entry.path.endsWith("/") || clutter(entry.path)) continue;
    total += entry.data.length;
    if (total > MAX_UPLOAD_BYTES) throw tooLarge();
    files.push(entry);
    if (files.length > MAX_UPLOAD_FILES) throw tooMany();
  }
  return files;
}

/** Validates an uploaded zip, `.skill` file or folder completely, then writes each skill it finds into `staging`; a rejected upload writes nothing. */
export async function stageUpload(source: UploadSource, staging: string): Promise<UploadedSkill[]> {
  let fallback: string | undefined;
  let entries: Entry[];
  if ("archive" in source) entries = readArchive(source.archive);
  else if ("files" in source) entries = source.files.map(file => ({ path: file.path, data: file.data, executable: Boolean(file.executable) }));
  else { const folder = await readFolder(source.folder); entries = folder.entries; fallback = folder.fallback; }

  const files = checked(entries);
  const roots = files.filter(file => basename(file.path) === "SKILL.md").map(file => dirname(file.path) === "." ? "" : dirname(file.path));
  if (!roots.length) throw new Error("No SKILL.md found. A skill is a folder with a SKILL.md file.");
  const tops = roots.filter(root => !roots.some(other => other !== root && (other === "" || root.startsWith(`${other}/`))));

  const found: { name: string; description: string; members: { relative: string; entry: Entry }[] }[] = [];
  for (const root of tops) {
    const members = files.filter(file => root === "" || file.path.startsWith(`${root}/`)).map(entry => ({ relative: root ? entry.path.slice(root.length + 1) : entry.path, entry }));
    const manifest = members.find(member => member.relative === "SKILL.md")!;
    const meta = frontmatter(manifest.entry.data.toString("utf8"));
    const folder = root ? basename(root) : fallback;
    const name = meta.name === undefined ? folder : meta.name;
    if (!skillName(name)) throw new Error(`${root ? `The skill in ${root}` : "This skill"} needs a valid name: letters, numbers, dots, dashes and underscores. Set name in SKILL.md.`);
    if (found.some(item => sameSkillName(item.name, name))) throw new Error(`Two skills in this upload have the same name (${name}). Names must be unique.`);
    found.push({ name, description: typeof meta.description === "string" ? meta.description.trim() : "", members });
  }

  found.sort((a, b) => a.name.localeCompare(b.name));
  const staged: UploadedSkill[] = [];
  for (const skill of found) {
    const path = join(staging, skill.name);
    for (const { relative, entry } of skill.members) {
      const target = join(path, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, entry.data);
      await chmod(target, entry.executable ? 0o755 : 0o644);
    }
    staged.push({ name: skill.name, description: skill.description, files: skill.members.length, bytes: skill.members.reduce((sum, member) => sum + member.entry.data.length, 0), path });
  }
  return staged;
}
