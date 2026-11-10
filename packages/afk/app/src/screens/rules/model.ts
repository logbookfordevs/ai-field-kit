import type { RulesState } from "../../../../src/fieldwork/rules.js";

export const RULES_START = "<!-- AFK:RULES:START -->";
export const RULES_END = "<!-- AFK:RULES:END -->";
export const CANONICAL = "AGENTS.md";

export interface RuleFile {
  path: string;
  /** What the AFK folder holds; null for a file that exists only as a draft. */
  saved: string | null;
  draft: string;
}

/** A draft set aside when a newer one replaced it, so nothing typed is lost. */
export interface Stash {
  text: string;
  files?: RuleFile[] | undefined;
  when: string;
}

export interface Drafts {
  loaded: boolean;
  folder: string;
  files: RuleFile[];
  current: string;
  savedAt: string | null;
  stash: Stash | null;
  /** The saved content as last read, to tell whether anything differs. */
  snapshot: string;
  baseHash: string | undefined;
}

export const emptyDrafts = (): Drafts => ({ loaded: false, folder: "", files: [], current: CANONICAL, savedAt: null, stash: null, snapshot: "[]", baseHash: undefined });

const fileOf = (path: string, text: string): RuleFile => ({ path, saved: text, draft: text });

export function draftSnapshot(files: RuleFile[]): string {
  return JSON.stringify(files.map(file => ({ path: file.path, content: file.draft })).sort((a, b) => a.path.localeCompare(b.path)));
}

export const hasEdits = (drafts: Drafts): boolean => draftSnapshot(drafts.files) !== drafts.snapshot;

/** Files that differ from what is saved. A reference added then removed again still leaves the list changed. */
export function dirtyFiles(drafts: Drafts): { path: string }[] {
  const changed = drafts.files.filter(file => file.draft !== file.saved);
  if (!changed.length && hasEdits(drafts)) return [{ path: "reference list" }];
  return changed;
}

export const hasCanonical = (drafts: Drafts): boolean => drafts.files.some(file => file.path === CANONICAL);
export const savedText = (drafts: Drafts, path: string): string | undefined => {
  const file = drafts.files.find(entry => entry.path === path);
  return file && file.saved !== null ? file.saved : undefined;
};
export const currentFile = (drafts: Drafts): RuleFile | undefined => drafts.files.find(file => file.path === drafts.current) ?? drafts.files[0];

/** Takes what the server holds. Unsaved drafts survive a reload unless `force`. */
export function applyServerState(drafts: Drafts, state: RulesState, force = false): Drafts {
  const folderChanged = drafts.folder !== state.folder;
  const keep = drafts.loaded && !folderChanged && hasEdits(drafts) && !force;
  if (keep) return { ...drafts, folder: state.folder, loaded: true };
  const files = state.files.filter(file => file.path !== CANONICAL || state.canonicalExists !== false).map(file => fileOf(file.path, file.content));
  return {
    ...drafts,
    loaded: true,
    folder: state.folder,
    files,
    current: files.some(file => file.path === drafts.current) ? drafts.current : CANONICAL,
    snapshot: draftSnapshot(files),
    baseHash: state.filesHash,
    stash: folderChanged ? null : drafts.stash,
  };
}

export function markSaved(drafts: Drafts, when: string): Drafts {
  const files = drafts.files.map(file => fileOf(file.path, file.draft));
  return { ...drafts, files, snapshot: draftSnapshot(files), savedAt: when };
}

export function editDraft(drafts: Drafts, text: string): Drafts {
  return { ...drafts, files: drafts.files.map(file => file.path === drafts.current ? { ...file, draft: text } : file) };
}

export function revertFile(drafts: Drafts): Drafts {
  return { ...drafts, files: drafts.files.map(file => file.path === drafts.current && file.saved !== null ? { ...file, draft: file.saved } : file) };
}

