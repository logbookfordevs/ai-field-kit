import { lstat, readFile, readlink, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Library } from "./library.js";
import { RulesWorkspace } from "./rules.js";
import { requiresMigrationChoice, expandPath, type Settings, type SettingsStore, validateSettings } from "./settings.js";
import { SkillLibrary } from "./skills.js";

export interface DoctorIssue {
  severity: "error" | "warning";
  code: string;
  path?: string;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  settingsPath: string;
  issues: DoctorIssue[];
  checked: { profiles: number; projects: number; managedLinks: number; rulesDestinations: number; core: number };
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function missing(error: unknown): boolean { return ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? ""); }

export async function doctor(store: SettingsStore): Promise<DoctorReport> {
  const report: DoctorReport = {
    ok: true, settingsPath: store.path, issues: [],
    checked: { profiles: 0, projects: 0, managedLinks: 0, rulesDestinations: 0, core: 0 },
  };
  const issue = (severity: DoctorIssue["severity"], code: string, path: string, message: string): void => {
    report.issues.push({ severity, code, path, message });
    if (severity === "error") report.ok = false;
  };
  let text: string;
  try { text = await readFile(store.path, "utf8"); }
  catch (error) {
    if (missing(error)) issue("warning", "settings_missing", store.path, "No settings file exists here. Open AFK or save settings intentionally to create it.");
    else issue("error", "settings_unreadable", store.path, errorText(error));
    return report;
  }
  let input: unknown;
  try { input = JSON.parse(text); }
  catch (error) { issue("error", "settings_invalid_json", store.path, errorText(error)); return report; }
  let settings: Settings;
  try { validateSettings(input); settings = await store.read(); }
  catch (error) { issue("error", "settings_invalid", store.path, errorText(error)); return report; }

  if (requiresMigrationChoice(settings)) issue("warning", "migration_required", store.path, "These settings use the old stacks format. Run `afk migrate` to review moving them to the kit format.");
  report.checked.core = (settings.kit?.core ?? []).reduce((total, entry) => total + entry.skills.length, 0);
  const library = new SkillLibrary(store);
  for (const project of settings.projects) {
    report.checked.projects++;
    const path = expandPath(project.path, store.home);
    try {
      if (!(await stat(path)).isDirectory()) issue("warning", "project_missing", path, `Project ${project.name} does not map to a folder. Review its folder mapping.`);
    } catch (error) {
      issue(missing(error) ? "warning" : "error", missing(error) ? "project_missing" : "project_unreadable", path, missing(error) ? `Project ${project.name} folder is missing. Review its folder mapping.` : errorText(error));
    }
  }

  const checkedExposures = new Set<string>();
  const checkExposure = async (name: string, scope: string, owner: string): Promise<void> => {
    const root = library.root(settings, scope);
    const storage = new Library(store.home);
    const exposures = scope === "Global" && await storage.storage(name) ? await storage.links(name) : [join(root, name), join(root, "../../.claude/skills", name)];
    for (const path of exposures) {
      if (checkedExposures.has(path)) continue;
      checkedExposures.add(path);
      try {
        if (!(await stat(join(path, "SKILL.md"))).isFile()) issue("error", "skill_exposure_missing", path, `${owner} member ${name} has no skill instructions exposed in ${scope}.`);
      } catch (error) {
        issue("error", missing(error) ? "skill_exposure_missing" : "skill_exposure_unreadable", path, missing(error) ? `${owner} member ${name} is not exposed in ${scope}.` : errorText(error));
      }
    }
  };

  for (const profile of settings.profiles) {
    report.checked.profiles++;
    if (!profile.ready && profile.enabled.length) issue("error", "profile_not_ready", store.path, `Active profile ${profile.id} is not marked prepared. Prepare it before enabling it.`);
    if (!profile.ready && !profile.enabled.length) continue;
    for (const name of profile.skills) {
      try { await readFile(join(await library.locate(settings, name), "SKILL.md"), "utf8"); }
      catch (error) { issue("error", "profile_skill_missing", join(library.root(settings, "Global"), ".disabled", name), `Profile ${profile.id} cannot read its prepared member ${name}: ${errorText(error)}`); }
      for (const scope of new Set(profile.enabled)) await checkExposure(name, scope, `Active profile ${profile.id}`);
    }
  }

  for (const [scope, members] of Object.entries(settings.independentSkills)) {
    if (!members.length) continue;
    const configured = scope === "Global" || settings.projects.some(project => project.name === scope);
    if (!configured) {
      issue("warning", "skill_scope_missing", store.path, `Independent activation refers to missing project ${scope}. Review its activation state.`);
      continue;
    }
    for (const name of members) await checkExposure(name, scope, "Independent activation");
  }

  for (const [path, target] of Object.entries(settings.managedLinks)) {
    report.checked.managedLinks++;
    try {
      if (!(await lstat(path)).isSymbolicLink()) {
        issue("warning", "managed_link_replaced", path, "A recorded AFK link is now a user-owned file or folder. Review the stale receipt; the existing entry was preserved.");
        continue;
      }
      const actual = resolve(dirname(path), await readlink(path));
      if (actual !== target) {
        issue("warning", "managed_link_target_mismatch", path, `A recorded AFK link now targets ${actual} instead of ${target}. Review the stale receipt; the link was preserved.`);
        continue;
      }
      try { await stat(path); }
      catch (error) { issue("error", missing(error) ? "managed_link_target_missing" : "managed_link_unreadable", path, missing(error) ? `The recorded link target is missing: ${target}` : errorText(error)); }
    } catch (error) {
      issue(missing(error) ? "warning" : "error", missing(error) ? "managed_link_missing" : "managed_link_unreadable", path, missing(error) ? "A recorded AFK link is missing. Review activation and its stale receipt." : errorText(error));
    }
  }

  for (const scope of ["Global", ...settings.projects.map(project => project.name)]) {
    try {
      for (const copy of await library.duplicates(settings, scope)) {
        issue("warning", "skill_duplicate_copy", copy.live, `${copy.name} has a second, ${copy.identical ? "identical" : "different"} copy in stored storage (${copy.stored}). Resolve it in Installed Skills or with skill/resolve-duplicate.`);
      }
    } catch (error) { if (!missing(error)) issue("error", "skill_duplicate_unreadable", scope, errorText(error)); }
  }

  const rules = new RulesWorkspace(store);
  let hasRules = settings.agentRules !== undefined;
  for (const path of [join(rules.folder, "AGENTS.md"), join(rules.folder, "references")]) {
    try { await lstat(path); hasRules = true; }
    catch (error) { if (!missing(error)) { hasRules = true; issue("error", "rules_unreadable", path, errorText(error)); } }
  }
  if (hasRules) {
    const state = await rules.state(settings);
    for (const message of state.errors) issue("error", "rules_invalid", rules.folder, message);
    for (const destination of state.destinations) {
      report.checked.rulesDestinations++;
      if (destination.status === "conflict") issue("error", "rules_destination_conflict", destination.path, destination.reason);
    }
  }
  return report;
}
