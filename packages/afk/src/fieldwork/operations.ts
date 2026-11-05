import { ProcessOutput } from "./process-output.js";
import { installSkills, type InstallProgress, type InstallRunner } from "./skill-install.js";
import { updateSkills, type UpdateProgress } from "./skill-update.js";
import { SkillUpdateSchedule } from "./skill-schedule.js";
import { sharingState, setSharing } from "./sharing.js";
import { deleteSkill, previewDeletion } from "./deletion.js";
import { fetchStack, manifestUrl, validateStack, type SkillStack } from "./stacks.js";
import { randomUUID } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { runCommand as run, type CommandResult } from "./command-runner.js";
import { isProfileGroup, LOCAL_PROFILE_SOURCE, profileGroups, SettingsStore, validateSettings, skillName, type Profile, type ProfileGroup, type Settings } from "./settings.js";
import { setInvocation } from "./invocation.js";
import { adoptSkill, type AdoptDestination } from "./adopt.js";
import { trackToolRun } from "./tool-run.js";
import { resolveDuplicate } from "./duplicates.js";
import { SourcePreparation } from "./preparation.js";
import { globalSkillOn, SkillLibrary } from "./skills.js";
import { readNativeMetadata } from "./skill-metadata.js";
import { RulesWorkspace, type RulesFile, type RulesPreview } from "./rules.js";
import { exportBundle, inspectBundle, applyBundle } from "./bundle.js";
import { Library } from "./library.js";
import { Backup } from "./library-backup.js";
import { operationCatalog, type Operation } from "./operation-catalog.js";
import { projectStatus } from "./projects.js";
import { migrateProject } from "./project-skills.js";
import { addToCore, dropFromCore, isRepositorySource, kitStatus, toolOwner, type InstallCandidate, type SyncPlan } from "./kit.js";
import { portableSettings } from "./local-state.js";
import { agentFolderState, changeAgentFolders } from "./agent-folder-operations.js";
import { fingerprint, migrateSettings, sourceIdentity, type MigrationChoices } from "./migration.js";

function validateInput(operation: Operation, data: Record<string, unknown>): void {
  for (const key of Object.keys(data)) {
    if (!Object.hasOwn(operationCatalog[operation].input, key)) throw new Error(`Unknown ${operation} input field: ${key}. Read manage describe ${operation}.`);
  }
  const requiredText: Partial<Record<Operation, string[]>> = {
    "project/remove": ["name"], "source/install": ["source", "scope", "agent"],
    "pack/remove": ["id"], "pack/read": ["id"], "pack/manifest": ["id"],
    "kit/add": ["to"], "kit/drop": ["name"], "kit/machine-only": ["name"], "kit/follow": ["source"],
    "kit/install-preview": ["source"], "kit/install-read": ["source", "name"], "kit/install": ["source", "to"],
    activation: ["id", "scope"], "project/save": ["name", "path"],
    invocation: ["name", "scope"], "skill/toggle": ["name", "scope"], "skill/adopt": ["name", "to"], "skill/resolve-duplicate": ["name", "scope", "keep"],
    "skills/update": ["scope"], "skills/delete-preview": ["scope"], "skills/bulk": ["scope", "action"],
    "skills-sharing/state": ["scope"], "skills-sharing/set": ["scope"],
    "skill/delete-preview": ["name", "scope"], "skill/delete": ["name", "scope"],
    "skill/availability": ["name", "scope"], "skill/read": ["name", "scope"],
    "rules/existing": ["id"], "rules/adopt": ["id"], "rules/overwrite": ["id"],
    "rules/disconnect": ["id"], "agent-folders/enable": ["path"], "agent-folders/disable": ["path"], "agent-folders/remove": ["path"], "agent-folders/add": ["name", "global"], workspace: ["mode", "folder"], location: ["path"],
    "bundle/preview": ["base64"], "bundle/import": ["base64"], "migration/apply": ["fingerprint"],
    "backup/connect": ["url"], "backup/create": ["name"], "backup/restore": ["id"],
    "backup/keep": ["id"], "backup/discard": ["id"], "backup/take-update": ["name"], "backup/restore-saved": ["name"],
  };
  const optionalText: Partial<Record<Operation, string[]>> = {
    "pack/save": ["id", "name", "source", "description"], "kit/drop": ["from"], "kit/add": ["source"], "kit/sync": ["agent"], "kit/install": ["packName", "scope", "agent"], "project/save": ["previous"],
    "skill/read": ["file", "folder"], "rules/save": ["expectedHash"], folders: ["path"], "agent-folders/add": ["project"],
  };
  for (const key of requiredText[operation] ?? []) {
    if (typeof data[key] !== "string" || !data[key].trim()) throw new Error(`Provide ${key} as a nonempty string.`);
  }
  for (const key of optionalText[operation] ?? []) {
    if (data[key] !== undefined && typeof data[key] !== "string") throw new Error(`Provide ${key} as a string.`);
  }
  if (operation === "skill/adopt" && !["library", "machine"].includes(String(data.to))) throw new Error("Choose library or machine.");
  for (const key of ["local", "update", "clean", "enabled", "confirmed", "prepare", "brief", "bookmark"]) {
    if (data[key] !== undefined && typeof data[key] !== "boolean") throw new Error(`Provide ${key} as true or false.`);
  }
  if (operation === "skills/delete-preview" || operation === "skills/bulk" || (operation === "skills/update" && data.names !== undefined)) {
    if (!Array.isArray(data.names) || !data.names.length || !data.names.every(skillName) || new Set(data.names).size !== data.names.length) throw new Error("Select unique skill names.");
  }
  if (operation === "skills/bulk") {
    if (!["enable", "disable", "invocation", "delete"].includes(String(data.action))) throw new Error("Choose a supported bulk action.");
    if (data.action === "invocation" && (typeof data.mode !== "string" || !["", "Manual only", "Automatic allowed"].includes(data.mode))) throw new Error("Choose a supported invocation mode.");
  }
  if (operation === "invocation" && typeof data.mode !== "string") throw new Error("Provide an invocation mode.");
  const inProject = typeof data.scope === "string" && data.scope !== "Global";
  if (inProject && (operation === "skill/toggle" || operation === "skill/availability" || operation === "skills/bulk" && (data.action === "enable" || data.action === "disable"))) throw new Error("A project's skills are always on. Delete a skill to remove it from the project.");
  if (inProject && operation === "activation" && data.enabled === true) throw new Error("Packs are Global only. A project keeps its own skills.");
  if (operation === "tool/run" && !Number.isSafeInteger(data.id)) throw new Error("Provide a numeric saved tool ID.");
  if (operation === "rules/preview" || operation === "rules/sync") {
    if (!Array.isArray(data.ids) || !data.ids.length || !data.ids.every(skillName) || new Set(data.ids).size !== data.ids.length) throw new Error("Choose unique rule destination IDs.");
  }
}

export async function runTool(command: string, args: string[], cwd: string, signal?: AbortSignal): Promise<{ output: string; code: number }> {
  const result: CommandResult = await run({ command, args, cwd, signal, step: "The tool command", idleTimeoutMs: 10 * 60_000, timeoutMs: 30 * 60_000 });
  return { output: result.output, code: result.code };
}

