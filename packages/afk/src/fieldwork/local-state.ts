import { createHash } from "node:crypto";
import { lstat, readFile, readlink, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { expandPath, type Settings } from "./settings.js";

export interface LocalState {
  version: 1;
  projectPaths?: Record<string, string>;
  profiles: Record<string, { definition: string; enabled: string[]; ready: boolean }>;
  preferences: Settings["preferences"];
  managedLinks: Settings["managedLinks"];
  independentSkills: Settings["independentSkills"];
  ruleReceipts: NonNullable<Settings["agentRules"]>["receipts"];
}

export function definition(profile: Settings["profiles"][number]): string {
  return createHash("sha256").update(JSON.stringify([profile.source, profile.skills])).digest("hex");
}

export function localState(settings: Settings, home: string): LocalState {
  return {
    version: 1,
    projectPaths: Object.fromEntries(settings.projects.map(project => [project.name, expandPath(project.path, home)])),
    profiles: Object.fromEntries(settings.profiles.map(profile => [profile.id, { definition: definition(profile), enabled: profile.enabled, ready: profile.ready }])),
    preferences: settings.preferences,
    managedLinks: settings.managedLinks,
    independentSkills: settings.independentSkills,
    ruleReceipts: settings.agentRules?.receipts ?? {},
  };
}

export function portableSettings(settings: Settings): Record<string, unknown> {
  const { preferences: _preferences, managedLinks: _links, independentSkills: _skills, ...portable } = structuredClone(settings);
  return {
    ...portable,
    profiles: portable.profiles.map(({ enabled: _enabled, ready: _ready, ...profile }) => profile),
    ...(portable.agentRules ? { agentRules: { destinations: portable.agentRules.destinations } } : {}),
  };
}

export function applyLocalState(settings: Settings, state: LocalState | undefined, home: string): Settings {
  const scopes = new Set(["Global", ...settings.projects.filter(project => state?.projectPaths?.[project.name] === expandPath(project.path, home)).map(project => project.name)]);
  for (const profile of settings.profiles) {
    const saved = state?.profiles[profile.id];
    const matches = saved?.definition === definition(profile);
    profile.enabled = matches ? saved.enabled.filter(scope => scopes.has(scope)) : [];
    profile.ready = matches ? saved.ready : false;
  }
  settings.managedLinks = state?.managedLinks ?? {};
  settings.independentSkills = state?.independentSkills ?? {};
  settings.preferences = state?.preferences ?? {};
  if (settings.agentRules) settings.agentRules.receipts = state?.ruleReceipts ?? {};
  return settings;
}

export async function verifiedLegacyState(settings: Settings, home: string): Promise<LocalState> {
  const state = localState(settings, home);
  state.managedLinks = {};
  for (const [path, target] of Object.entries(settings.managedLinks)) {
    try {
      if (target.startsWith(join(home, ".agents/skills") + "/") && (await lstat(path)).isSymbolicLink() && resolve(dirname(path), await readlink(path)) === target) state.managedLinks[path] = target;
    } catch { /* Missing links cannot establish local ownership. */ }
  }
  for (const profile of settings.profiles) {
    const saved = state.profiles[profile.id]!;
    saved.ready = (await Promise.all(profile.skills.map(async name => {
      for (const path of [join(home, ".agents/skills", name), join(home, ".agents/skills/.disabled", name)]) {
        try { await readFile(join(path, "SKILL.md")); return true; } catch { /* Try the other storage location. */ }
      }
      return false;
    }))).every(Boolean);
    saved.enabled = [];
    for (const scope of profile.enabled) {
      const project = settings.projects.find(project => project.name === scope);
      const root = scope === "Global" ? join(home, ".agents/skills") : project ? join(expandPath(project.path, home), ".agents/skills") : undefined;
      if (!root) continue;
      const matches = await Promise.all(profile.skills.map(async name => {
        try {
          const path = join(root, name);
          const target = await realpath(path);
          return target === await realpath(join(home, ".agents/skills/.disabled", name)) && Boolean(state.managedLinks[path]);
        } catch { return false; }
      }));
      if (matches.every(Boolean)) saved.enabled.push(scope);
    }
  }
  state.independentSkills = Object.fromEntries(await Promise.all(Object.entries(state.independentSkills).map(async ([scope, names]) => {
    const project = settings.projects.find(project => project.name === scope);
    const root = scope === "Global" ? join(home, ".agents/skills") : project ? join(expandPath(project.path, home), ".agents/skills") : undefined;
    const present = await Promise.all(names.map(async name => {
      try { if (root) { await readFile(join(root, name, "SKILL.md")); return name; } } catch { /* Missing skills are not active here. */ }
      return undefined;
    }));
    return [scope, present.filter((name): name is string => name !== undefined)] as const;
  })));
  state.ruleReceipts = {};
  for (const destination of settings.agentRules?.destinations ?? []) {
    const receipt = settings.agentRules?.receipts[destination.id];
    if (!receipt?.region) continue;
    try {
      const path = expandPath(destination.path, home);
      if (!(await readFile(path, "utf8")).includes(receipt.region)) continue;
      const root = join(dirname(path), "afk-rules", destination.id);
      const matches = await Promise.all(Object.entries(receipt.references).map(async ([file, content]) => await readFile(join(root, file), "utf8") === content));
      if (matches.every(Boolean)) state.ruleReceipts[destination.id] = receipt;
    } catch { /* Foreign or missing destinations cannot establish rule ownership. */ }
  }
  return state;
}
