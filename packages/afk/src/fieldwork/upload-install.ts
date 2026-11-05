import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addToCore, kitStatus, toolOwner } from "./kit.js";
import { storeSkills, type StagedSkill } from "./library-install.js";
import { expandPath, profileGroups, skillName, UPLOADED_SOURCE, type Profile, type ProfileGroup, type Settings, type SettingsStore } from "./settings.js";
import { MAX_UPLOAD_BYTES, stageUpload, type UploadSource, type UploadedSkill } from "./skill-upload.js";
import type { SkillLibrary } from "./skills.js";

export interface UploadCandidate {
  name: string;
  description: string;
  files: number;
  bytes: number;
  state: "new" | "installed" | "tool";
  installedFrom?: string;
  tool?: string;
}

export interface UploadPack {
  /** Builds the pack definition for these groups, merging groups of the same source. */
  define(existing: Profile | undefined, id: string, name: string, groups: ProfileGroup[]): Profile;
  /** Saves the pack, relinking it where it is on. */
  save(settings: Settings, pack: Profile): Promise<void>;
}

interface Held { id: string; directory: string; skills: UploadedSkill[] }

const maximumEncoded = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4;

function decode(value: unknown, label: string): Buffer {
  if (typeof value !== "string" || value.length > maximumEncoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`${label} is not valid or is too large. Skills can total at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  return Buffer.from(value, "base64");
}

function source(data: Record<string, unknown>, home: string): UploadSource {
  const given = (["archive", "files", "folder"] as const).filter(key => data[key] !== undefined);
  if (given.length !== 1) throw new Error(given.length ? "Choose one upload: a zip or .skill file, or a folder." : "Choose a zip, a .skill file or a folder to upload.");
  if (given[0] === "archive") return { archive: decode(data.archive, "The archive") };
  if (given[0] === "folder") {
    if (typeof data.folder !== "string" || !data.folder.trim()) throw new Error("Choose a folder.");
    return { folder: expandPath(data.folder.trim(), home) };
  }
  if (!Array.isArray(data.files) || !data.files.length) throw new Error("Choose a folder with files in it.");
  return { files: data.files.map(file => {
    const item = file as { path?: unknown; base64?: unknown; executable?: unknown };
    if (typeof item?.path !== "string") throw new Error("Each uploaded file needs a path.");
    return { path: item.path, data: decode(item.base64, item.path), executable: item.executable === true };
  }) };
}

/** Uploaded skills: staged in a temporary folder for review, then saved through the same storage path as repository installs. */
export class Uploads {
  private held: Held | undefined;

  constructor(private readonly store: SettingsStore, private readonly skills: SkillLibrary, private readonly packs: UploadPack) {}

  async close(): Promise<void> {
    const held = this.held;
    this.held = undefined;
    if (held) await rm(held.directory, { recursive: true, force: true });
  }

  async preview(data: Record<string, unknown>): Promise<{ upload: string; candidates: UploadCandidate[] }> {
    const upload = source(data, this.store.home);
    const directory = await mkdtemp(join(tmpdir(), "afk-upload-"));
    let skills: UploadedSkill[];
    try { skills = await stageUpload(upload, directory); }
    catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
    await this.close();
    const id = randomUUID();
    this.held = { id, directory, skills };

    const settings = await this.store.read();
    const inventory = await this.skills.inventory(settings, "Global");
    const candidates = skills.map(({ name, description, files, bytes }): UploadCandidate => {
      const tool = toolOwner(settings, name), entry = inventory.find(item => item.name === name);
      return { name, description, files, bytes, state: tool ? "tool" : entry ? "installed" : "new", ...(tool ? { tool: tool.name } : {}), ...(!tool && entry?.source ? { installedFrom: entry.source } : {}) };
    });
    return { upload: id, candidates };
  }

  async install(data: Record<string, unknown>): Promise<unknown> {
    const { store } = this;
    const held = this.held;
    if (!held || held.id !== data.upload) throw new Error("That upload is no longer available. Choose the file again.");
    const names = Array.isArray(data.names) ? data.names : [];
    if (!names.length || !names.every(skillName) || new Set(names).size !== names.length) throw new Error("Choose at least one skill, each once.");
    const replace = data.replace === undefined ? [] : data.replace;
    if (!Array.isArray(replace) || !replace.every(skillName)) throw new Error("Provide replace as an array of skill names.");
    const settings = await store.read();
    const to = String(data.to);
    const pack = settings.profiles.find(profile => profile.id === to);
    if (!["core", "machine", "new-pack"].includes(to) && !pack) throw new Error("Choose a destination: Core, a pack or this machine. Uploaded skills can't go to Try later.");
    const packName = typeof data.packName === "string" ? data.packName.trim() : "";
    if (to === "new-pack" && !packName) throw new Error("Name the new pack.");

    const inventory = await this.skills.inventory(settings, "Global");
    for (const name of names) {
      if (!held.skills.some(skill => skill.name === name)) throw new Error(`${name} is not in this upload.`);
      const tool = toolOwner(settings, name);
      if (tool) throw new Error(`${name} is installed by ${tool.name}. Use that tool instead.`);
    }
    const taken = names.filter(name => inventory.some(item => item.name === name) && !replace.includes(name));
    if (taken.length) throw new Error(`Already installed: ${taken.join(", ")}. Choose to replace ${taken.length === 1 ? "it" : "them"}, or leave ${taken.length === 1 ? "it" : "them"} out.`);
    if (!await this.skills.library.exists()) throw new Error("Set up your AFK library first. Uploaded skills are saved in it.");

    const staged: StagedSkill[] = names.map(name => ({ name, path: held.skills.find(skill => skill.name === name)!.path }));
    const finish = async (extra: Record<string, unknown> = {}): Promise<unknown> => {
      await this.close();
      const latest = await store.read();
      return { ok: true, to, ...extra, status: kitStatus(latest, await this.skills.inventory(latest, "Global")) };
    };

    if (to === "new-pack" || pack) {
      const fresh = names.filter(name => !pack?.skills.includes(name));
      const id = pack?.id ?? "profile-" + randomUUID();
      await this.skills.library.change(`Install ${names.join(", ")}`, async () => {
        await storeSkills(store, staged, { destination: "library", packMember: true });
        if (!fresh.length) return;
        const latest = await store.read();
        const existing = latest.profiles.find(profile => profile.id === id);
        const groups = existing ? profileGroups(existing).map(group => ({ source: group.source, skills: [...group.skills] })) : [];
        const known = groups.find(group => group.source === UPLOADED_SOURCE);
        if (known) known.skills.push(...fresh);
        else groups.push({ source: UPLOADED_SOURCE, skills: fresh });
        const next = this.packs.define(existing, id, existing?.name ?? packName, groups);
        next.ready = true;
        latest.machineOnly = latest.machineOnly.filter(name => !fresh.includes(name));
        await this.packs.save(latest, next);
      });
      return await finish({ id });
    }

    await storeSkills(store, staged, {
      destination: to === "core" ? "library" : "machine",
      finalize: target => {
        if (to === "core") {
          for (const name of names) addToCore(target, name, UPLOADED_SOURCE);
          target.machineOnly = target.machineOnly.filter(name => !names.includes(name));
        } else target.machineOnly = [...new Set([...target.machineOnly, ...names])];
      },
    });
    return await finish();
  }
}
