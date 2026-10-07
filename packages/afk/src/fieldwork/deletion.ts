import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, readFile, readlink, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { SkillLibrary, type SkillEntry } from "./skills.js";
import { skillName, type Settings, type SettingsStore } from "./settings.js";

async function fingerprint(path: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(current: string): Promise<void> {
    const info = await lstat(current);
    hash.update(JSON.stringify([current, info.ino, info.mtimeMs, info.mode]));
    if (info.isSymbolicLink()) hash.update(await readlink(current));
    else if (info.isDirectory()) {
      for (const name of (await readdir(current)).sort()) await walk(join(current, name));
    } else if (info.isFile()) hash.update(await readFile(current));
    else throw new Error("This skill contains an unsupported file type. Remove it manually.");
  }
  await walk(path);
  return hash.digest("hex");
}

async function pointsTo(path: string, target: string): Promise<boolean> {
  try { return await realpath(path) === target; }
  catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

async function entryAddress(path: string): Promise<string> {
  return join(await realpath(dirname(path)), basename(path));
}

export async function previewDeletion(store: SettingsStore, settings: Settings, name: string, scope: string, inventory?: SkillEntry[]) {
  if (!skillName(name)) throw new Error("Invalid skill name.");
  const library = new SkillLibrary(store);
  const entry = (inventory ?? await library.inventory(settings, scope)).find(skill => skill.name === name);
  if (!entry) throw new Error("Skill not found in the selected scope.");
  const root = library.root(settings, scope);
  const path = await realpath(entry.path);
  const entryIsLink = (await lstat(entry.path)).isSymbolicLink();
  const localStoredCopy = join(root, ".disabled", name);
  const ownActiveLink = entry.available && entryIsLink && await pointsTo(localStoredCopy, path)
    && (scope === "Global" || settings.independentSkills[scope]?.includes(name) || settings.managedLinks[entry.path] !== undefined);
  if (entryIsLink && !ownActiveLink) throw new Error("This entry is a link to shared storage. Delete the stored copy in its original scope, usually Global.");
  const storageEntry = ownActiveLink ? localStoredCopy : entry.path;
  if ((await lstat(storageEntry)).isSymbolicLink()) throw new Error("The stored entry is itself a shared link. Delete the physical copy in its original scope.");
  const allowedLinks = new Set([join(root, name), join(root, "../../.claude/skills", name)]);
  const links: { path: string; target: string; fingerprint: string }[] = [];
  const copies: { path: string; fingerprint: string }[] = [];
  const claudePath = join(root, "../../.claude/skills", name);
  let claudeSharesStorage = false;
  if (scope === "Global") {
    try {
      const info = await lstat(claudePath);
      const address = await entryAddress(claudePath);
      const selectedAddress = await entryAddress(entry.path);
      if (address === selectedAddress || address === await entryAddress(storageEntry)) {
        claudeSharesStorage = true;
      } else if (info.isSymbolicLink()) {
        links.push({ path: claudePath, target: await readlink(claudePath), fingerprint: await fingerprint(claudePath) });
      } else if (info.isDirectory() && (await lstat(join(claudePath, "SKILL.md"))).isFile()) {
        copies.push({ path: await realpath(claudePath), fingerprint: await fingerprint(claudePath) });
      } else throw new Error("The matching Claude entry is not a skill folder. Review it manually before deleting.");
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
  }
  const profiles = settings.profiles.filter(profile => profile.skills.includes(name) && profile.enabled.length > 0);
  if (profiles.length) throw new Error(`Disable these profiles before deleting this skill: ${profiles.map(profile => profile.name).join(", ")}.`);
  const candidates = new Set(Object.keys(settings.managedLinks));
  for (const targetScope of ["Global", ...settings.projects.map(project => project.name)]) {
    const root = library.root(settings, targetScope);
    for (const directory of [root, join(root, ".disabled"), join(root, "../../.claude/skills")]) {
      try {
        for (const entry of await readdir(directory)) candidates.add(join(directory, entry));
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      }
    }
  }
  for (const candidate of candidates) {
    const targetPaths = [path, ...copies.map(copy => copy.path)];
    const matches = await Promise.all(targetPaths.map(target => pointsTo(candidate, target)));
    if (!matches.some(Boolean)) continue;
    const address = await entryAddress(candidate);
    const storageAddresses = await Promise.all([storageEntry, ...copies.map(copy => copy.path)].map(entryAddress));
    if (storageAddresses.includes(address)) continue;
    const reviewedLinkAddresses = await Promise.all(links.map(link => entryAddress(link.path)));
    if (reviewedLinkAddresses.includes(address)) continue;
    const info = await lstat(candidate);
    const target = info.isSymbolicLink() ? await readlink(candidate) : "";
    const receipt = settings.managedLinks[candidate];
    const owned = candidate === entry.path && ownActiveLink
      || receipt !== undefined && resolve(candidate, "..", target) === resolve(receipt);
    if (!allowedLinks.has(candidate) || !info.isSymbolicLink() || !owned) {
      throw new Error(`Another entry still uses this storage: ${candidate}. Disable or remove that link first.`);
    }
    links.push({ path: candidate, target, fingerprint: await fingerprint(candidate) });
  }
  links.sort((a, b) => a.path.localeCompare(b.path));
  const retainedCopies: string[] = [];
  for (const other of [join(root, name), localStoredCopy]) {
    try {
      const otherPath = await realpath(other);
      if (otherPath !== path && (await lstat(join(other, "SKILL.md"))).isFile()) retainedCopies.push(otherPath);
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
  }
  return { name, scope, path, available: entry.available, links, copies, claudeSharesStorage, retainedCopies, fingerprint: await fingerprint(path) };
}

export async function deleteSkill(store: SettingsStore, settings: Settings, name: string, scope: string, expected: unknown, confirmed: boolean): Promise<void> {
  if (confirmed !== true) throw new Error("Confirm permanent deletion after reviewing the affected files.");
  const preview = await previewDeletion(store, settings, name, scope);
  if (JSON.stringify(expected) !== JSON.stringify(preview)) throw new Error("The skill changed since review. Start deletion again to review its current files.");
  const staged = join(preview.path, "..", `.afk-delete-${randomUUID()}`);
  const next = structuredClone(settings);
  if (scope === "Global") {
    for (const profile of next.profiles) if (profile.skills.includes(name)) profile.ready = false;
  }
  delete next.preferences[`${scope}|${name}`];
  next.independentSkills[scope] = (next.independentSkills[scope] ?? []).filter(member => member !== name);
  const removedAddresses = await Promise.all([preview.path, ...preview.links.map(link => link.path), ...preview.copies.map(copy => copy.path)].map(entryAddress));
  for (const receipt of Object.keys(next.managedLinks)) {
    try {
      if (removedAddresses.includes(await entryAddress(receipt))) delete next.managedLinks[receipt];
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    }
  }
  const moved: { original: string; staged: string }[] = [];
  try {
    for (const link of preview.links) {
      const backup = join(link.path, "..", `.afk-delete-link-${randomUUID()}`);
      await rename(link.path, backup);
      moved.push({ original: link.path, staged: backup });
      delete next.managedLinks[link.path];
    }
    for (const copy of preview.copies) {
      const backup = join(copy.path, "..", `.afk-delete-copy-${randomUUID()}`);
      await rename(copy.path, backup);
      moved.push({ original: copy.path, staged: backup });
    }
    await rename(preview.path, staged);
    moved.push({ original: preview.path, staged });
    await store.save(next);
  } catch (error) {
    for (const item of moved.reverse()) await rename(item.staged, item.original);
    throw error;
  }
  for (const item of moved) await rm(item.staged, { recursive: true });
}
