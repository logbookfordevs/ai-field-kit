import { createHash } from "node:crypto";
import { definition } from "./local-state.js";
import { skillName, SETTINGS_VERSION, type KitSource, type Profile, type ProfileGroup, type Settings, type Tool } from "./settings.js";
import type { SavedStack } from "./stacks.js";

export interface MigrationChoices {
  core?: string | null;
  follow?: string[];
  skipTools?: string[];
}

export interface MigrationReport {
  stacks: { id: string; name: string; skills: number; becomes: "core" | "pack"; packId?: string; linkedProfile: boolean }[];
  core: { source: string; name?: string; skills: string[]; follow: boolean }[];
  added: { name: string; source: string }[];
  packs: { id: string; name: string; skills: number; new: boolean }[];
  tools: { id: number; name: string; provides: string[]; linked: boolean }[];
  missingHere: string[];
  preserved: { sources: number; tools: number; projects: number; rulesDestinations: number; profiles: number };
  dropped: { savedSkills: number };
  warnings: string[];
}

export interface MachineSkill {
  name: string;
  source?: string;
  available: boolean;
}

export function sourceIdentity(source: string): string {
  return source.trim().replace(/^https?:\/\/github\.com\//, "").replace(/^git@github\.com:/, "").replace(/\.git\/?$/, "").replace(/\/+$/, "").toLowerCase();
}

export function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function toolSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function suggestProvides(tool: Pick<Tool, "name">, installed: string[]): string[] {
  const slug = toolSlug(tool.name);
  return slug ? installed.filter(name => name === slug || name.startsWith(`${slug}-`)) : [];
}

function stackPicks(stack: SavedStack): string[] {
  return stack.manifest.sources.flatMap(group => group.skills);
}

function firstSourceWins(stack: SavedStack, warnings: string[]): { source: string; name: string; skills: string[] }[] {
  const seen = new Map<string, string>();
  const merged = new Map<string, { source: string; name: string; skills: string[] }>();
  for (const group of stack.manifest.sources) {
    const entry = merged.get(group.source) ?? { source: group.source, name: group.name, skills: [] };
    for (const name of group.skills) {
      const earlier = seen.get(name);
      if (earlier === undefined) { seen.set(name, group.source); entry.skills.push(name); }
      else if (earlier !== group.source) warnings.push(`${stack.manifest.name} selects ${name} from both ${earlier} and ${group.source}. Kept ${earlier}.`);
    }
    merged.set(group.source, entry);
  }
  return [...merged.values()].filter(entry => entry.skills.length);
}

function packFromStack(stack: SavedStack, warnings: string[]): Profile {
  const groups = firstSourceWins(stack, warnings);
  const first = groups[0]!;
  const memberGroups: ProfileGroup[] = groups.map(({ source, skills }) => ({ source, skills }));
  return {
    id: `stack-${stack.manifest.id}`,
    name: stack.manifest.name,
    source: first.source,
    skills: groups.flatMap(group => group.skills),
    ...(groups.length > 1 ? { groups: memberGroups } : {}),
    ...(stack.manifest.description ? { description: stack.manifest.description } : {}),
    ...(stack.origin ? { origin: stack.origin } : {}),
    sourceNames: Object.fromEntries(groups.map(group => [group.source, group.name])),
    enabled: [],
    ready: false,
  };
}

/** Pure: never reads or writes the settings file, so a dry run and the real run produce the same result. */
export function migrateSettings(before: Settings, choices: MigrationChoices, machine: MachineSkill[]): { settings: Settings; report: MigrationReport } {
  const settings = structuredClone(before);
  const stacks = before.stacks ?? [];
  const warnings: string[] = [];
  const coreStack = choices.core ? stacks.find(stack => stack.manifest.id === choices.core) : undefined;
  if (choices.core && !coreStack) throw new Error(`No stack has the ID ${choices.core}. Choose one of: ${stacks.map(stack => stack.manifest.id).join(", ") || "none"}.`);

  const followed = new Set((choices.follow ?? []).map(sourceIdentity));
  const core: KitSource[] = coreStack ? firstSourceWins(coreStack, warnings).map(group => ({ ...group, ...(followed.has(sourceIdentity(group.source)) ? { follow: true } : {}) })) : [];

  const profiles = settings.profiles;
  const reportStacks: MigrationReport["stacks"] = [];
  const newPacks = new Set<string>();
  for (const stack of stacks) {
    const skills = stackPicks(stack).length;
    if (stack === coreStack) {
      reportStacks.push({ id: stack.manifest.id, name: stack.manifest.name, skills, becomes: "core", linkedProfile: false });
      continue;
    }
    const packId = `stack-${stack.manifest.id}`;
    const linked = profiles.find(profile => profile.id === packId);
    const candidate = packFromStack(stack, warnings);
    if (linked) {
      // Its member definition is hashed against machine-local activation, so it must not change here.
      const absent = candidate.skills.filter(name => !linked.skills.includes(name));
      if (absent.length) warnings.push(`${linked.name} stays as it is, but its stack also picked ${absent.join(", ")}. Add them to the pack if you still want them.`);
      if (candidate.description) linked.description = candidate.description;
      if (candidate.origin) linked.origin = candidate.origin;
      linked.sourceNames = candidate.sourceNames!;
    } else {
      profiles.push(candidate);
      newPacks.add(candidate.id);
    }
    reportStacks.push({ id: stack.manifest.id, name: stack.manifest.name, skills, becomes: "pack", packId, linkedProfile: Boolean(linked) });
  }

  const packMembers = new Set(profiles.flatMap(profile => profile.skills));
  const inCore = new Set(core.flatMap(entry => entry.skills));
  const added: MigrationReport["added"] = [];
  for (const entry of core.filter(entry => entry.follow)) {
    for (const skill of machine) {
      if (skill.source && sourceIdentity(skill.source) === sourceIdentity(entry.source) && !inCore.has(skill.name) && !packMembers.has(skill.name) && skillName(skill.name)) {
        entry.skills.push(skill.name);
        inCore.add(skill.name);
        added.push({ name: skill.name, source: entry.source });
      }
    }
  }

  const installed = machine.map(skill => skill.name);
  const skipped = new Set((choices.skipTools ?? []).map(name => name.toLowerCase()));
  const reportTools: MigrationReport["tools"] = [];
  const claimed = new Set(settings.tools.flatMap(tool => tool.provides ?? []));
  for (const tool of settings.tools) {
    const provides = suggestProvides(tool, installed).filter(name => !claimed.has(name));
    if (!provides.length) continue;
    const linked = !skipped.has(tool.name.toLowerCase());
    reportTools.push({ id: tool.id, name: tool.name, provides, linked });
    if (linked) {
      tool.provides = [...(tool.provides ?? []), ...provides];
      for (const name of provides) claimed.add(name);
    }
  }

  const provided = new Set(settings.tools.flatMap(tool => tool.provides ?? []));
  const dropped = { savedSkills: (before.savedSkills ?? []).reduce((total, snapshot) => total + snapshot.skills.length, 0) };
  settings.version = SETTINGS_VERSION;
  settings.kit = { core };
  delete settings.stacks;
  delete settings.savedSkills;
  assertNothingLost(before, settings);

  return {
    settings,
    report: {
      stacks: reportStacks,
      core: core.map(entry => ({ source: entry.source, ...(entry.name ? { name: entry.name } : {}), skills: entry.skills, follow: Boolean(entry.follow) })),
      added,
      packs: profiles.map(profile => ({ id: profile.id, name: profile.name, skills: profile.skills.length, new: newPacks.has(profile.id) })),
      tools: reportTools,
      missingHere: [...inCore].filter(name => !installed.includes(name) && !provided.has(name)),
      preserved: { sources: settings.favoriteSources.length, tools: settings.tools.length, projects: settings.projects.length, rulesDestinations: settings.agentRules?.destinations.length ?? 0, profiles: before.profiles.length },
      dropped,
      warnings,
    },
  };
}

/** The last check before a write. A bug in the mapping above must fail here, not reach the user's file. */
export function assertNothingLost(before: Settings, after: Settings): void {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  const fail = (what: string): never => { throw new Error(`Migration stopped: it would have changed ${what}. Nothing was written.`); };
  if (after.configurationId !== before.configurationId) fail("the configuration identity");
  if (!same(after.favoriteSources, before.favoriteSources)) fail("your sources");
  if (!same(after.projects, before.projects)) fail("your projects");
  if (!same(after.agentRules, before.agentRules)) fail("your agent rules");
  if (!same(after.preferences, before.preferences)) fail("your invocation preferences");
  if (!same(after.managedLinks, before.managedLinks)) fail("your link ownership");
  if (!same(after.independentSkills, before.independentSkills)) fail("your individually enabled skills");
  const withoutProvides = (tools: Tool[]): unknown[] => tools.map(({ provides: _provides, ...tool }) => tool);
  if (!same(withoutProvides(after.tools), withoutProvides(before.tools))) fail("your tools");
  for (const profile of before.profiles) {
    const kept = after.profiles.find(candidate => candidate.id === profile.id);
    if (!kept || definition(kept) !== definition(profile) || !same(kept.enabled, profile.enabled)) fail(`pack ${profile.name}`);
  }
  const reachable = new Set([...(after.kit?.core ?? []).flatMap(entry => entry.skills), ...after.profiles.flatMap(profile => profile.skills)]);
  const linkedIds = new Set(before.profiles.map(profile => profile.id));
  for (const stack of before.stacks ?? []) {
    if (linkedIds.has(`stack-${stack.manifest.id}`)) continue;
    for (const name of stackPicks(stack)) if (!reachable.has(name)) fail(`stack ${stack.manifest.name}`);
  }
}
