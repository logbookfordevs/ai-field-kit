import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { localAfkDir, localManifestDir, projectManifestDir, type SkillManifestItem } from "../manifest.js";
import type { CliOptions, SkillProfileMode } from "../types.js";

export const skillProfilesFileName = "profiles.json";
export const skillProfilesStateFileName = "skill-profiles.json";

export type SkillProfileItem = {
  id: string;
  name: string;
  catalogSkills: string[];
  packages: SkillProfilePackage[];
};

export type SkillProfilePackage = {
  source: string;
  skills?: string[];
};

export type SkillProfileCatalog = {
  version: number;
  mode: SkillProfileMode;
  alwaysOn: string[];
  skillAliases?: Record<string, string>;
  items: SkillProfileItem[];
};

export type SkillProfileActivationMode = "focus" | "additive";

export type SkillProfileActivation = {
  profileId: string;
  mode: SkillProfileActivationMode;
};

export type SkillProfileState = {
  version: number;
  activations: SkillProfileActivation[];
  profileMovedSkills: string[];
  preExistingDisabledSkills: string[];
};

type StoredSkillProfileState = {
  version: number;
  activations?: SkillProfileActivation[];
  enabledProfileIds?: string[];
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
  profileChange?: {
    action: "enable" | "disable";
    profileId: string;
  };
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

export function loadSetupSkillProfileCatalog(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "manifestLocal" | "manifestContents">): SkillProfileCatalog {
  const content = options.manifestContents?.[skillProfilesFileName];
  if (content) {
    const parsed = JSON.parse(content) as unknown;
    if (!isSkillProfileCatalog(parsed)) {
      throw new Error("Invalid skill profiles catalog from setup source");
    }
    return normalizeSkillProfileCatalog(parsed);
  }
  return loadSkillProfileCatalog(skillProfileContext(options));
}

export function skillProfileContext(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "manifestLocal">): SkillProfileContext {
  return {
    homeDir: options.homeDir,
    cwd: options.cwd,
    local: options.setupScope === "project" || options.manifestLocal,
  };
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
  mode?: SkillProfileMode;
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
    catalogSkills: input.skills.length > 0 ? uniqueNormalized(input.skills) : existing?.catalogSkills ?? [],
    packages: existing?.packages ?? [],
  };
  const next: SkillProfileCatalog = {
    ...catalog,
    mode: input.mode ?? catalog.mode,
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

export function appendSkillsToSkillProfile(context: SkillProfileContext, input: {
  id: string;
  skills: string[];
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
    name: existing?.name || humanizeProfileId(id),
    catalogSkills: uniqueNormalized([...(existing?.catalogSkills ?? []), ...input.skills]),
    packages: existing?.packages ?? [],
  };
  const next: SkillProfileCatalog = {
    ...catalog,
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

export function enableSkillProfile(
  context: SkillProfileContext,
  idValue: string,
  dryRun: boolean,
  mode: SkillProfileActivationMode = "additive",
): SkillProfileApplyResult {
  const id = normalizeId(idValue);
  const catalog = loadSkillProfileCatalog(context);
  if (!catalog.items.some((item) => item.id === id)) {
    throw new Error(`Skill profile not found: ${idValue}`);
  }

  const current = loadSkillProfileState(context);
  const existingActivation = current.activations.find((activation) => activation.profileId === id);
  if (existingActivation && existingActivation.mode !== mode) {
    throw new Error(
      `Skill profile ${id} is already enabled in ${existingActivation.mode} mode. Disable it before enabling it in ${mode} mode.`,
    );
  }
  const state = {
    ...current,
    activations: existingActivation
      ? current.activations
      : normalizeSkillProfileActivations([...current.activations, { profileId: id, mode }]),
  };

  return applySkillProfileState(context, catalog, state, dryRun, {
    action: "enable",
    profileId: id,
  });
}

export function disableSkillProfile(context: SkillProfileContext, idValue: string, dryRun: boolean): SkillProfileApplyResult {
  const id = normalizeId(idValue);
  const catalog = loadSkillProfileCatalog(context);
  const current = loadSkillProfileState(context);
  if (!current.activations.some((activation) => activation.profileId === id) && !catalog.items.some((item) => item.id === id)) {
    throw new Error(`Skill profile not found: ${idValue}`);
  }

  const state = {
    ...current,
    activations: current.activations.filter((activation) => activation.profileId !== id),
  };

  return applySkillProfileState(context, catalog, state, dryRun, {
    action: "disable",
    profileId: id,
  });
}

export function skillProfileStatus(context: SkillProfileContext): SkillProfileApplyResult {
  const catalog = loadSkillProfileCatalog(context);
  const state = loadSkillProfileState(context);
  const paths = skillProfilePaths(context);
  return {
    catalog,
    state,
    paths,
    keptSkills: keptSkillsFor(catalog, state, paths.catalogPath),
    movements: [],
    dryRun: false,
  };
}

export function reconcileSkillProfiles(context: SkillProfileContext, dryRun: boolean): SkillProfileApplyResult {
  return applySkillProfileState(
    context,
    loadSkillProfileCatalog(context),
    loadSkillProfileState(context),
    dryRun,
  );
}

function applySkillProfileState(
  context: SkillProfileContext,
  catalog: SkillProfileCatalog,
  requestedState: SkillProfileState,
  dryRun: boolean,
  profileChange?: SkillProfileApplyResult["profileChange"],
): SkillProfileApplyResult {
  const paths = skillProfilePaths(context);
  const currentState = loadSkillProfileState(context);
  const active = existingSkillFolders(paths.skillsRoot);
  const disabled = existingSkillFolders(paths.disabledRoot);
  const autoInvocationBySkill = skillAutoInvocationById(paths.catalogPath);
  const kept = new Set(keptSkillsFor(catalog, requestedState, paths.catalogPath).map((skill) => skill.toLowerCase()));
  const hasEnabledProfiles = requestedState.activations.length > 0;
  const hasEnabledFocusProfiles = requestedState.activations.some((activation) => activation.mode === "focus");
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
    if (!hasEnabledFocusProfiles && !shouldReturnToDisabled) {
      continue;
    }

    if (kept.has(normalized)) {
      continue;
    }

    if (!shouldProfileDisableSkill(folder, catalog.mode, autoInvocationBySkill) && !shouldReturnToDisabled) {
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
    const shouldRestoreMoved = wasProfileMoved && (
      !hasEnabledFocusProfiles ||
      kept.has(normalized) ||
      !shouldProfileDisableSkill(folder, catalog.mode, autoInvocationBySkill)
    );
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
    version: 2,
    activations: requestedState.activations,
    profileMovedSkills: hasEnabledFocusProfiles
      ? [...profileMoved]
        .filter((folder) => !kept.has(folder.toLowerCase()))
        .filter((folder) => shouldProfileDisableSkill(folder, catalog.mode, autoInvocationBySkill))
        .sort()
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
    ...(profileChange ? { profileChange } : {}),
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
  writeFileSync(path, `${JSON.stringify({ ...normalizeSkillProfileCatalog(catalog), version: 2 }, null, 2)}\n`);
}

function writeSkillProfileState(context: SkillProfileContext, state: SkillProfileState): void {
  const path = skillProfilePaths(context).statePath;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalizeSkillProfileState(state), null, 2)}\n`);
}

function keptSkillsFor(catalog: SkillProfileCatalog, state: SkillProfileState, catalogPath?: string): string[] {
  const enabled = new Set(enabledSkillProfileIds(state));
  return uniqueNormalized([
    ...catalog.alwaysOn,
    ...catalog.items
      .filter((profile) => enabled.has(profile.id))
      .flatMap((profile) => resolvedProfileSkillIds(profile, catalogPath)),
  ]);
}

export function resolvedProfileSkillIds(profile: SkillProfileItem, profileCatalogPath?: string): string[] {
  if (!profileCatalogPath || profile.packages.length === 0) {
    return profile.catalogSkills;
  }

  const packageSkills = skillManifestItems(profileCatalogPath).flatMap((item) => profile.packages.some((profilePackage) => (
    profilePackage.source === item.source &&
    (profilePackage.skills === undefined || profilePackage.skills.includes(skillIdFromManifestItem(item)))
  )) ? [item.id] : []);
  return uniqueNormalized([...profile.catalogSkills, ...packageSkills]);
}

export function enabledSkillProfileIds(state: SkillProfileState): string[] {
  return state.activations.map((activation) => activation.profileId);
}

function shouldProfileDisableSkill(folder: string, mode: SkillProfileMode, autoInvocationBySkill: Map<string, boolean>): boolean {
  if (mode === "strict") {
    return true;
  }

  return autoInvocationBySkill.get(folder.toLowerCase()) !== false;
}

function skillAutoInvocationById(profileCatalogPath: string): Map<string, boolean> {
  return new Map(skillManifestItems(profileCatalogPath).map((item) => [item.id.toLowerCase(), item.autoInvocation !== false]));
}

function skillManifestItems(profileCatalogPath: string): SkillManifestItem[] {
  const skillsCatalogPath = join(dirname(profileCatalogPath), "skills.json");
  if (!existsSync(skillsCatalogPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(skillsCatalogPath, "utf8")) as { items?: unknown[] };
    return (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((item): item is SkillManifestItem => isRecord(item) && typeof item.id === "string" && typeof item.source === "string");
  } catch {
    return [];
  }
}

function skillIdFromManifestItem(item: SkillManifestItem): string {
  const skillIndex = item.args.indexOf("--skill");
  return (skillIndex >= 0 ? item.args[skillIndex + 1] : undefined) ?? item.id;
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
  return { version: 2, mode: "strict", alwaysOn: [], skillAliases: {}, items: [] };
}

function emptySkillProfileState(): SkillProfileState {
  return { version: 2, activations: [], profileMovedSkills: [], preExistingDisabledSkills: [] };
}

function normalizeSkillProfileCatalog(catalog: SkillProfileCatalog): SkillProfileCatalog {
  return {
    version: Math.max(catalog.version, 1),
    mode: catalog.mode === "context" ? "context" : "strict",
    alwaysOn: uniqueNormalized(catalog.alwaysOn),
    skillAliases: normalizeSkillAliases(catalog.skillAliases),
    items: catalog.items.map((item) => ({
      id: normalizeId(item.id),
      name: item.name.trim() || humanizeProfileId(item.id),
      catalogSkills: uniqueNormalized(item.catalogSkills ?? (item as SkillProfileItem & { skills?: string[] }).skills ?? []),
      packages: normalizeSkillProfilePackages(item.packages ?? []),
    })).filter((item) => item.id).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function normalizeSkillProfilePackages(packages: SkillProfilePackage[]): SkillProfilePackage[] {
  return packages
    .map((item) => ({
      source: item.source.trim(),
      ...(item.skills === undefined ? {} : { skills: uniqueNormalized(item.skills) }),
    }))
    .filter((item) => item.source)
    .sort((left, right) => left.source.localeCompare(right.source));
}

function normalizeSkillAliases(aliases: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(aliases ?? {})
    .map(([id, upstreamId]) => [normalizeId(id), upstreamId.trim()] as const)
    .filter(([id, upstreamId]) => Boolean(id && upstreamId))
    .sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeSkillProfileState(state: StoredSkillProfileState): SkillProfileState {
  const activations = state.activations ?? state.enabledProfileIds?.map((profileId) => ({ profileId, mode: "focus" as const })) ?? [];
  return {
    version: Math.max(state.version, 2),
    activations: normalizeSkillProfileActivations(activations),
    profileMovedSkills: uniqueNormalized(state.profileMovedSkills),
    preExistingDisabledSkills: uniqueNormalized(state.preExistingDisabledSkills),
  };
}

function normalizeSkillProfileActivations(activations: SkillProfileActivation[]): SkillProfileActivation[] {
  const byProfileId = new Map<string, SkillProfileActivationMode>();
  for (const activation of activations) {
    const profileId = normalizeId(activation.profileId);
    if (profileId) {
      byProfileId.set(profileId, activation.mode);
    }
  }

  return [...byProfileId]
    .map(([profileId, mode]) => ({ profileId, mode }))
    .sort((left, right) => left.profileId.localeCompare(right.profileId));
}

function isSkillProfileCatalog(value: unknown): value is SkillProfileCatalog {
  return isRecord(value) &&
    typeof value.version === "number" &&
    (value.mode === undefined || value.mode === "strict" || value.mode === "context") &&
    Array.isArray(value.alwaysOn) &&
    value.alwaysOn.every((item) => typeof item === "string") &&
    (value.skillAliases === undefined || (
      isRecord(value.skillAliases) &&
      Object.values(value.skillAliases).every((upstreamId) => typeof upstreamId === "string")
    )) &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      ((value.version as number) >= 2
        ? isStringArray(item.catalogSkills) && item.skills === undefined &&
          (item.packages === undefined || isSkillProfilePackages(item.packages))
        : isStringArray(item.skills) && item.catalogSkills === undefined && item.packages === undefined)
    );
}

function isSkillProfilePackages(value: unknown): value is SkillProfilePackage[] {
  return Array.isArray(value) && value.every((profilePackage) =>
    isRecord(profilePackage) &&
    typeof profilePackage.source === "string" &&
    (profilePackage.skills === undefined || isStringArray(profilePackage.skills))
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSkillProfileState(value: unknown): value is StoredSkillProfileState {
  return isRecord(value) &&
    typeof value.version === "number" &&
    (
      (
        Array.isArray(value.activations) &&
        value.activations.every((activation) =>
          isRecord(activation) &&
          typeof activation.profileId === "string" &&
          (activation.mode === "focus" || activation.mode === "additive")
        )
      ) ||
      (
        value.activations === undefined &&
        Array.isArray(value.enabledProfileIds) &&
        value.enabledProfileIds.every((item) => typeof item === "string")
      )
    ) &&
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