export function revertAll(drafts: Drafts): Drafts {
  const files = drafts.files.filter(file => file.saved !== null).map(file => fileOf(file.path, file.saved ?? ""));
  return { ...drafts, files, current: CANONICAL, stash: null, snapshot: draftSnapshot(files) };
}

export function openFile(drafts: Drafts, path: string): Drafts {
  return { ...drafts, current: path };
}

export function startDocument(drafts: Drafts, text: string): Drafts {
  return { ...drafts, files: [{ path: CANONICAL, saved: null, draft: text }, ...drafts.files.filter(file => file.path !== CANONICAL)], current: CANONICAL };
}

/** Puts a destination's rules into AGENTS.md as a draft, setting the previous draft aside if it held edits. */
export function adoptDraft(drafts: Drafts, content: string, when: string): Drafts {
  const canonical = drafts.files.find(file => file.path === CANONICAL) ?? { path: CANONICAL, saved: null, draft: "" };
  const stash = canonical.draft !== canonical.saved ? { text: canonical.draft, when } : drafts.stash;
  const others = drafts.files.filter(file => file.path !== CANONICAL);
  return { ...drafts, files: [{ ...canonical, draft: content }, ...others], current: CANONICAL, stash };
}

export function restoreStash(drafts: Drafts, when: string): Drafts {
  const stash = drafts.stash;
  if (!stash) return drafts;
  const canonical = drafts.files.find(file => file.path === CANONICAL);
  const aside: Stash = { text: canonical?.draft ?? "", files: stash.files ? structuredClone(drafts.files) : undefined, when };
  const files = stash.files ? structuredClone(stash.files) : drafts.files.map(file => file.path === CANONICAL ? { ...file, draft: stash.text } : file);
  return { ...drafts, files, current: CANONICAL, stash: aside };
}

export const discardStash = (drafts: Drafts): Drafts => ({ ...drafts, stash: null });

/** Keeps the current drafts aside and loads the saved files, for a folder that changed on disk. */
export function reloadFromDisk(drafts: Drafts, state: RulesState, when: string): Drafts {
  const stash: Stash = { text: drafts.files.find(file => file.path === CANONICAL)?.draft ?? "", files: structuredClone(drafts.files), when };
  return { ...applyServerState(drafts, state, true), stash };
}

/* ---- reference keys and paths ---- */

export const refKey = (path: string): string => path.slice("references/".length);
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KEY = /\{\{\s*([\w][\w.\-/]*)\s*\}\}/g;
const keyPattern = (key: string): RegExp => new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g");
export const refKeys = (text: string): string[] => [...new Set([...text.matchAll(KEY)].map(match => match[1] ?? ""))];

export function refPathError(drafts: Drafts, path: string, except?: string): string {
  if (!/^[\w][\w.\-/]*\.md$/.test(path) || path.includes("..") || path.includes("//")) return "Use a relative Markdown path such as testing.md or frontend/forms.md.";
  if (drafts.files.some(file => file.path === `references/${path}` && file.path !== except)) return "A reference with this path already exists.";
  return "";
}

export const newRefName = (query: string): string => /\.md$/.test(query) ? query : `${query.replace(/\.+$/, "")}.md`;