export class FieldworkOperations {
  private readonly library: SkillLibrary;
  private readonly rules: RulesWorkspace;
  private readonly lifecycle = new AbortController();
  private readonly inFlight = new Map<number, { operation: string; settled: Promise<void> }>();
  private nextFlight = 0;
  private readonly preparation = new SourcePreparation(this.lifecycle.signal);
  private installController: AbortController | null = null;
  private skillInstall: InstallProgress | null = null;
  private updateController: AbortController | null = null;
  private skillUpdate: UpdateProgress | null = null;
  installRunner: InstallRunner | undefined;
  private mutations: Promise<void> = Promise.resolve();
  private readonly toolRuns: Record<number, { pending: boolean; output: string; code?: number; warnings?: string[] }> = {};
  readonly schedule: SkillUpdateSchedule;
  readonly backup: Backup;
  private projectsReady: Promise<void> | undefined;
  private projectMigration: { migrated: string[]; kept: { project: string; skills: string[] }[]; failed: { project: string; error: string }[] } = { migrated: [], kept: [], failed: [] };

  constructor(readonly store: SettingsStore) {
    this.backup = new Backup(new Library(store.home), undefined, { signal: this.lifecycle.signal, isOn: async name => globalSkillOn(await store.read(), name) });
    this.library = new SkillLibrary(store);
    this.rules = new RulesWorkspace(store);
    this.schedule = new SkillUpdateSchedule(store.home);
  }

  get skillUpdatePending(): boolean {
    return Boolean(this.skillUpdate?.pending);
  }

  private async prepareMembers(settings: Settings, groups: ProfileGroup[], pack = "the pack"): Promise<void> {
    const downloads: { group: ProfileGroup; absent: string[] }[] = [];
    for (const group of groups) {
      const absent: string[] = [];
      for (const name of group.skills) {
        try { await this.library.locate(settings, name); continue; } catch { /* A missing member needs preparation. */ }
        if (group.source === LOCAL_PROFILE_SOURCE) throw new Error(`Restore this local skill before adding it: ${name}. It has no repository source.`);
        absent.push(name);
      }
      if (absent.length) downloads.push({ group, absent });
    }
    if (downloads.length) await this.downloadPackSkills(settings, pack, downloads);
  }

  // Off, swap, on: activation owns links by name, so reusing it preserves every other owner of a skill.
  private async replacePack(settings: Settings, next: Profile, groups: ProfileGroup[]): Promise<void> {
    const previous = settings.profiles.find(profile => profile.id === next.id);
    const scopes = [...(previous?.enabled ?? [])];
    if (!previous || !scopes.length) {
      settings.profiles = [...settings.profiles.filter(profile => profile.id !== next.id), next];
      await this.store.save(settings);
      return;
    }
    await this.prepareMembers(settings, groups, next.name);
    const restored: Profile = { ...structuredClone(previous), enabled: [] };
    const position = settings.profiles.indexOf(previous);
    for (const scope of scopes) await this.library.activate(settings, previous.id, scope, false);
    const swap = (profile: Profile): void => { settings.profiles = settings.profiles.map((item, index) => index === position ? profile : item); };
    swap({ ...next, enabled: [], ready: true });
    const turnedOn: string[] = [];
    try {
      for (const scope of scopes) { await this.library.activate(settings, next.id, scope, true); turnedOn.push(scope); }
    } catch (error) {
      for (const scope of turnedOn) await this.library.activate(settings, next.id, scope, false);
      swap(restored);
      for (const scope of scopes) await this.library.activate(settings, previous.id, scope, true);
      throw error;
    }
  }

  private packFrom(existing: Profile | undefined, id: string, name: string, groups: ProfileGroup[], extras: { description?: string; origin?: string; sourceNames?: Record<string, string> }): Profile {
    const merged = new Map<string, string[]>();
    for (const group of groups) merged.set(group.source, [...new Set([...(merged.get(group.source) ?? []), ...group.skills])]);
    const combined = [...merged].map(([source, skills]) => ({ source, skills }));
    const origins = new Map<string, string[]>();
    for (const group of combined) for (const skill of group.skills) origins.set(skill, [...(origins.get(skill) ?? []), group.source]);
    const collisions = [...origins].filter(([, sources]) => sources.length > 1);
    if (collisions.length) throw new Error(`Each skill can come from only one source. ${collisions.map(([skill, sources]) => `${skill} is selected from ${sources.join(" and ")}`).join("; ")}. Keep it in one source.`);
    const description = extras.description ?? existing?.description, origin = extras.origin ?? existing?.origin, sourceNames = extras.sourceNames ?? existing?.sourceNames;
    return {
      id, name, source: combined[0]!.source, skills: combined.flatMap(group => group.skills),
      ...(combined.length > 1 ? { groups: combined } : {}),
      ...(description ? { description } : {}), ...(origin ? { origin } : {}), ...(sourceNames ? { sourceNames } : {}),
      enabled: existing?.enabled ?? [], ready: existing?.ready ?? false,
    };
  }

  private async installCandidates(settings: Settings, source: string, scope = "Global"): Promise<InstallCandidate[]> {
    const names = await this.preparation.discover(source);
    const directory = await this.preparation.directory(source);
    const paths = await this.preparation.paths(source);
    const inventory = await this.library.inventory(settings, scope);
    return await Promise.all(names.map(async name => {
      const { description } = await readNativeMetadata(join(directory, name));
      const entry = inventory.find(item => item.name === name);
      const tool = toolOwner(settings, name);
      const pack = settings.profiles.find(profile => profile.skills.includes(name));
      const inKit = settings.kit?.core.some(item => item.skills.includes(name)) ? "Core" : pack?.name;
      const state: InstallCandidate["state"] = tool ? "tool" : !entry ? "new" : entry.source && sourceIdentity(entry.source) === sourceIdentity(source) ? "installed" : "conflict";
      return {
        name, description, state,
        ...(paths[name] ? { path: paths[name] } : {}),
        ...(tool ? { tool: tool.name } : {}),
        ...(state === "conflict" && entry?.source ? { installedFrom: entry.source } : {}),
        ...(inKit ? { inKit } : {}),
      };
    }));
  }

