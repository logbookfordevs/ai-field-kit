import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { containsControl, expandPath, type AgentRulesSettings, type RulesDestination, type Settings, SettingsStore, validateSettings } from "./settings.js";

export const RULES_START = "<!-- AFK:RULES:START -->";
export const RULES_END = "<!-- AFK:RULES:END -->";
const LIMIT = 2_000_000;

export interface RulesFile { path: string; content: string }
export interface RulesDestinationState extends RulesDestination {
  status: "current" | "outdated" | "never" | "conflict" | "off";
  reason: string;
  lastSync?: string;
}
export interface RulesReferenceOperation { path: string; before: string | null; after: string | null }
export interface RulesTargetPreview extends RulesDestinationState {
  before: string | null;
  after: string;
  region: string;
  currentRegion: string | null;
  references: RulesReferenceOperation[];
}
export interface RulesPreview { filesHash: string; targets: RulesTargetPreview[]; errors: string[] }
export interface RulesState { folder: string; canonicalExists: boolean; files: RulesFile[]; filesHash: string; destinations: RulesDestinationState[]; errors: string[] }
export interface RulesSyncResult { preview: RulesPreview; settings: Settings }

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
function digest(text: string): string { return createHash("sha256").update(text).digest("hex"); }
function safeRelative(path: string): boolean {
  return !isAbsolute(path) && !containsControl(path) && !path.includes("\\") && !path.split("/").some(part => !part || part === "." || part === "..") && !/[<>:"|?*]/.test(path);
}
function referencePath(path: string): boolean { return safeRelative(path) && path.startsWith("references/") && path.endsWith(".md"); }

export function validateRulesFiles(input: unknown): RulesFile[] {
  if (!Array.isArray(input)) throw new Error("Rules files must be a list.");
  const files: RulesFile[] = [];
  let length = 0;
  for (const value of input) {
    if (!value || typeof value !== "object") throw new Error("Invalid rules file.");
    const file = value as Record<string, unknown>;
    if (typeof file.path !== "string" || (file.path !== "AGENTS.md" && !referencePath(file.path)) || typeof file.content !== "string" || file.content.includes("\0")) throw new Error("Use AGENTS.md and Markdown files inside references/.");
    length += Buffer.byteLength(file.content);
    files.push({ path: file.path, content: file.content });
  }
  if (length > LIMIT) throw new Error("Rules files exceed the 2 MB workspace limit.");
  if (!files.some(file => file.path === "AGENTS.md")) throw new Error("The rules workspace needs AGENTS.md.");
  if (new Set(files.map(file => file.path.toLowerCase())).size !== files.length) throw new Error("Rules file paths must be unique.");
  if (files.some(file => file.content.includes(RULES_START) || file.content.includes(RULES_END))) throw new Error("Do not place AFK region markers in the canonical rules files.");
  return files;
}

function resolveReference(file: string, value: string, files: Map<string, string>, token: boolean): string {
  let name = value;
  try { name = decodeURIComponent(value); } catch { throw new Error(`Invalid reference in ${file}: ${value}`); }
  if (isAbsolute(name) || name.includes("\\") || containsControl(name)) throw new Error(`References must stay inside the AFK folder: ${value}`);
  const candidates = token
    ? [name.startsWith("references/") ? name : `references/${name}`]
    : [posix.normalize(posix.join(posix.dirname(file), name)), file === "AGENTS.md" ? `references/${name}` : ""];
  const match = candidates.find(path => referencePath(path) && files.has(path));
  if (!match) throw new Error(`Missing reference in ${file}: ${value}`);
  return match;
}

function transformReferences(file: RulesFile, files: Map<string, string>, targetRoot?: string): string {
  let content = file.content.replace(/(!?\[[^\]\n]*\]\()([^\s)]+)([^)]*\))/g, (all: string, prefix: string, destination: string, suffix: string) => {
    const link = destination.replace(/^<|>$/g, "");
    if (/^\{\{[^{}]+\}\}$/.test(link)) return all;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(link)) return all;
    const [path, anchor] = link.split("#", 2);
    if (!path || extname(path).toLowerCase() !== ".md") return all;
    const resolved = resolveReference(file.path, path, files, false);
    if (!targetRoot) return all;
    const output = join(targetRoot, resolved).split(sep).join("/").replaceAll(" ", "%20");
    return `${prefix}${output}${anchor ? `#${anchor}` : ""}${suffix}`;
  });
  content = content.replace(/\{\{([^{}\n]+)\}\}/g, (_all: string, value: string) => {
    const path = resolveReference(file.path, value.trim(), files, true);
    return targetRoot ? join(targetRoot, path) : path;
  });
  return content;
}

