import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { localAfkDir, localManifestDir, projectManifestDir } from "../manifest.js";

export const skillProfilesFileName = "profiles.json";
export const skillProfilesStateFileName = "skill-profiles.json";

export type SkillProfileItem = {
  id: string;
  name: string;
  skills: string[];
};

export type SkillProfileCatalog = {
  version: number;
  alwaysOn: string[];
  items: SkillProfileItem[];
};

export type SkillProfileState = {
  version: number;
  enabledProfileIds: string[];
  profileMovedSkills: string[];
  preExistingDisabledSkills: string[];
};

export type SkillProfileContext = {
  homeDir: string;
  cwd: string;
  local: boolean;
};

export type SkillProfilePaths = {
  catalogPath: string;
  statePath: string;
  skillsRoot: string;
  disabledRoot: string;
};

export type SkillProfileMovement = {
  folder: string;
  source: string;
  destination: string;
  action: "enable" | "disable";
};

export type SkillProfileApplyResult = {
  catalog: SkillProfileCatalog;
  state: SkillProfileState;
  paths: SkillProfilePaths;
  keptSkills: string[];
  movements: SkillProfileMovement[];
  dryRun: boolean;
};

export function skillProfilePaths(context: SkillProfileContext): SkillProfilePaths {
  const catalogDir = context.local ? projectManifestDir(context.cwd) : localManifestDir(context.homeDir);
  const stateDir = context.local ? join(context.cwd, "afk", "state") : join(localAfkDir(context.homeDir), "state");
  const skillsRoot = join(context.homeDir, ".agents", "skills");
  return {
    catalogPath: join(catalogDir, skillProfilesFileName),
    statePath: join(stateDir, skillProfilesStateFileName),
    skillsRoot,
    disabledRoot: join(skillsRoot, ".disabled"),
  };
}

export function loadSkillProfileCatalog(context: SkillProfileContext): SkillProfileCatalog {
  const path = skillProfilePaths(context).catalogPath;
  if (!existsSync(path)) {
    return emptySkillProfileCatalog();
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isSkillProfileCatalog(parsed)) {
    throw new Error(`Invalid skill profiles catalog: ${path}`);
  }

  return normalizeSkillProfileCatalog(parsed);
}

export function loadSkillProfileState(context: SkillProfileContext): SkillProfileState {
  const path = skillProfilePaths(context).statePath;
  if (!existsSync(path)) {
    return emptySkillProfileState();
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isSkillProfileState(parsed)) {
    throw new Error(`Invalid skill profiles state: ${path}`);
  }

  return normalizeSkillProfileState(parsed);
}

export function listSkillProfiles(context: SkillProfileContext): {
  catalog: SkillProfileCatalog;
  state: SkillProfileState;
  paths: SkillProfilePaths;
} {
  return {
    catalog: loadSkillProfileCatalog(context),
    state: loadSkillProfileState(context),
    paths: skillProfilePaths(context),
  };
}

export function upsertSkillProfile(context: SkillProfileContext, input: {
  id: string;
  name?: string;
  skills: string[];
  alwaysOn: string[];
  dryRun: boolean;
}): { catalog: SkillProfileCatalog; paths: SkillProfilePaths; profile: SkillProfileItem; created: boolean; dryRun: boolean } {
  const id = normalizeId(input.id);
  if (!id) {
    throw new Error("Profile id is required.");
  }

  const catalog = loadSkillProfileCatalog(context);
  const existing = catalog.items.find((item) => item.id === id);
  const profile: SkillProfileItem = {
    id,
    name: input.name?.trim() || existing?.name || humanizeProfileId(id),
    skills: input.skills.length > 0 ? uniqueNormalized(input.skills) : existing?.skills ?? [],
  };
  const next: SkillProfileCatalog = {
    ...catalog,
    alwaysOn: uniqueNormalized([...catalog.alwaysOn, ...input.alwaysOn]),
    items: existing
      ? catalog.items.map((item) => item.id === id ? profile : item)
      : [...catalog.items, profile].sort((left, right) => left.id.localeCompare(right.id)),
  };

  if (!input.dryRun) {
    writeSkillProfileCatalog(context, next);
  }

  return {
    catalog: next,
    paths: skillProfilePaths(context),
    profile,
    created: !existing,
    dryRun: input.dryRun,
  };
}

