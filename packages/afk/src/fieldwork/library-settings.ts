import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Library, libraryRoot, type InvocationChoice, type LibrarySettings, type SkillRecord } from "./library.js";
import { profileGroups, SETTINGS_VERSION, type FavoriteSource, type Profile, type Settings, type Tool } from "./settings.js";

type Files = Map<string, string>;

const folders = ["packs", "tools", "bookmarks"] as const;

const text = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

function choice(value: string | undefined): InvocationChoice {
  return value === "Manual only" || value === "Automatic allowed" ? value : "";
}

function bookmarkIds(bookmarks: FavoriteSource[]): string[] {
  const used = new Set<string>();
  return bookmarks.map(bookmark => {
    const base = bookmark.source.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "") || "bookmark";
    let id = base;
    for (let index = 2; used.has(id); index++) id = `${base}-${index}`;
    used.add(id);
    return id;
  });
}

/** Whether this machine's portable settings live in the library instead of `settings.json`. */
export async function librarySettingsActive(home: string): Promise<boolean> {
  try { await lstat(join(libraryRoot(home), ".afk/settings.json")); return true; } catch { return false; }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readFolder<T>(root: string, folder: string): Promise<T[]> {
  let names: string[];
  try { names = (await readdir(join(root, ".afk", folder))).filter(name => name.endsWith(".json")).sort(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return Promise.all(names.map(name => readJson<T>(join(root, ".afk", folder, name))));
}

/** Composes the portable part of Settings from the library's `.afk/` files; machine-local state is applied by the caller. */
export async function readLibrarySettings(home: string): Promise<Settings> {
  const root = libraryRoot(home);
  const general = await readJson<LibrarySettings>(join(root, ".afk/settings.json"));
  const profiles = (await readFolder<Omit<Profile, "enabled" | "ready">>(root, "packs")).map(profile => ({ ...profile, enabled: [], ready: false }));
  const tools = (await readFolder<Tool>(root, "tools")).sort((a, b) => a.id - b.id);
  const favoriteSources = (await readFolder<FavoriteSource>(root, "bookmarks")).sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: SETTINGS_VERSION,
    ...(general.configurationId ? { configurationId: general.configurationId } : {}),
    profiles: profiles.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    projects: [],
    tools,
    favoriteSources,
    kit: { core: general.core },
    machineOnly: [],
    preferences: {},
    managedLinks: {},
    independentSkills: {},
    ...(general.agentRules ? { agentRules: { destinations: general.agentRules.destinations, receipts: {} } } : {}),
    ...(general.welcomeDismissed ? { welcomeDismissed: true } : {}),
  };
}

/** True for a library AFK started on its own: no skills, packs, tools, bookmarks, rules or remote. Dismissing the welcome does not count as use. */
export async function libraryUntouched(home: string): Promise<boolean> {
  const library = new Library(home);
  try {
    if (!await library.exists() || (await library.names()).length) return false;
    const settings = await readLibrarySettings(home);
    if (settings.kit?.core.length || settings.profiles.length || settings.tools.length || settings.favoriteSources.length || settings.agentRules) return false;
    if ((await recordNames(library.root)).length) return false;
    if ((await readdir(join(library.root, "rules")).catch(() => [])).length) return false;
    return !(await readFile(join(library.root, ".git/config"), "utf8")).includes("[remote ");
  } catch { return false; }
}

/** Invocation choices saved in skill records; they override this machine's preferences for the same skills. */
export async function recordedInvocations(home: string): Promise<Record<string, InvocationChoice>> {
  const library = new Library(home), result: Record<string, InvocationChoice> = {};
  for (const name of await recordNames(library.root)) result[name] = choice((await library.record(name))?.invocation);
  return result;
}

async function recordNames(root: string): Promise<string[]> {
  try { return (await readdir(join(root, ".afk/skills"))).filter(name => name.endsWith(".json")).map(name => name.slice(0, -5)).sort(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

async function currentFiles(root: string): Promise<Files> {
  const files: Files = new Map();
  for (const folder of [...folders, "skills"]) {
    let names: string[] = [];
    try { names = await readdir(join(root, ".afk", folder)); } catch { /* An empty folder is not tracked by Git. */ }
    for (const name of names.filter(name => name.endsWith(".json"))) files.set(`.afk/${folder}/${name}`, await readFile(join(root, ".afk", folder, name), "utf8"));
  }
  try { files.set(".afk/settings.json", await readFile(join(root, ".afk/settings.json"), "utf8")); } catch { /* Written below. */ }
  return files;
}

/** The `.afk/` files these settings produce: one per pack, tool and bookmark, the general settings, and skill records. */
async function desiredFiles(library: Library, settings: Settings, current: Files): Promise<Files> {
  const files: Files = new Map();
  const saved = current.has(".afk/settings.json") ? JSON.parse(current.get(".afk/settings.json")!) as LibrarySettings : undefined;
  const general: LibrarySettings = {
    version: 1,
    ...(settings.configurationId ? { configurationId: settings.configurationId } : {}),
    core: settings.kit?.core ?? [],
    ...(settings.agentRules ? { agentRules: { destinations: settings.agentRules.destinations } } : {}),
    ...(settings.welcomeDismissed ? { welcomeDismissed: true } : {}),
    ...(saved?.agentFolders ? { agentFolders: saved.agentFolders } : {}),
  };
  files.set(".afk/settings.json", text(general));
  for (const { enabled: _enabled, ready: _ready, ...profile } of settings.profiles) files.set(`.afk/packs/${profile.id}.json`, text(profile));
  for (const tool of settings.tools) files.set(`.afk/tools/${tool.id}.json`, text(tool));
  const ids = bookmarkIds(settings.favoriteSources);
  settings.favoriteSources.forEach((bookmark, index) => files.set(`.afk/bookmarks/${ids[index]}.json`, text(bookmark)));

  for (const [path, content] of current) if (path.startsWith(".afk/skills/")) files.set(path, content);
  const packSource = (name: string): string | undefined => settings.profiles.flatMap(profileGroups).find(group => group.skills.includes(name))?.source;
  const names = new Set([...await library.names(), ...[...current.keys()].filter(path => path.startsWith(".afk/skills/")).map(path => path.slice(12, -5))]);
  for (const key of Object.keys(settings.preferences)) if (key.startsWith("Global|")) names.add(key.slice(7));
  const toolProvided = new Set(settings.tools.flatMap(tool => tool.provides ?? []));
  for (const name of names) {
    const storage = await library.storage(name);
    if (storage !== "library" && storage !== "pack" && !toolProvided.has(name)) continue;
    const path = `.afk/skills/${name}.json`;
    const existing = current.has(path) ? JSON.parse(current.get(path)!) as SkillRecord : undefined;
    const invocation = choice(settings.preferences[`Global|${name}`]);
    if (!existing && !invocation) continue;
    const source = existing?.source ?? packSource(name);
    files.set(path, text({ ...(source ? { source } : {}), ...existing, invocation }));
  }
  return files;
}

function label(path: string, content: string | undefined): string {
  const [, folder, file] = path.split("/");
  const value = content ? JSON.parse(content) as { name?: string } : {};
  if (folder === "settings.json") return "settings";
  const id = file!.slice(0, -5);
  if (folder === "packs") return `pack ${value.name ?? id}`;
  if (folder === "tools") return `tool ${value.name ?? id}`;
  if (folder === "bookmarks") return `bookmark ${value.name ?? id}`;
  return `${id} invocation`;
}

function describe(changes: { path: string; before?: string; after?: string }[]): string {
  return changes.map(({ path, before, after }, index) => {
    const verb = before === undefined ? "Add" : after === undefined ? "Remove" : "Update";
    const subject = path === ".afk/settings.json" ? settingsSubject(before, after) : label(path, after ?? before);
    return index === 0 ? `${verb} ${subject}` : `${verb.toLowerCase()} ${subject}`;
  }).join(", ");
}

function settingsSubject(before: string | undefined, after: string | undefined): string {
  if (!before || !after) return "settings";
  const [previous, next] = [JSON.parse(before) as LibrarySettings, JSON.parse(after) as LibrarySettings];
  return JSON.stringify(previous.core) !== JSON.stringify(next.core) ? "Core list" : "settings";
}

export interface LibrarySettingsChange {
  message: string;
  apply: () => Promise<void>;
}

/** Plans the `.afk/` writes for these settings; `undefined` when the files already match. */
export async function planLibrarySettings(home: string, settings: Settings): Promise<LibrarySettingsChange | undefined> {
  const library = new Library(home), root = library.root;
  const current = await currentFiles(root);
  const desired = await desiredFiles(library, settings, current);
  const changes: { path: string; before?: string; after?: string }[] = [];
  for (const [path, after] of desired) if (current.get(path) !== after) changes.push({ path, ...(current.has(path) ? { before: current.get(path)! } : {}), after });
  for (const [path, before] of current) if (!desired.has(path)) changes.push({ path, before });
  if (!changes.length) return undefined;
  return {
    message: describe(changes),
    apply: async () => {
      for (const { path, after } of changes) {
        const file = join(root, path);
        if (after === undefined) { await rm(file, { force: true }); continue; }
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.${process.pid}.tmp`, after);
        await rename(`${file}.${process.pid}.tmp`, file);
      }
    },
  };
}