export function referenceErrors(files: RulesFile[]): string[] {
  const map = new Map(files.map(file => [file.path, file.content]));
  const errors: string[] = [];
  for (const file of files) {
    try { transformReferences(file, map); } catch (error) { errors.push(errorText(error)); }
  }
  return errors;
}

interface Region { text: string; start: number; end: number; content: string }
function regionIn(text: string): Region | null {
  const starts = [...text.matchAll(/<!-- AFK:RULES:START -->/g)];
  const ends = [...text.matchAll(/<!-- AFK:RULES:END -->/g)];
  if (!starts.length && !ends.length) return null;
  if (starts.length !== 1 || ends.length !== 1 || starts[0]!.index! >= ends[0]!.index!) throw new Error("AFK markers are broken or duplicated. Repair them before syncing.");
  const start = starts[0]!.index!;
  const end = ends[0]!.index! + RULES_END.length;
  const content = text.slice(start + RULES_START.length, end - RULES_END.length).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  return { text: text.slice(start, end), start, end, content };
}
function replaceRegion(text: string, region: Region | null, desired: string): string {
  if (region) return text.slice(0, region.start) + desired + text.slice(region.end);
  if (!text) return desired;
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const gap = text.endsWith(newline + newline) ? "" : text.endsWith(newline) ? newline : newline + newline;
  return text + gap + desired;
}
async function optionalText(path: string): Promise<string | null> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular file: ${path}`);
    if (info.size > LIMIT) throw new Error(`Rules file is too large: ${path}`);
    return await readFile(path, "utf8");
  } catch (error) { if (missing(error)) return null; throw error; }
}
async function physical(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) { if (!missing(error)) throw error; return join(await physical(dirname(path)), path.slice(dirname(path).length + 1)); }
}
async function noSymlinksBelow(root: string, path: string): Promise<void> {
  const distance = relative(root, path);
  if (distance.startsWith(`..${sep}`) || distance === ".." || isAbsolute(distance)) throw new Error("Rules paths must stay inside their folder.");
  let current = root;
  for (const part of distance.split(sep).filter(Boolean)) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Rules paths cannot cross symbolic links: ${current}`); }
    catch (error) { if (!missing(error)) throw error; }
  }
}
async function atomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, content, { mode: 0o600 }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
async function writeWithBackup(path: string, before: string | null, after: string | null): Promise<void> {
  if (before === after) return;
  if (await optionalText(path) !== before) throw new Error("A destination changed after preview. Preview again before syncing.");
  if (before !== null) await writeFile(`${path}.afk-backup-${randomUUID()}`, before, { mode: 0o600, flag: "wx" });
  if (after === null) await rm(path);
  else await atomic(path, after);
}

async function restoreOperations(operations: RulesReferenceOperation[]): Promise<void> {
  for (const operation of [...operations].reverse()) {
    if (await optionalText(operation.path) !== operation.after) continue;
    if (operation.before === null) await rm(operation.path, { force: true });
    else await atomic(operation.path, operation.before);
  }
}

export class RulesWorkspace {
  constructor(readonly store: SettingsStore) {}
  get folder(): string { return dirname(this.store.path); }

  configuration(settings: Settings): AgentRulesSettings {
    return settings.agentRules ?? {
      destinations: [
        { id: "codex", name: "Codex", kind: "codex", path: join(this.store.home, ".codex/AGENTS.md") },
        { id: "claude", name: "Claude", kind: "claude", path: join(this.store.home, ".claude/AGENTS.md") },
      ],
      receipts: {},
    };
  }