export function deleteSkillProfile(context: SkillProfileContext, idValue: string, dryRun: boolean): {
  catalog: SkillProfileCatalog;
  paths: SkillProfilePaths;
  removed: SkillProfileItem;
  dryRun: boolean;
} {
  const id = normalizeId(idValue);
  const catalog = loadSkillProfileCatalog(context);
  const removed = catalog.items.find((item) => item.id === id);
  if (!removed) {
    throw new Error(`Skill profile not found: ${idValue}`);
  }

  const next = {
    ...catalog,
    items: catalog.items.filter((item) => item.id !== id),
  };

  if (!dryRun) {
    writeSkillProfileCatalog(context, next);
  }

  return { catalog: next, paths: skillProfilePaths(context), removed, dryRun };
}

export function enableSkillProfile(context: SkillProfileContext, idValue: string, dryRun: boolean): SkillProfileApplyResult {
  const id = normalizeId(idValue);
  const catalog = loadSkillProfileCatalog(context);
  if (!catalog.items.some((item) => item.id === id)) {
    throw new Error(`Skill profile not found: ${idValue}`);
  }

  const current = loadSkillProfileState(context);
  const state = {
    ...current,
    enabledProfileIds: uniqueNormalized([...current.enabledProfileIds, id]),
  };

  return applySkillProfileState(context, catalog, state, dryRun);
}

export function disableSkillProfile(context: SkillProfileContext, idValue: string, dryRun: boolean): SkillProfileApplyResult {
  const id = normalizeId(idValue);
  const catalog = loadSkillProfileCatalog(context);
  const current = loadSkillProfileState(context);
  if (!current.enabledProfileIds.includes(id) && !catalog.items.some((item) => item.id === id)) {
    throw new Error(`Skill profile not found: ${idValue}`);
  }

  const state = {
    ...current,
    enabledProfileIds: current.enabledProfileIds.filter((profileId) => profileId !== id),
  };

  return applySkillProfileState(context, catalog, state, dryRun);
}

export function skillProfileStatus(context: SkillProfileContext): SkillProfileApplyResult {
  const catalog = loadSkillProfileCatalog(context);
  const state = loadSkillProfileState(context);
  return {
    catalog,
    state,
    paths: skillProfilePaths(context),
    keptSkills: keptSkillsFor(catalog, state),
    movements: [],
    dryRun: false,
  };
}

function applySkillProfileState(
  context: SkillProfileContext,
  catalog: SkillProfileCatalog,
  requestedState: SkillProfileState,
  dryRun: boolean,
): SkillProfileApplyResult {
  const paths = skillProfilePaths(context);
  const currentState = loadSkillProfileState(context);
  const active = existingSkillFolders(paths.skillsRoot);
  const disabled = existingSkillFolders(paths.disabledRoot);
  const kept = new Set(keptSkillsFor(catalog, requestedState).map((skill) => skill.toLowerCase()));
  const hasEnabledProfiles = requestedState.enabledProfileIds.length > 0;
  const moved = new Set(currentState.profileMovedSkills.map((skill) => skill.toLowerCase()));
  const preExistingDisabled = new Set([
    ...currentState.preExistingDisabledSkills,
    ...disabled.filter((folder) => !moved.has(folder.toLowerCase())),
  ].map((skill) => skill.toLowerCase()));
  const profileMoved = new Set(currentState.profileMovedSkills);
  const movements: SkillProfileMovement[] = [];

  for (const folder of active) {
    const normalized = folder.toLowerCase();
    const shouldReturnToDisabled = preExistingDisabled.has(normalized) && !kept.has(normalized);
    if (!hasEnabledProfiles && !shouldReturnToDisabled) {
      continue;
    }

    if (kept.has(normalized)) {
      continue;
    }

    movements.push({
      folder,
      source: join(paths.skillsRoot, folder),
      destination: join(paths.disabledRoot, folder),
      action: "disable",
    });
    if (!preExistingDisabled.has(normalized)) {
      profileMoved.add(folder);
    }
  }

  for (const folder of disabled) {
    const normalized = folder.toLowerCase();
    const wasProfileMoved = moved.has(normalized);
    const wasPreExistingDisabled = preExistingDisabled.has(normalized);
    const shouldRestoreMoved = wasProfileMoved && (!hasEnabledProfiles || kept.has(normalized));
    const shouldBorrowPreDisabled = wasPreExistingDisabled && hasEnabledProfiles && kept.has(normalized);
    if (!shouldRestoreMoved && !shouldBorrowPreDisabled) {
      continue;
    }

    movements.push({
      folder,
      source: join(paths.disabledRoot, folder),
      destination: join(paths.skillsRoot, folder),
      action: "enable",
    });
    profileMoved.delete(folder);
  }

  const nextState: SkillProfileState = {
    version: 1,
    enabledProfileIds: requestedState.enabledProfileIds,
    profileMovedSkills: hasEnabledProfiles
      ? [...profileMoved].filter((folder) => !kept.has(folder.toLowerCase())).sort()
      : [],
    preExistingDisabledSkills: [...preExistingDisabled].sort(),
  };

  if (!dryRun) {
    applySkillProfileMovements(movements);
    writeSkillProfileState(context, nextState);
  }

  return {
    catalog,
    state: nextState,
    paths,
    keptSkills: [...kept].sort(),
    movements,
    dryRun,
  };
}