  private async installWithDestination(data: Record<string, unknown>): Promise<unknown> {
    const { store, library } = this;
    const settings = await store.read();
    const source = String(data.source).trim(), to = String(data.to);
    const names = data.names === undefined ? [] : data.names;
    if (!Array.isArray(names) || !names.every(skillName) || new Set(names).size !== names.length) throw new Error("Choose unique skill names.");
    const replace = data.replace === undefined ? [] : data.replace;
    if (!Array.isArray(replace) || !replace.every(skillName)) throw new Error("Provide replace as an array of skill names.");
    const pack = settings.profiles.find(profile => profile.id === to);
    if (!["core", "machine", "later", "new-pack"].includes(to) && !pack) throw new Error("Choose a destination: core, machine, later, new-pack, or a pack ID.");
    if (data.scope !== undefined && data.scope !== "Global" && to !== "machine") throw new Error("Only This machine can install into a project. Core and packs start from Global.");
    const scope = String(data.scope ?? "Global");
    if (scope !== "Global" && !settings.projects.some(project => project.name === scope)) throw new Error("Choose a configured project.");
    if (to !== "later" && !names.length) throw new Error("Choose at least one skill.");
    const finish = async (extra: Record<string, unknown> = {}): Promise<unknown> => {
      const latest = await store.read();
      return { ok: true, to, ...extra, status: kitStatus(latest, await library.inventory(latest, "Global")) };
    };

    if (to === "later") {
      const existing = settings.favoriteSources.find(item => sourceIdentity(item.source) === sourceIdentity(source));
      if (existing) { if (existing.skills) { if (names.length) existing.skills = [...new Set([...existing.skills, ...names])]; else delete existing.skills; } }
      else settings.favoriteSources.push({ name: source.replace(/#.*$/, "").replace(/\.git$/, "").replace(/\/+$/, "").split(/[/:]/).filter(Boolean).pop() ?? source, source, ...(names.length ? { skills: names } : {}) });
      await store.save(settings);
      return await finish();
    }

    const candidates = await this.installCandidates(settings, source, scope);
    for (const name of names) {
      const candidate = candidates.find(item => item.name === name);
      if (!candidate) throw new Error(`${name} is not in this repository.`);
      if (candidate.tool) throw new Error(`${name} is installed by ${candidate.tool}. Use that tool instead.`);
    }

    if (to === "new-pack" || pack) {
      const groups = pack ? profileGroups(pack).map(group => ({ source: group.source, skills: [...group.skills] })) : [];
      const fresh = names.filter(name => !pack?.skills.includes(name));
      if (!fresh.length) return await finish();
      const known = groups.find(group => sourceIdentity(group.source) === sourceIdentity(source));
      if (known) known.skills.push(...fresh);
      else groups.push({ source, skills: fresh });
      const packName = typeof data.packName === "string" ? data.packName.trim() : "";
      if (!pack && !packName) throw new Error("Name the new pack.");
      const next = this.packFrom(pack, pack?.id ?? "profile-" + randomUUID(), pack?.name ?? packName, groups, {});
      await this.prepareMembers(settings, [{ source, skills: fresh }], pack?.name ?? packName);
      next.ready = true;
      for (const member of next.skills) { try { await library.locate(settings, member); } catch { next.ready = false; } }
      await this.replacePack(settings, next, profileGroups(next));
      settings.machineOnly = settings.machineOnly.filter(name => !fresh.includes(name));
      await store.save(settings);
      return await finish({ id: next.id });
    }

    const conflicts = candidates.filter(item => names.includes(item.name) && item.state === "conflict" && !replace.includes(item.name));
    if (conflicts.length) throw new Error(`Already installed from another repository: ${conflicts.map(item => `${item.name} (${item.installedFrom ?? "unknown source"})`).join(", ")}. Choose to replace them, or leave them out.`);
    const toInstall = names.filter(name => candidates.find(item => item.name === name)!.state !== "installed");
    const record = (target: Settings): void => {
      if (to === "core") {
        for (const name of names) addToCore(target, name, source);
        target.machineOnly = target.machineOnly.filter(name => !names.includes(name));
      } else if (scope === "Global") target.machineOnly = [...new Set([...target.machineOnly, ...names])];
    };
    const stored = scope === "Global" && await library.library.exists();
    let install: InstallProgress | undefined;
    if (toInstall.length) {
      this.installController = new AbortController();
      try {
        install = await installSkills(store, settings, [{ source, skills: toInstall }], scope, String(data.agent ?? "universal"), `Install from ${source}`, value => { this.skillInstall = value; }, AbortSignal.any([this.installController.signal, this.lifecycle.signal]), this.installRunner, { destination: to === "core" ? "library" : "machine", finalize: record });
        this.skillInstall = install;
      } finally { this.installController = null; }
      if (install.code !== 0) {
        const latest = await store.read();
        return { ok: false, to, install, status: kitStatus(latest, await library.inventory(latest, "Global")) };
      }
    }
    if (!stored || !toInstall.length) {
      const latest = await store.read();
      record(latest);
      await store.save(latest);
    }
    return await finish(install ? { install } : {});
  }

  private async downloadPackSkills(settings: Settings, pack: string, downloads: { group: ProfileGroup; absent: string[] }[]): Promise<void> {
    const state: InstallProgress = { pending: true, phase: `Downloading skills for ${pack}`, output: "", completed: 0, total: downloads.length, scope: "Global", agent: "universal", label: `Turn on ${pack}`, startedAt: Date.now() };
    const output = new ProcessOutput();
    const report = (): void => { this.skillInstall = { ...state }; };
    const append = (text: string): void => { state.output = output.append(text); state.lastLine = output.lastLine(); report(); };
    this.installController = new AbortController();
    const signal = AbortSignal.any([this.installController.signal, this.lifecycle.signal]);
    report();
    try {
      for (const { group, absent } of downloads) {
        signal.throwIfAborted();
        state.item = group.source; report();
        append(`\nSource: ${group.source}\n`);
        await this.library.storePrepared(settings, await this.preparation.directory(group.source, { onOutput: append, signal }), absent, group.source);
        state.completed++; report();
      }
      state.code = 0; state.phase = `Downloaded skills for ${pack}`;
    } catch (error) {
      if (signal.aborted) { state.cancelled = true; state.code = 130; state.phase = "Download cancelled"; }
      else { state.code = 1; state.phase = "Download failed"; append(error instanceof Error ? error.message : "Download failed"); }
      throw error;
    } finally {
      delete state.item; state.pending = false; state.finishedAt = Date.now(); report();
      this.installController = null;
    }
  }

  private packManifest(settings: Settings, id: string): SkillStack {
    const label = (source: string): string => source.replace(/\.git$/, "").replace(/\/+$/, "").split(/[/:]/).filter(Boolean).pop() ?? source;
    if (id === "core") {
      const sources = (settings.kit?.core ?? []).filter(entry => entry.skills.length).map(entry => ({ name: entry.name ?? label(entry.source), source: entry.source, skills: entry.skills }));
      if (!sources.length) throw new Error("Core has no skills to export yet.");
      return validateStack({ version: 1, id: "core", name: "Core", sources });
    }
    const pack = settings.profiles.find(profile => profile.id === id);
    if (!pack) throw new Error("Pack not found.");
    const groups = profileGroups(pack);
    if (groups.some(group => group.source === LOCAL_PROFILE_SOURCE)) throw new Error("This pack uses skills from this machine, which have no repository to publish.");
    return validateStack({ version: 1, id: pack.id.replace(/^stack-/, ""), name: pack.name, ...(pack.description ? { description: pack.description } : {}), sources: groups.map(group => ({ name: pack.sourceNames?.[group.source] ?? label(group.source), source: group.source, skills: group.skills })) });
  }

  // Earlier versions parked, copied and linked skills inside projects; the first answer waits until every present project is back to its own files.
  private async migrateProjects(): Promise<void> {
    try {
      const names = (await this.store.read()).projects.map(project => project.name);
      for (const name of names) {
        const settings = await this.store.read();
        if ((await projectStatus(this.store, settings))[name] !== "present") continue;
        try {
          const result = await migrateProject(this.store, settings, name);
          if (result.migrated) this.projectMigration.migrated.push(name);
          if (result.kept.length) this.projectMigration.kept.push({ project: name, skills: result.kept });
        } catch (error) { this.projectMigration.failed.push({ project: name, error: error instanceof Error ? error.message : "Migration failed." }); }
      }
    } catch { /* The requested operation reports unreadable settings itself. */ }
  }

  run(operation: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (!Object.hasOwn(operationCatalog, operation)) return Promise.reject(new Error("Unknown operation. Run afk manage describe for supported operations."));
    const ready = this.projectsReady ??= this.migrateProjects();
    const action = async (): Promise<unknown> => { await ready; return this.apply(operation as Operation, data); };
    const direct = ["state", "kit/state", "rules/state", "bundle/export", "tool/run", "skills/update-state", "skills/update-cancel", "skills/install-state", "skills/install-cancel", "skills/schedule-state", "skills/schedule", "backup/state", "backup/save", "agent-folders/state"].includes(operation);
    const result = direct ? action() : this.mutations.then(action);
    if (!direct) this.mutations = result.then(() => undefined, () => undefined);
    const flight = this.nextFlight++;
    this.inFlight.set(flight, { operation, settled: result.then(() => undefined, () => undefined) });
    void this.inFlight.get(flight)!.settled.then(() => this.inFlight.delete(flight));
    return result;
  }

  async idle(): Promise<void> {
    await this.mutations;
    if (Object.values(this.toolRuns).some(run => run.pending)) throw new Error("Wait for running tool commands to finish before updating AFK.");
  }

  async close(deadlineMs = 10_000): Promise<{ abandoned: string[] }> {
    this.lifecycle.abort();
    let timer: NodeJS.Timeout | undefined;
    const drained = await Promise.race([
      Promise.all([...this.inFlight.values()].map(flight => flight.settled)).then(() => true),
      new Promise<boolean>(accept => { timer = setTimeout(() => accept(false), deadlineMs); }),
    ]);
    clearTimeout(timer);
    const abandoned = drained ? [] : [...new Set([...this.inFlight.values()].map(flight => flight.operation))];
    if (abandoned.length) console.error(`AFK shutdown deadline reached; abandoned: ${abandoned.join(", ")}`);
    await this.preparation.close();
    return { abandoned };
  }

  private migrationChoices(data: Record<string, unknown>): MigrationChoices {
    const strings = (value: unknown, label: string): string[] | undefined => {
      if (value === undefined) return undefined;
      if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw new Error(`Provide ${label} as an array of strings.`);
      return value as string[];
    };
    if (data.core !== undefined && data.core !== null && typeof data.core !== "string") throw new Error("Provide core as a stack ID or null.");
    const follow = strings(data.follow, "follow"), skipTools = strings(data.skipTools, "skipTools");
    return { core: (data.core as string | null | undefined) ?? null, ...(follow ? { follow } : {}), ...(skipTools ? { skipTools } : {}) };
  }

  private async applyBackup(operation: Operation, data: Record<string, unknown>): Promise<unknown> {
    const { backup } = this;
    if (operation === "backup/state") {
      const status = await backup.status(), attention = await backup.checks.list(), unpushed = await backup.unpushedSkills();
      return data.brief === true ? { status, attention, unpushed } : { status, attention, unpushed, history: await backup.history(), contents: await backup.contents() };
    }
    const resolutions: Partial<Record<Operation, () => Promise<void>>> = {
      "backup/keep": () => backup.checks.keep(String(data.id)),
      "backup/discard": () => backup.checks.discard(String(data.id)),
      "backup/take-update": () => backup.checks.take(String(data.name)),
      "backup/restore-saved": () => backup.checks.restore(String(data.name)),
    };
    const resolve = resolutions[operation];
    if (resolve) {
      await resolve();
      return { status: await backup.status(), attention: await backup.checks.list() };
    }
    if (operation === "backup/connect") return backup.connect(String(data.url));
    if (operation === "backup/create") return backup.createRepository(String(data.name));
    if (operation === "backup/save") return backup.saveNow();
    if (operation === "backup/disconnect") return backup.disconnect();
    await backup.goBack(String(data.id));
    return backup.status();
  }

  private async apply(operation: Operation, data: Record<string, unknown>): Promise<unknown> {
    if (operation === "skills/install-state") { validateInput(operation, data); return this.skillInstall; }
    if (operation === "skills/install-cancel") {
      validateInput(operation, data);
      if (!this.skillInstall?.pending) return { cancelled: false, reason: "No installation is running." };
      this.installController?.abort(); return { cancelled: true };
    }
    if (operation === "skills/update-state") return this.skillUpdate;
    if (operation === "skills/schedule-state") { validateInput(operation, data); return await this.schedule.state(); }
    if (operation === "skills/schedule") { validateInput(operation, data); return await this.schedule.choose(data); }
    if (operation === "skills/update-cancel") {
      validateInput(operation, data);
      if (!this.skillUpdate?.pending) return { cancelled: false, reason: "No skill update is running." };
      if (!this.skillUpdate.cancellable) return { cancelled: false, reason: "File replacement has started. Finishing safely." };
      this.updateController?.abort();
      return { cancelled: true };
    }
    validateInput(operation, data);
    if (operation.startsWith("backup/")) return this.applyBackup(operation, data);
    const { store, library, rules, preparation, toolRuns } = this;
    const settings = await store.read();
    if (operation === "migration/preview") {
      if (settings.version !== 1) return { required: false };
      const { report } = migrateSettings(settings, this.migrationChoices(data), await library.inventory(settings, "Global"));
      return { required: true, fingerprint: fingerprint((await store.portableText()) ?? ""), report };
    }
    if (operation === "migration/apply") {
      if (settings.version !== 1) throw new Error("These settings are already migrated.");
      const text = (await store.portableText()) ?? "";
      if (fingerprint(text) !== data.fingerprint) throw new Error("The settings file changed since this dry run. Review the migration again.");
      const { settings: migrated, report } = migrateSettings(settings, this.migrationChoices(data), await library.inventory(settings, "Global"));
      await store.save(migrated, { migrating: true });
      const copy = (await store.backups()).find(backup => backup.name.startsWith("pre-kit-") && backup.configurationId === settings.configurationId);
      return { ok: true, report, ...(copy ? { backup: join(store.backupFolder, copy.name) } : {}) };
    }
    if (operation === "source/install") {
      const source = settings.favoriteSources?.find(source => source.source === data.source);
      if (!source) throw new Error("Saved source not found.");
      if (data.skills !== undefined) {
        if (!Array.isArray(data.skills) || !data.skills.length || !data.skills.every(skillName) || new Set(data.skills).size !== data.skills.length) throw new Error("Choose unique skill names for this installation.");
        if (source.skills && data.skills.some(name => !source.skills!.includes(name))) throw new Error("Choose skills from the bookmark’s saved selection.");
      }
      const groups = [{ ...source, ...(data.skills ? { skills: data.skills as string[] } : {}) }];
      this.installController = new AbortController();
      try {
        this.skillInstall = await installSkills(store, settings, groups, String(data.scope), String(data.agent), source.name, value => { this.skillInstall = value; }, AbortSignal.any([this.installController.signal, this.lifecycle.signal]), this.installRunner, { destination: "library", finalize: (target, installed) => { for (const name of installed) addToCore(target, name, source.source); } });
        return this.skillInstall;
      } finally { this.installController = null; }
    }
    if (operation === "kit/state") return kitStatus(settings, await library.inventory(settings, "Global"));
    if (operation === "kit/machine-only") {
      if (typeof data.enabled !== "boolean") throw new Error("Provide enabled as true or false.");
      if (!skillName(data.name)) throw new Error("Choose a valid skill name.");
      settings.machineOnly = data.enabled ? [...new Set([...settings.machineOnly, data.name])] : settings.machineOnly.filter(name => name !== data.name);
      await store.save(settings); return { ok: true };
    }
    if (operation === "kit/follow") {
      if (typeof data.follow !== "boolean") throw new Error("Provide follow as true or false.");
      const entry = settings.kit?.core.find(item => sourceIdentity(item.source) === sourceIdentity(String(data.source)));
      if (!entry) throw new Error("That source is not in Core.");
      if (data.follow) entry.follow = true;
      else {
        delete entry.follow;
        if (!entry.skills.length) settings.kit!.core = settings.kit!.core.filter(item => item !== entry);
      }
      await store.save(settings); return { ok: true };
    }
    if (operation === "kit/upstream") {
      const known = new Set([...(settings.kit?.core ?? []).flatMap(entry => entry.skills), ...settings.profiles.flatMap(profile => profile.skills), ...settings.tools.flatMap(tool => tool.provides ?? [])]);
      const sources = [];
      for (const entry of (settings.kit?.core ?? []).filter(item => item.follow)) {
        try {
          const names = (await preparation.discover(entry.source)).filter(name => !known.has(name));
          if (!names.length) continue;
          const directory = await preparation.directory(entry.source);
          sources.push({ source: entry.source, ...(entry.name ? { name: entry.name } : {}), names, descriptions: Object.fromEntries(await Promise.all(names.map(async name => [name, (await readNativeMetadata(join(directory, name))).description] as const))) });
        } catch (error) {
          sources.push({ source: entry.source, names: [], error: error instanceof Error ? error.message : "Could not check this source." });
        }
      }
      return { sources };
    }
    if (operation === "kit/add") {
      const names = data.names;
      if (!Array.isArray(names) || !names.length || !names.every(skillName) || new Set(names).size !== names.length) throw new Error("Select unique skill names.");
      const inventory = await library.inventory(settings, "Global");
      const sourceOf = (name: string): string | undefined => typeof data.source === "string" ? data.source.trim() : inventory.find(entry => entry.name === name)?.source;
      settings.machineOnly = settings.machineOnly.filter(name => !names.includes(name));
      if (data.to === "core") {
        for (const name of names) {
          const source = sourceOf(name);
          if (!isRepositorySource(source)) throw new Error(`${name} has no repository source, so another machine couldn't install it. Link it to a tool instead, or keep it on this machine only.`);
          addToCore(settings, name, source);
        }
        await store.save(settings);
        return { ok: true };
      }
      const pack = settings.profiles.find(profile => profile.id === data.to);
      if (!pack) throw new Error("Choose core or a saved pack.");
      const groups = profileGroups(pack).map(group => ({ source: group.source, skills: [...group.skills] }));
      for (const name of names) {
        if (pack.skills.includes(name)) continue;
        const source = sourceOf(name) ?? LOCAL_PROFILE_SOURCE;
        const known = groups.find(group => sourceIdentity(group.source) === sourceIdentity(source));
        if (known) known.skills.push(name);
        else groups.push({ source, skills: [name] });
      }
      await this.replacePack(settings, this.packFrom(pack, pack.id, pack.name, groups, {}), groups);
      return { ok: true };
    }
    if (operation === "kit/drop") {
      const name = String(data.name), from = data.from as string | undefined;
      let changed = false;
      if (from === undefined || from === "core") changed = dropFromCore(settings, name);
      if (changed) await store.save(settings);
      const packs = settings.profiles.filter(profile => profile.skills.includes(name) && (from === undefined || profile.id === from));
      for (const pack of packs) {
        if (pack.skills.length === 1) throw new Error(`${name} is the last skill in ${pack.name}. Remove the pack instead.`);
        const groups = profileGroups(pack).map(group => ({ source: group.source, skills: group.skills.filter(member => member !== name) })).filter(group => group.skills.length);
        await this.replacePack(settings, this.packFrom(pack, pack.id, pack.name, groups, {}), groups);
        changed = true;
      }
      if (!changed) throw new Error(`${name} is not in the kit.`);
      return { ok: true };
    }
    if (operation === "kit/install-preview") return { source: data.source, candidates: await this.installCandidates(settings, String(data.source)) };
    if (operation === "kit/install-read") {
      if (!skillName(data.name)) throw new Error("Choose a valid skill name.");
      if (!(await preparation.discover(String(data.source))).includes(data.name)) throw new Error(`${data.name} is not in this repository.`);
      const path = join(await preparation.directory(String(data.source)), data.name, "SKILL.md");
      if ((await stat(path)).size > 500_000) throw new Error("This file is too large to preview.");
      return { content: await readFile(path, "utf8") };
    }
    if (operation === "kit/install") return await this.installWithDestination(data);
    if (operation === "kit/sync") {
      const inventory = await library.inventory(settings, "Global");
      const current = kitStatus(settings, inventory);
      if (JSON.stringify(current.plan) !== JSON.stringify(data.expected as SyncPlan | undefined)) throw new Error("This machine or your kit changed since you reviewed the plan. Review it again.");
      if (data.only !== undefined) {
        const { only } = data;
        if (!Array.isArray(only) || !only.length || !only.every(skillName)) throw new Error("Provide only as an array of skill names.");
        current.plan = {
          install: current.plan.install.map(group => ({ source: group.source, skills: group.skills.filter(name => only.includes(name)) })).filter(group => group.skills.length),
          enable: current.plan.enable.filter(name => only.includes(name)),
          tools: current.plan.tools.filter(tool => tool.skills.some(name => only.includes(name))),
        };
      }
      const approved = data.runTools === undefined ? [] : data.runTools;
      if (!Array.isArray(approved) || !approved.every(id => Number.isSafeInteger(id))) throw new Error("Provide runTools as an array of tool IDs.");
      const enabled: { name: string; ok: boolean; error?: string }[] = [];
      for (const name of current.plan.enable) {
        try { await library.toggle(settings, name, "Global"); enabled.push({ name, ok: true }); }
        catch (error) { enabled.push({ name, ok: false, error: error instanceof Error ? error.message : "Could not turn this skill on." }); }
      }
      let install: InstallProgress | undefined;
      if (current.plan.install.length) {
        this.installController = new AbortController();
        try {
          install = await installSkills(store, settings, current.plan.install, "Global", String(data.agent ?? "universal"), "Sync this machine", value => { this.skillInstall = value; }, AbortSignal.any([this.installController.signal, this.lifecycle.signal]), this.installRunner);
          this.skillInstall = install;
        } finally { this.installController = null; }
      }
      const tools: { id: number; name: string; code: number; output: string; reapplied?: string[]; warnings?: string[] }[] = [];
      const skippedTools = current.plan.tools.filter(tool => !approved.includes(tool.id));
      for (const tool of current.plan.tools.filter(tool => approved.includes(tool.id))) {
        toolRuns[tool.id] = { pending: true, output: "Running…" };
        try {
          const finish = await trackToolRun(store, { name: tool.name, provides: tool.skills });
          const result = await finish(await runTool(process.env.SHELL || "/bin/sh", ["-c", tool.command], store.home, this.lifecycle.signal));
          toolRuns[tool.id] = { pending: false, ...result };
          tools.push({ id: tool.id, name: tool.name, ...result });
        } catch (error) {
          const output = error instanceof Error ? error.message : "Command could not start.";
          toolRuns[tool.id] = { pending: false, code: 1, output };
          tools.push({ id: tool.id, name: tool.name, code: 1, output });
        }
      }
      const latest = await store.read();
      return { ...(install ? { install } : {}), enabled, tools, skippedTools, status: kitStatus(latest, await library.inventory(latest, "Global")) };
    }
    if (operation === "pack/manifest") return { manifest: this.packManifest(settings, String(data.id)) };
    if (operation === "pack/import-preview") {
      if ((data.manifest === undefined) === (data.origin === undefined)) throw new Error("Provide pasted manifest JSON or its HTTPS URL, not both.");
      const origin = data.origin === undefined ? undefined : manifestUrl(data.origin);
      const manifest = origin ? await fetchStack(origin) : validateStack(typeof data.manifest === "string" ? JSON.parse(data.manifest) : data.manifest);
      const id = `stack-${manifest.id}`, existing = settings.profiles.find(profile => profile.id === id);
      const pack = this.packFrom(undefined, id, manifest.name, manifest.sources.map(group => ({ source: group.source, skills: group.skills })), {
        ...(manifest.description ? { description: manifest.description } : {}), ...(origin ? { origin } : existing?.origin ? { origin: existing.origin } : {}),
        sourceNames: Object.fromEntries(manifest.sources.map(group => [group.source, group.name])),
      });
      return { pack: { ...pack, enabled: existing?.enabled ?? [], ready: existing?.ready ?? false }, expected: existing ?? null };
    }
    if (operation === "pack/import") {
      const pack = data.pack as Profile | undefined;
      if (!pack || typeof pack.id !== "string") throw new Error("Review the manifest before importing it.");
      const existing = settings.profiles.find(profile => profile.id === pack.id) ?? null;
      if (data.expected === undefined || JSON.stringify(data.expected) !== JSON.stringify(existing)) throw new Error("This pack changed since review. Review it again before saving.");
      await this.replacePack(settings, pack, profileGroups(pack));
      return { ok: true, id: pack.id };
    }
    if (operation === "skills/update") {
      const scope = String(data.scope);
      this.updateController = new AbortController();
      try {
        this.skillUpdate = await updateSkills(store, settings, scope, value => { this.skillUpdate = value; }, undefined, AbortSignal.any([this.updateController.signal, this.lifecycle.signal]), data.names as string[] | undefined);
        return this.skillUpdate;
      } catch (error) {
        this.skillUpdate = { pending: false, phase: "Update failed; review the details", output: (this.skillUpdate?.output || "") + "\n" + (error instanceof Error ? error.message : "Update failed"), code: 1, scope, startedAt: this.skillUpdate?.startedAt ?? Date.now(), finishedAt: Date.now() };
        return this.skillUpdate;
      } finally { this.updateController = null; }
    }
    if (operation === "rules/state") {
      return await rules.state(settings);
    }
    if (operation === "bundle/export") {
      return await exportBundle(store);
    }
    if (operation === "state") {
      const projectStatuses = await projectStatus(store, settings);
      const inventories: Record<string, Awaited<ReturnType<SkillLibrary["inventory"]>>> = {};
      const nestedInventories: Record<string, Awaited<ReturnType<SkillLibrary["nested"]>>> = {};
      const skillSharing: Record<string, Awaited<ReturnType<typeof sharingState>>> = {};
      for (const scope of ["Global", ...settings.projects.map(p => p.name)]) {
        if (scope !== "Global" && projectStatuses[scope] !== "present") {
          inventories[scope] = [];
          nestedInventories[scope] = [];
          continue;
        }
        inventories[scope] = await library.inventory(settings, scope);
        nestedInventories[scope] = await library.nested(settings, scope);
        skillSharing[scope] = await sharingState(store, settings, scope);
      }
      for (const profile of settings.profiles) {
        if (!profile.ready) continue;
        try { for (const name of profile.skills) await library.locate(settings, name); }
        catch { profile.ready = false; }
      }
      return { settings, migration: { required: settings.version === 1 }, kit: kitStatus(settings, inventories.Global ?? []), portableSettings: portableSettings(settings), settingsPath: store.path, home: store.home, inventories, nestedInventories, skillSharing, projectStatuses, projectMigration: this.projectMigration, toolRuns };
    }
    if (operation === "rules/save") {
      return await rules.saveFiles(data.files as RulesFile[], typeof data.expectedHash === "string" ? data.expectedHash : undefined);
    }
    if (operation === "rules/destination") {
      const updated = await rules.saveDestination(settings, data.destination as Parameters<typeof rules.saveDestination>[1]);
      return await rules.state(updated);
    }
    if (operation === "rules/preview") {
      return await rules.preview(settings, data.ids as string[]);
    }
    if (operation === "rules/sync") {
      if (!data.preview) throw new Error("Preview the changes before syncing.");
      const result = await rules.sync(settings, data.ids as string[], data.preview as RulesPreview);
      return { ...result, state: await rules.state(result.settings) };
    }
    if (operation === "rules/adopt") {
      return { content: await rules.adopt(settings, String(data.id)) };
    }
    if (operation === "rules/existing") {
      return await rules.existingText(settings, String(data.id));
    }
    if (operation === "rules/overwrite") {
      if (typeof data.expectedRegion !== "string") throw new Error("Review the current region before replacing it.");
      if (!data.expectedPreview) throw new Error("Provide the reviewed preview before replacing a conflict.");
      const result = await rules.overwrite(settings, String(data.id), data.expectedRegion, data.expectedPreview);
      return { ...result, state: await rules.state(result.settings) };
    }
    if (operation === "rules/disconnect") {
      const updated = await rules.disconnect(settings, String(data.id), data.clean === true);
      return await rules.state(updated);
    }
    if (operation === "bundle/preview") {
      return inspectBundle(String(data.base64));
    }
    if (operation === "bundle/import") {
      const mappings = data.mappings;
      const hasMapping = (value: unknown, key: "id" | "name"): boolean => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        const mapping = value as Record<string, unknown>;
        return typeof mapping[key] === "string" && typeof mapping.path === "string";
      };
      if (!Array.isArray(mappings) || !(mappings as unknown[]).every(m => hasMapping(m, "id"))) throw new Error("Choose local destination mappings.");
      const projects = data.projects;
      if (projects !== undefined && (!Array.isArray(projects) || !(projects as unknown[]).every(p => hasMapping(p, "name")))) throw new Error("Choose valid project folder mappings.");
      await applyBundle(store, String(data.base64), mappings as { id: string; path: string }[], projects as { name: string; path: string }[] | undefined);
      return { ok: true };
    }
    if (operation === "welcome") {
      settings.welcomeDismissed = true;
      await store.save(settings); return { ok: true };
    }
    if (operation === "settings") {
      const updated = validateSettings(data.settings);
      const definitions = (profiles: typeof settings.profiles): string => JSON.stringify(profiles.map(({ ready: _ready, ...profile }) => profile));
      if (definitions(updated.profiles) !== definitions(settings.profiles) || JSON.stringify(updated.managedLinks) !== JSON.stringify(settings.managedLinks)) throw new Error("Pack changes must use pack operations.");
      if (JSON.stringify(updated.preferences) !== JSON.stringify(settings.preferences)) throw new Error("Invocation changes must use the invocation operation.");
      if (updated.configurationId !== settings.configurationId) throw new Error("Configuration identity cannot be edited.");
      updated.profiles = settings.profiles;
      updated.independentSkills = settings.independentSkills;
      updated.machineOnly = settings.machineOnly;
      updated.agentRules = settings.agentRules;
      await store.save(updated); return { ok: true };
    }
    if (operation === "discover") {
      if (data.local === true) {
        const entries = await library.inventory(settings, "Global");
        return { names: entries.map(entry => entry.name), descriptions: Object.fromEntries(entries.map(entry => [entry.name, entry.description])) };
      }
      if (typeof data.source !== "string" || !data.source.trim()) throw new Error("Provide a source repository reference.");
      const source = String(data.source);
      const names = await preparation.discover(source);
      const directory = await preparation.directory(source);
      const descriptions = Object.fromEntries(await Promise.all(names.map(async name => [name, (await readNativeMetadata(join(directory, name))).description] as const)));
      return { names, descriptions, paths: await preparation.paths(source) };
    }
    if (operation === "pack/save") {
      const existing = typeof data.id === "string" && data.id ? settings.profiles.find(profile => profile.id === data.id) : undefined;
      const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : existing?.name;
      if (!name) throw new Error("Name the pack.");
      let groups: ProfileGroup[];
      if (data.groups !== undefined) {
        if (!Array.isArray(data.groups) || !data.groups.length || !data.groups.every(isProfileGroup)) throw new Error("Each pack group needs a source and at least one valid skill name.");
        groups = data.groups.map(group => ({ source: group.source.trim(), skills: [...group.skills] }));
      } else {
        const names = data.skills;
        if (!Array.isArray(names) || !names.length || !names.every(skillName) || new Set(names).size !== names.length) throw new Error("Name the pack and choose unique members.");
        groups = [{ source: String(data.source || LOCAL_PROFILE_SOURCE), skills: names }];
      }
      const id = existing?.id ?? (typeof data.id === "string" && data.id ? data.id : "profile-" + randomUUID());
      const pack = this.packFrom(existing, id, name, groups, {
        ...(typeof data.description === "string" && data.description.trim() ? { description: data.description.trim() } : {}),
        ...(data.sourceNames && typeof data.sourceNames === "object" ? { sourceNames: data.sourceNames as Record<string, string> } : {}),
      });
      if (typeof data.description === "string" && !data.description.trim()) delete pack.description;
      const memberGroups = profileGroups(pack);
      for (const group of memberGroups) {
        if (group.source === LOCAL_PROFILE_SOURCE) { for (const member of group.skills) await library.locate(settings, member); }
        else if (data.prepare === true) await library.storePrepared(settings, await preparation.directory(group.source), group.skills, group.source);
      }
      let ready = true;
      for (const member of pack.skills) { try { await library.locate(settings, member); } catch { ready = false; } }
      pack.ready = ready;
      await this.replacePack(settings, pack, memberGroups);
      return { ok: true, id };
    }
    if (operation === "pack/remove") {
      const pack = settings.profiles.find(profile => profile.id === data.id);
      if (!pack || pack.enabled.length) throw new Error("Turn this pack off everywhere before removing it.");
      settings.profiles = settings.profiles.filter(profile => profile.id !== data.id);
      await store.save(settings); return { ok: true };
    }
    if (operation === "project/save") {
      const previous = settings.projects.find(p => p.name === data.previous);
      if (typeof data.name !== "string" || typeof data.path !== "string") throw new Error("Choose a project name and folder.");
      if (previous && previous.path !== data.path && (await projectStatus(store, settings))[previous.name] === "missing") {
        const root = library.root(settings, previous.name), aliasRoot = resolve(root, "../../.claude/skills");
        for (const profile of settings.profiles) profile.enabled = profile.enabled.filter(scope => scope !== previous.name);
        delete settings.independentSkills[previous.name];
        settings.managedLinks = Object.fromEntries(Object.entries(settings.managedLinks).filter(([path]) => !path.startsWith(root + "/") && !path.startsWith(aliasRoot + "/")));
      }
      if (previous && previous.path !== data.path && settings.profiles.some(p => p.enabled.includes(previous.name))) throw new Error("Disable profiles before changing this project's folder.");
      if (previous && previous.path !== data.path) {
        const root = library.root(settings, previous.name);
        if (settings.independentSkills[previous.name]?.length || Object.keys(settings.managedLinks).some(path => path.startsWith(root + "/") || path.startsWith(resolve(root, "../../.claude/skills") + "/"))) throw new Error("Disable this project's managed individual skills before changing its folder.");
      }
      if (previous) {
        if (settings.independentSkills[previous.name] && previous.name !== data.name) {
          settings.independentSkills[data.name] = settings.independentSkills[previous.name]!;
          delete settings.independentSkills[previous.name];
        }
        for (const profile of settings.profiles) profile.enabled = profile.enabled.map(scope => scope === previous.name ? String(data.name) : scope);
        for (const key of Object.keys(settings.preferences)) {
          if (key.startsWith(previous.name + "|")) { settings.preferences[String(data.name) + key.slice(previous.name.length)] = settings.preferences[key]!; delete settings.preferences[key]; }
        }
        previous.name = data.name; previous.path = data.path;
      } else settings.projects.push({ name: data.name, path: data.path });
      await store.save(settings);
      if ((await projectStatus(store, settings))[data.name] === "present") await migrateProject(store, settings, data.name);
      return { ok: true };
    }
    if (operation === "project/remove") {
      const project = settings.projects.find(project => project.name === data.name);
      if (!project) throw new Error("Project not found.");
      const root = library.root(settings, project.name);
      const missingFolder = (await projectStatus(store, settings))[project.name] === "missing";
      if (missingFolder) {
        for (const profile of settings.profiles) profile.enabled = profile.enabled.filter(scope => scope !== project.name);
        delete settings.independentSkills[project.name];
        const aliasRoot = resolve(root, "../../.claude/skills");
        settings.managedLinks = Object.fromEntries(Object.entries(settings.managedLinks).filter(([path]) => !path.startsWith(root + "/") && !path.startsWith(aliasRoot + "/")));
      }
      const owned = Object.keys(settings.managedLinks).some(path => path.startsWith(root + "/") || path.startsWith(resolve(root, "../../.claude/skills") + "/"));
      if (settings.profiles.some(profile => profile.enabled.includes(project.name)) || settings.independentSkills[project.name]?.length || owned) throw new Error("Disable this project's profiles and managed individual skills before removing its definition.");
      settings.projects = settings.projects.filter(project => project.name !== data.name);
      settings.preferences = Object.fromEntries(Object.entries(settings.preferences).filter(([key]) => !key.startsWith(String(data.name) + "|")));
      delete settings.independentSkills[String(data.name)];
      await store.save(settings); return { ok: true };
    }
    if (operation === "location") { await store.relocate(String(data.path)); return { ok: true }; }
    if (operation === "workspace") {
      if (typeof data.folder !== "string" || !["move", "select", "create"].includes(String(data.mode))) throw new Error("Choose an AFK folder and action.");
      if (data.mode === "move") return { ok: true, backup: await store.moveFolder(data.folder) };
      if (data.mode === "select") await store.selectFolder(data.folder);
      else await store.relocate(join(data.folder, "settings.json"));
      return { ok: true };
    }
    if (operation === "folders") {
      const path = resolve(String(data.path ?? store.home));
      if (!(await stat(path)).isDirectory()) throw new Error("Choose a folder.");
      const entries = await readdir(path, { withFileTypes: true });
      return { path, parent: dirname(path), folders: entries.filter(e => e.isDirectory() && !e.name.startsWith(".")).map(e => e.name).sort(), files: entries.filter(e => e.isFile()).map(e => e.name).sort(), settings: entries.some(e => e.isFile() && e.name === "settings.json") };
    }
    if (operation === "activation") {
      if (typeof data.enabled !== "boolean") throw new Error("Provide enabled as true or false.");
      if (data.enabled) {
        const profile = settings.profiles.find(profile => profile.id === data.id);
        if (!profile) throw new Error("Pack not found.");
        const missing: string[] = [];
        for (const name of profile.skills) {
          try { await library.locate(settings, name); } catch { missing.push(name); }
        }
        const downloads = profileGroups(profile).map(group => ({ group, absent: group.skills.filter(name => missing.includes(name)) })).filter(item => item.absent.length);
        for (const { group, absent } of downloads) if (group.source === LOCAL_PROFILE_SOURCE) throw new Error(`Restore these local skill files before enabling: ${absent.join(", ")}. They have no repository source.`);
        if (downloads.length) await this.downloadPackSkills(settings, profile.name, downloads);
        profile.ready = true;
      }
      await library.activate(settings, String(data.id), String(data.scope), data.enabled === true); return { ok: true };
    }
    if (operation === "invocation") {
      await setInvocation(store, settings, String(data.name), String(data.scope), String(data.mode)); return { ok: true };
    }
    if (operation === "import") {
      if (settings.profiles.some(p => p.enabled.length)) throw new Error("Disable current profiles before replacing the configuration.");
      if (Object.keys(settings.managedLinks).length || Object.values(settings.independentSkills).some(names => names.length)) throw new Error("Disable active individual skills and resolve managed links before replacing the configuration.");
      const parsed = validateSettings(data.settings);
      const imported = parsed.version === 1 ? migrateSettings(parsed, {}, []).settings : parsed;
      imported.managedLinks = {};
      imported.independentSkills = {};
      imported.profiles = imported.profiles.map(p => ({ ...p, enabled: [], ready: false }));
      imported.agentRules = settings.agentRules;
      imported.machineOnly = settings.machineOnly;
      await store.save(imported, { replace: true }); return { ok: true };
    }
    if (operation === "skills/delete-preview" || operation === "skills/bulk") {
      const names = data.names as string[], scope = String(data.scope);
      const review = async () => {
        const latest = await store.read();
        const inventory = await new SkillLibrary(store).inventory(latest, scope);
        const items = [];
        for (const name of names) {
          try { items.push({ name, preview: await previewDeletion(store, latest, name, scope, inventory) }); }
          catch (error) { items.push({ name, error: error instanceof Error ? error.message : "Cannot delete this skill." }); }
        }
        return { names, scope, items };
      };
      if (operation === "skills/delete-preview") return await review();
      const deletion = data.action === "delete" ? await review() : undefined;
      if (deletion && (data.confirmed !== true || JSON.stringify(data.expected) !== JSON.stringify(deletion))) throw new Error("Review and confirm the current selected deletions before applying them.");
      const items: { name: string; ok: boolean; error?: string }[] = [];
      for (const name of names) {
        try {
          if (data.action === "delete") {
            const item = deletion?.items.find(item => item.name === name);
            if (!item?.preview) throw new Error(item?.error ?? "No reviewed deletion for this skill.");
            await this.apply("skill/delete", { name, scope, expected: item.preview, confirmed: true });
          } else if (data.action === "invocation") {
            await this.apply("invocation", { name, scope, mode: data.mode });
          } else {
            await this.apply("skill/availability", { name, scope, enabled: data.action === "enable" });
          }
          items.push({ name, ok: true });
        } catch (error) { items.push({ name, ok: false, error: error instanceof Error ? error.message : "Skill operation failed." }); }
      }
      return { items, completed: items.filter(item => item.ok).length, failed: items.filter(item => !item.ok).length };
    }
    if (operation === "skills-sharing/state") return await sharingState(store, settings, String(data.scope));
    if (operation === "skills-sharing/set") {
      if (typeof data.enabled !== "boolean") throw new Error("Provide enabled as true or false.");
      await setSharing(store, settings, String(data.scope), data.enabled, data.expected);
      return { ok: true };
    }
    if (operation === "skill/delete-preview") return await previewDeletion(store, settings, String(data.name), String(data.scope));
    if (operation === "skill/delete") {
      await deleteSkill(store, settings, String(data.name), String(data.scope), data.expected, data.confirmed === true);
      return { ok: true };
    }
    if (operation === "skill/resolve-duplicate") {
      if (data.keep !== "installed" && data.keep !== "stored") throw new Error("Choose installed or stored.");
      await resolveDuplicate(store, settings, String(data.name), String(data.scope), data.keep);
      return { ok: true };
    }
    if (operation === "agent-folders/state") return await agentFolderState(store.home);
    if (operation === "agent-folders/enable" || operation === "agent-folders/disable" || operation === "agent-folders/remove" || operation === "agent-folders/add") {
      return await changeAgentFolders(store.home, operation.slice("agent-folders/".length) as "enable" | "disable" | "add" | "remove", data);
    }
    if (operation === "skill/adopt") {
      if (!skillName(data.name)) throw new Error("Choose a valid skill name.");
      await adoptSkill(library, settings, data.name, data.to as AdoptDestination, data.bookmark === true); return { ok: true };
    }
    if (operation === "skill/toggle") {
      await library.toggle(settings, String(data.name), String(data.scope)); return { ok: true };
    }
    if (operation === "skill/availability") {
      if (typeof data.enabled !== "boolean") throw new Error("Provide enabled as true or false.");
      const scope = String(data.scope), name = String(data.name);
      const entry = (await library.inventory(settings, scope)).find(skill => skill.name === name);
      if (!entry) throw new Error("Skill not found in the selected scope.");
      if (entry.available !== data.enabled) await library.toggle(settings, name, scope);
      return { ok: true, available: data.enabled };
    }
    if (operation === "skill/read") {
      const entry = typeof data.folder === "string"
        ? (await library.nested(settings, String(data.scope))).find(skill => skill.name === data.name && skill.folder === data.folder)
        : (await library.inventory(settings, String(data.scope))).find(skill => skill.name === data.name);
      if (!entry) throw new Error("Skill not found in the selected scope.");
      const path = entry.path;
      const base = await realpath(path);
      const file = typeof data.file === "string" ? data.file : "SKILL.md";
      const target = await realpath(resolve(base, file));
      if (!target.startsWith(base + sep)) throw new Error("Choose a file inside the skill folder.");
      const files: string[] = [];
      const walk = async (directory: string, prefix: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          if (entry.name.startsWith(".") || files.length >= 200) continue;
          const relative = prefix + entry.name;
          if (entry.isDirectory()) await walk(join(directory, entry.name), relative + "/");
          else if (entry.isFile()) files.push(relative);
        }
      };
      await walk(base, "");
      if ((await stat(target)).size > 500_000) throw new Error("This file is too large to preview. Open it from the displayed skill folder.");
      return { path, files, file, content: await readFile(target, "utf8") };
    }
    if (operation === "pack/read") { return { content: await library.readGroup(settings, String(data.id)) }; }
    if (operation === "tool/run") {
      const tool = settings.tools.find(t => t.id === data.id);
      if (!tool) throw new Error("Tool not found.");
      if (toolRuns[tool.id]?.pending) throw new Error("This tool command is already running. Reopen its results to follow it.");
      const command = data.update === true ? tool.update || tool.install : tool.install;
      toolRuns[tool.id] = { pending: true, output: "Running…" };
      try {
        const finish = await trackToolRun(store, tool);
        const result = await finish(await runTool(process.env.SHELL || "/bin/sh", ["-c", command], store.home, this.lifecycle.signal));
        toolRuns[tool.id] = { pending: false, ...result }; return result;
      } catch (error) {
        toolRuns[tool.id] = { pending: false, code: 1, output: error instanceof Error ? error.message : "Command could not start." }; throw error;
      }
    }
    throw new Error("Unknown operation.");
  }
}