const titleOf = (path: string): string => {
  const title = path.split("/").pop()!.replace(/\.md$/, "").replace(/[-_]/g, " ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

export function addReference(drafts: Drafts, input: { path: string; body: string; link: boolean }): Drafts {
  const path = `references/${input.path}`;
  const title = titleOf(input.path);
  const files: RuleFile[] = [...drafts.files, { path, saved: null, draft: input.body.trim() || `# ${title}\n\n` }];
  const linked = input.link ? files.map(file => file.path === CANONICAL ? { ...file, draft: `${file.draft.trimEnd()}\n- ${title}: {{${input.path}}}` } : file) : files;
  return { ...drafts, files: linked, current: path };
}

/** How many mentions of a reference AGENTS.md holds, as keys or as links. */
export function mentions(drafts: Drafts, path: string): number {
  const canonical = drafts.files.find(file => file.path === CANONICAL)?.draft ?? "";
  return canonical.split(`](${path})`).length - 1 + (canonical.match(keyPattern(refKey(path))) ?? []).length;
}

export function renameReference(drafts: Drafts, from: string, to: string, relink: boolean): Drafts {
  const path = `references/${to}`;
  const files = drafts.files.map(file => {
    if (file.path === from) return { ...file, path };
    if (file.path === CANONICAL && relink) {
      const draft = file.draft.replace(keyPattern(refKey(from)), `{{${to}}}`).replaceAll(`](${from})`, `](${path})`).replaceAll(`[${from}]`, `[${path}]`);
      return { ...file, draft };
    }
    return file;
  });
  return { ...drafts, files, current: path };
}

export function removeReference(drafts: Drafts, path: string): { drafts: Drafts; index: number; file: RuleFile | undefined } {
  const index = drafts.files.findIndex(file => file.path === path);
  const file = drafts.files[index];
  return { drafts: { ...drafts, files: drafts.files.filter(entry => entry.path !== path), current: CANONICAL }, index, file };
}

export function restoreReference(drafts: Drafts, index: number, file: RuleFile): Drafts {
  const files = [...drafts.files];
  files.splice(index, 0, file);
  return { ...drafts, files, current: file.path };
}

/** References AGENTS.md or the open file points at that have no file in references/. */
export function missingReferences(drafts: Drafts, file: RuleFile): { used: number; missing: string[] } {
  const links = [...file.draft.matchAll(/\]\((?:\.\/)?(references\/[^)\s]+)\)/g)].map(match => match[1] ?? "");
  const has = (path: string): boolean => drafts.files.some(entry => entry.path === path);
  const keys = file.path === CANONICAL ? refKeys(file.draft) : [];
  const used = new Set([...links, ...keys.map(key => `references/${key}`)]);
  const missing = [...keys.filter(key => !has(`references/${key}`)).map(key => `{{${key}}}`), ...new Set(links.filter(path => !has(path)))];
  return { used: used.size, missing };
}

export const lineCount = (text: string): number => text.trim() ? text.trim().split("\n").length : 0;

/** Rules typed from a destination file, minus AFK's own markers. */
export function textFromDestination(text: string): string {
  return text.split("\n").filter(line => line.trim() !== RULES_START && line.trim() !== RULES_END && !line.trim().startsWith("<!-- Managed by AFK.")).join("\n");
}

/* ---- diff ---- */

export type DiffRow = { kind: "same" | "add" | "del"; text: string } | { kind: "fold"; text: string };

/** Lines that changed between two texts, with long unchanged runs folded. */
export function diffRows(before: string | null, after: string | null): DiffRow[] {
  const a = (before ?? "").split("\n"), b = (after ?? "").split("\n");
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  let ai = a.length, bi = b.length;
  while (ai > first && bi > first && a[ai - 1] === b[bi - 1]) { ai--; bi--; }
  const rows: DiffRow[] = [
    ...a.slice(0, first).map(text => ({ kind: "same" as const, text })),
    ...a.slice(first, ai).map(text => ({ kind: "del" as const, text })),
    ...b.slice(first, bi).map(text => ({ kind: "add" as const, text })),
    ...a.slice(ai).map(text => ({ kind: "same" as const, text })),
  ];
  const output: DiffRow[] = [];
  let run: DiffRow[] = [];
  const flush = (): void => {
    if (run.length > 6) output.push(...run.slice(0, 2), { kind: "fold", text: `${run.length - 4} unchanged lines` }, ...run.slice(-2));
    else output.push(...run);
    run = [];
  };
  for (const row of rows) {
    if (row.kind === "same") run.push(row);
    else { flush(); output.push(row); }
  }
  flush();
  return output;
}

export const clock = (): string => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