function applySkillProfileMovements(movements: SkillProfileMovement[]): void {
  for (const movement of movements) {
    if (existsSync(movement.destination)) {
      throw new Error(`Could not ${movement.action} ${movement.folder}; destination already exists: ${movement.destination}`);
    }
  }

  for (const movement of movements) {
    if (!existsSync(movement.source)) {
      continue;
    }
    mkdirSync(dirname(movement.destination), { recursive: true });
    renameSync(movement.source, movement.destination);
  }
}

function writeSkillProfileCatalog(context: SkillProfileContext, catalog: SkillProfileCatalog): void {
  const path = skillProfilePaths(context).catalogPath;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalizeSkillProfileCatalog(catalog), null, 2)}\n`);
}

function writeSkillProfileState(context: SkillProfileContext, state: SkillProfileState): void {
  const path = skillProfilePaths(context).statePath;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalizeSkillProfileState(state), null, 2)}\n`);
}

function keptSkillsFor(catalog: SkillProfileCatalog, state: SkillProfileState): string[] {
  const enabled = new Set(state.enabledProfileIds);
  return uniqueNormalized([
    ...catalog.alwaysOn,
    ...catalog.items
      .filter((profile) => enabled.has(profile.id))
      .flatMap((profile) => profile.skills),
  ]);
}

function existingSkillFolders(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSafe(root)
    .filter((entry) => !entry.startsWith("."))
    .sort((left, right) => left.localeCompare(right));
}

function readdirSafe(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function emptySkillProfileCatalog(): SkillProfileCatalog {
  return { version: 1, alwaysOn: [], items: [] };
}

function emptySkillProfileState(): SkillProfileState {
  return { version: 1, enabledProfileIds: [], profileMovedSkills: [], preExistingDisabledSkills: [] };
}

function normalizeSkillProfileCatalog(catalog: SkillProfileCatalog): SkillProfileCatalog {
  return {
    version: Math.max(catalog.version, 1),
    alwaysOn: uniqueNormalized(catalog.alwaysOn),
    items: catalog.items.map((item) => ({
      id: normalizeId(item.id),
      name: item.name.trim() || humanizeProfileId(item.id),
      skills: uniqueNormalized(item.skills),
    })).filter((item) => item.id).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function normalizeSkillProfileState(state: SkillProfileState): SkillProfileState {
  return {
    version: Math.max(state.version, 1),
    enabledProfileIds: uniqueNormalized(state.enabledProfileIds),
    profileMovedSkills: uniqueNormalized(state.profileMovedSkills),
    preExistingDisabledSkills: uniqueNormalized(state.preExistingDisabledSkills),
  };
}

function isSkillProfileCatalog(value: unknown): value is SkillProfileCatalog {
  return isRecord(value) &&
    typeof value.version === "number" &&
    Array.isArray(value.alwaysOn) &&
    value.alwaysOn.every((item) => typeof item === "string") &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Array.isArray(item.skills) &&
      item.skills.every((skill) => typeof skill === "string")
    );
}

function isSkillProfileState(value: unknown): value is SkillProfileState {
  return isRecord(value) &&
    typeof value.version === "number" &&
    Array.isArray(value.enabledProfileIds) &&
    value.enabledProfileIds.every((item) => typeof item === "string") &&
    Array.isArray(value.profileMovedSkills) &&
    value.profileMovedSkills.every((item) => typeof item === "string") &&
    Array.isArray(value.preExistingDisabledSkills) &&
    value.preExistingDisabledSkills.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map(normalizeId).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase();
}

function humanizeProfileId(id: string): string {
  return id
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