  async files(): Promise<RulesFile[]> {
    const files: RulesFile[] = [{ path: "AGENTS.md", content: await optionalText(join(this.folder, "AGENTS.md")) ?? "" }];
    const collect = async (folder: string, prefix: string): Promise<void> => {
      try {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error(`Reference files cannot be symbolic links: ${prefix}${entry.name}`);
          if (entry.isDirectory()) await collect(join(folder, entry.name), `${prefix}${entry.name}/`);
          else if (entry.isFile() && entry.name.endsWith(".md")) files.push({ path: `${prefix}${entry.name}`, content: (await optionalText(join(folder, entry.name)))! });
        }
      } catch (error) { if (!missing(error)) throw error; }
    };
    await noSymlinksBelow(this.folder, join(this.folder, "references"));
    await collect(join(this.folder, "references"), "references/");
    return validateRulesFiles(files.sort((a, b) => a.path.localeCompare(b.path)));
  }

  async saveFiles(input: RulesFile[], expectedHash?: string): Promise<RulesState> {
    const files = validateRulesFiles(input);
    const existing = await this.files();
    if (expectedHash !== undefined && expectedHash !== digest(JSON.stringify(existing))) throw new Error("The rules files changed outside AFK. Reload before saving.");
    for (const file of files) {
      const previous = existing.find(entry => entry.path.toLowerCase() === file.path.toLowerCase());
      if (previous && previous.path !== file.path) throw new Error("Case-only reference renames need an intermediate file name.");
      await optionalText(join(this.folder, file.path));
    }
    for (const file of [...files, ...existing]) await noSymlinksBelow(this.folder, join(this.folder, file.path));
    const stages: { path: string; temporary: string }[] = [];
    const changed: RulesReferenceOperation[] = [];
    try {
      for (const file of files) {
        const path = join(this.folder, file.path);
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.${randomUUID()}.tmp`;
        await writeFile(temporary, file.content, { mode: 0o600 });
        stages.push({ path, temporary });
      }
      for (const stage of stages) {
        const key = relative(this.folder, stage.path).split(sep).join("/");
        const before = existing.find(file => file.path === key)?.content ?? null;
        if (await optionalText(stage.path) !== before && !(key === "AGENTS.md" && before === "" && await optionalText(stage.path) === null)) throw new Error("The rules files changed while saving. Reload before saving.");
        const prior = await optionalText(stage.path);
        await rename(stage.temporary, stage.path);
        changed.push({ path: stage.path, before: prior, after: files.find(file => file.path === key)!.content });
      }
      for (const file of existing) {
        if (files.some(next => next.path === file.path)) continue;
        const path = join(this.folder, file.path);
        if (await optionalText(path) !== file.content) throw new Error("The rules files changed while saving. Reload before saving.");
        await rm(path);
        changed.push({ path, before: file.content, after: null });
      }
    } catch (error) {
      for (const operation of changed.reverse()) {
        if (await optionalText(operation.path) !== operation.after) continue;
        if (operation.before === null) await rm(operation.path, { force: true });
        else await atomic(operation.path, operation.before);
      }
      throw error;
    } finally { await Promise.all(stages.map(stage => rm(stage.temporary, { force: true }))); }
    return this.state(await this.store.read());
  }

  private async checkDestination(settings: Settings, destination: RulesDestination): Promise<void> {
    if (!destination.path.trim() || (!isAbsolute(destination.path) && !destination.path.startsWith("~/")) || containsControl(destination.path) || extname(destination.path).toLowerCase() !== ".md") throw new Error("Choose an absolute Markdown destination file path.");
    const path = expandPath(destination.path, this.store.home);
    const canonical = await physical(this.folder);
    const identity = await physical(path);
    if (identity === canonical || identity.startsWith(canonical + sep)) throw new Error("A destination cannot be inside the AFK source folder.");
    const parent = await physical(dirname(path));
    if (identity !== join(parent, path.slice(dirname(path).length + 1))) throw new Error("A rules destination cannot itself be a symbolic link.");
    for (const other of this.configuration(settings).destinations) {
      if (other.id !== destination.id && (await physical(expandPath(other.path, this.store.home))) === identity) throw new Error("Another destination already uses that file.");
    }
    await noSymlinksBelow(dirname(path), join(dirname(path), "afk-rules"));
  }

  async saveDestination(settings: Settings, destination: RulesDestination): Promise<Settings> {
    const config = structuredClone(this.configuration(settings));
    const previous = config.destinations.find(d => d.id === destination.id);
    if (previous && expandPath(previous.path, this.store.home) !== expandPath(destination.path, this.store.home) && config.receipts[destination.id]) throw new Error("Disconnect the existing destination before changing its path.");
    await this.checkDestination(settings, destination);
    destination = { ...destination, path: expandPath(destination.path, this.store.home) };
    config.destinations = config.destinations.filter(d => d.id !== destination.id);
    config.destinations.push(destination);
    settings.agentRules = config;
    validateSettings(settings);
    await this.store.save(settings);
    return settings;
  }

  async preview(settings: Settings, ids: string[]): Promise<RulesPreview> {
    const files = await this.files();
    const errors = referenceErrors(files);
    if (!files.find(file => file.path === "AGENTS.md")!.content.trim()) errors.push("Add rules before syncing.");
    const map = new Map(files.map(file => [file.path, file.content]));
    const config = this.configuration(settings);
    if (new Set(ids).size !== ids.length || ids.some(id => !config.destinations.some(d => d.id === id))) throw new Error("Choose valid, unique rules destinations.");
    const targets: RulesTargetPreview[] = [];
    for (const id of ids) {
      const destination = config.destinations.find(d => d.id === id)!;
      const target: RulesTargetPreview = { ...destination, path: expandPath(destination.path, this.store.home), status: "never", reason: "Not synced yet.", before: null, after: "", region: "", currentRegion: null, references: [] };
      const receipt = config.receipts[id];
      if (receipt) target.lastSync = receipt.lastSync;
      try {
        await this.checkDestination(settings, destination);
        target.before = await optionalText(target.path);
        const current = regionIn(target.before ?? "");
        target.currentRegion = current?.text ?? null;
        if (errors.length) {
          if (current && !receipt) throw new Error("This file contains an AFK region without local ownership. Review it before adopting or overwriting.");
          if (receipt && (current?.text ?? "") !== receipt.region) throw new Error("The destination rules were edited outside AFK. Review the conflict before syncing.");
          target.status = receipt ? "outdated" : "never";
          target.reason = receipt ? "Fix the rules document before syncing." : "Not synced yet.";
          target.after = target.before ?? "";
          targets.push(target);
          continue;
        }
        const root = join(dirname(target.path), "afk-rules", id);
        const newline = target.before?.includes("\r\n") ? "\r\n" : "\n";
        const canonical = files.find(file => file.path === "AGENTS.md")!;
        const content = transformReferences(canonical, map, root).replace(/\r?\n/g, newline);
        target.region = `${RULES_START}${newline}${content}${content.endsWith(newline) ? "" : newline}${RULES_END}`;
        target.after = replaceRegion(target.before ?? "", current, target.region);
        for (const file of files.filter(file => file.path !== "AGENTS.md")) {
          const path = join(root, file.path);
          await noSymlinksBelow(dirname(target.path), path);
          target.references.push({ path, before: await optionalText(path), after: transformReferences(file, map, root) });
        }
        for (const path of Object.keys(receipt?.references ?? {})) {
          if (!referencePath(path)) throw new Error("Invalid reference ownership receipt.");
          const full = join(root, path);
          if (!target.references.some(operation => operation.path === full)) {
            await noSymlinksBelow(dirname(target.path), full);
            target.references.push({ path: full, before: await optionalText(full), after: null });
          }
        }
        if (current && !receipt) throw new Error("This file contains an AFK region without local ownership. Review it before adopting or overwriting.");
        if (receipt && (current?.text ?? "") !== receipt.region) throw new Error("The destination rules were edited outside AFK. Review the conflict before syncing.");
        for (const operation of target.references) {
          const key = relative(root, operation.path).split(sep).join("/");
          const owned = receipt?.references[key];
          if (owned === undefined && operation.before !== null) throw new Error(`An existing reference is not owned by AFK: ${key}`);
          if (owned !== undefined && operation.before !== owned) throw new Error(`A reference was changed outside AFK: ${key}`);
        }
        const isCurrent = target.before === target.after && target.references.every(operation => operation.before === operation.after);
        target.status = isCurrent ? "current" : receipt ? "outdated" : "never";
        target.reason = isCurrent ? "Matches the saved rules." : receipt ? "Saved rules have changes to sync." : "Ready for first sync.";
      } catch (error) { target.status = "conflict"; target.reason = errorText(error); }
      targets.push(target);
    }
    return { filesHash: digest(JSON.stringify(files)), targets, errors };
  }

  async state(settings: Settings): Promise<RulesState> {
    try {
      const files = await this.files();
      const preview = await this.preview(settings, this.configuration(settings).destinations.map(d => d.id));
      return { folder: this.folder, canonicalExists: await optionalText(join(this.folder, "AGENTS.md")) !== null, files, filesHash: digest(JSON.stringify(files)), destinations: preview.targets.map(({ before: _before, after: _after, region: _region, currentRegion: _current, references: _references, ...destination }) => destination), errors: preview.errors };
    } catch (error) { return { folder: this.folder, canonicalExists: false, files: [], filesHash: "", destinations: [], errors: [errorText(error)] }; }
  }

  private async apply(settings: Settings, preview: RulesPreview): Promise<RulesSyncResult> {
    if (preview.errors.length) throw new Error(preview.errors.join(" "));
    if (digest(JSON.stringify(await this.files())) !== preview.filesHash) throw new Error("The rules files changed after preview. Preview again.");
    const writable = preview.targets.filter(target => target.status !== "conflict");
    for (const target of writable) {
      if (await optionalText(target.path) !== target.before) throw new Error("A destination changed after preview. Preview again.");
      for (const ref of target.references) if (await optionalText(ref.path) !== ref.before) throw new Error("A reference changed after preview. Preview again.");
    }
    const originalRules = settings.agentRules;
    const config = structuredClone(this.configuration(settings));
    const completed: RulesReferenceOperation[] = [];
    settings.agentRules = config;
    try {
      for (const target of writable) {
        if (target.status === "current") continue;
        const changed: RulesReferenceOperation[] = [];
        try {
          await this.checkDestination(settings, target);
          for (const ref of target.references) {
            await noSymlinksBelow(dirname(target.path), ref.path);
            await writeWithBackup(ref.path, ref.before, ref.after);
            if (ref.before !== ref.after) changed.push(ref);
          }
          await writeWithBackup(target.path, target.before, target.after);
          changed.push({ path: target.path, before: target.before, after: target.after });
          completed.push(...changed);
        } catch (error) {
          for (const operation of changed.reverse()) {
            if (await optionalText(operation.path) !== operation.after) continue;
            if (operation.before === null) await rm(operation.path, { force: true });
            else await atomic(operation.path, operation.before);
          }
          throw error;
        }
        const root = join(dirname(target.path), "afk-rules", target.id);
        config.receipts[target.id] = { region: target.region, references: Object.fromEntries(target.references.filter(ref => ref.after !== null).map(ref => [relative(root, ref.path).split(sep).join("/"), ref.after!])), lastSync: new Date().toISOString() };
      }
      await this.store.save(settings);
    } catch (error) {
      await restoreOperations(completed);
      settings.agentRules = originalRules;
      throw error;
    }
    return { preview: await this.preview(settings, preview.targets.map(target => target.id)), settings };
  }

  async sync(settings: Settings, ids: string[], expectedPreview?: unknown): Promise<RulesSyncResult> {
    const preview = await this.preview(settings, ids);
    if (expectedPreview !== undefined && JSON.stringify(expectedPreview) !== JSON.stringify(preview)) throw new Error("Rules or destinations changed after preview. Preview again.");
    return this.apply(settings, preview);
  }

  async existingText(settings: Settings, id: string): Promise<{ text: string; region: string | null }> {
    const destination = this.configuration(settings).destinations.find(d => d.id === id);
    if (!destination) throw new Error("Unknown rules destination.");
    await this.checkDestination(settings, destination);
    const text = await optionalText(expandPath(destination.path, this.store.home)) ?? "";
    return { text, region: regionIn(text)?.text ?? null };
  }

  async adopt(settings: Settings, id: string): Promise<string> {
    const destination = this.configuration(settings).destinations.find(d => d.id === id);
    if (!destination) throw new Error("Unknown rules destination.");
    const existing = await this.existingText(settings, id);
    const region = regionIn(existing.text);
    if (!region) throw new Error("There is no managed region to adopt.");
    let content = region.content;
    const root = join(dirname(expandPath(destination.path, this.store.home)), "afk-rules", id);
    for (const file of await this.files()) {
      if (file.path !== "AGENTS.md") {
        const token = `{{${file.path.slice("references/".length)}}}`;
        content = content.replaceAll(join(root, file.path), token).replaceAll(join(root, file.path).replaceAll(" ", "%20"), token);
      }
    }
    const config = structuredClone(this.configuration(settings));
    config.receipts[id] = { region: region.text, references: config.receipts[id]?.references ?? {}, lastSync: config.receipts[id]?.lastSync ?? "" };
    settings.agentRules = config;
    await this.store.save(settings);
    return content;
  }

  async overwrite(settings: Settings, id: string, expectedRegion: string, expectedPreview?: unknown): Promise<RulesSyncResult> {
    const preview = await this.preview(settings, [id]);
    if (expectedPreview !== undefined && JSON.stringify(expectedPreview) !== JSON.stringify(preview)) throw new Error("Rules or destinations changed after review. Review again before overwriting.");
    const target = preview.targets[0]!;
    if ((target.currentRegion ?? "") !== expectedRegion || !target.region) throw new Error("The destination changed or its markers are broken. Preview again before overwriting.");
    const config = structuredClone(this.configuration(settings));
    config.receipts[id] = { region: target.currentRegion ?? "", references: config.receipts[id]?.references ?? {}, lastSync: config.receipts[id]?.lastSync ?? "" };
    if (expectedPreview !== undefined) {
      const root = join(dirname(target.path), "afk-rules", id);
      for (const operation of target.references) {
        const key = relative(root, operation.path).split(sep).join("/");
        if (config.receipts[id]!.references[key] !== undefined) {
          if (operation.before !== null) config.receipts[id]!.references[key] = operation.before;
          else delete config.receipts[id]!.references[key];
        }
      }
    }
    const staged = { ...settings, agentRules: config };
    const accepted = await this.preview(staged, [id]);
    return this.apply(staged, accepted);
  }

  async disconnect(settings: Settings, id: string, clean: boolean): Promise<Settings> {
    const originalRules = settings.agentRules;
    const config = structuredClone(this.configuration(settings));
    const destination = config.destinations.find(d => d.id === id);
    if (!destination) throw new Error("Unknown rules destination.");
    const operations: RulesReferenceOperation[] = [];
    const changed: RulesReferenceOperation[] = [];
    if (clean && config.receipts[id]) {
      await this.checkDestination(settings, destination);
      const path = expandPath(destination.path, this.store.home);
      const text = await optionalText(path);
      const region = regionIn(text ?? "");
      const receipt = config.receipts[id]!;
      if (region?.text !== receipt.region) throw new Error("The destination rules changed. Resolve the conflict before disconnecting.");
      const root = join(dirname(path), "afk-rules", id);
      for (const [key, content] of Object.entries(receipt.references)) {
        if (!referencePath(key)) throw new Error("Invalid reference ownership receipt.");
        const file = join(root, key);
        await noSymlinksBelow(dirname(path), file);
        const before = await optionalText(file);
        if (before !== content) throw new Error(`A reference changed outside AFK: ${key}`);
        operations.push({ path: file, before, after: null });
      }
      operations.unshift({ path, before: text, after: text!.slice(0, region!.start) + text!.slice(region!.end) });
    }
    try {
      for (const operation of operations) {
        await writeWithBackup(operation.path, operation.before, operation.after);
        changed.push(operation);
      }
      delete config.receipts[id];
      config.destinations = config.destinations.filter(d => d.id !== id);
      settings.agentRules = config;
      await this.store.save(settings);
    } catch (error) {
      await restoreOperations(changed);
      settings.agentRules = originalRules;
      throw error;
    }
    return settings;
  }
}
