import { installSkills, type InstallProgress } from "./skill-install.js";
import { updateSkills, type UpdateProgress } from "./skill-update.js";
import { sharingState, setSharing } from "./sharing.js";
import { deleteSkill, previewDeletion } from "./deletion.js";
import { fetchStack, manifestUrl, stackInstallScript, validateSavedStack, validateStack } from "./stacks.js";
import { randomUUID } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { SettingsStore, validateSettings, skillName } from "./settings.js";
import { setInvocation } from "./invocation.js";
import { SourcePreparation } from "./preparation.js";
import { SkillLibrary } from "./skills.js";
import { readNativeMetadata } from "./skill-metadata.js";
import { RulesWorkspace, type RulesFile, type RulesPreview } from "./rules.js";
import { exportBundle, inspectBundle, applyBundle } from "./bundle.js";
import { operationCatalog, type Operation } from "./operation-catalog.js";

function validateInput(operation: Operation, data: Record<string, unknown>): void {
  for (const key of Object.keys(data)) {
    if (!Object.hasOwn(operationCatalog[operation].input, key)) throw new Error(`Unknown ${operation} input field: ${key}. Read manage describe ${operation}.`);
  }
  const requiredText: Partial<Record<Operation, string[]>> = {
    "stack/install": ["id", "scope", "agent"], "source/install": ["source", "scope", "agent"],
    "profile/remove": ["id"], "profile/read": ["id"], "profile/save": ["name"],
    activation: ["id", "scope"], "project/save": ["name", "path"],
    invocation: ["name", "scope"], "skill/toggle": ["name", "scope"],
    "skills/update": ["scope"], "skills/delete-preview": ["scope"], "skills/bulk": ["scope", "action"],
    "skills-sharing/state": ["scope"], "skills-sharing/set": ["scope"],
    "skill/delete-preview": ["name", "scope"], "skill/delete": ["name", "scope"],
    "skill/availability": ["name", "scope"], "skill/read": ["name", "scope"],
    "rules/existing": ["id"], "rules/adopt": ["id"], "rules/overwrite": ["id"],
    "rules/disconnect": ["id"], workspace: ["mode", "folder"], location: ["path"],
    "bundle/preview": ["base64"], "bundle/import": ["base64"],
  };
  const optionalText: Partial<Record<Operation, string[]>> = {
    "profile/save": ["id", "source"], "project/save": ["previous"],
    "skill/read": ["file"], "rules/save": ["expectedHash"], folders: ["path"],
  };
  for (const key of requiredText[operation] ?? []) {
    if (typeof data[key] !== "string" || !data[key].trim()) throw new Error(`Provide ${key} as a nonempty string.`);
  }
  for (const key of optionalText[operation] ?? []) {
    if (data[key] !== undefined && typeof data[key] !== "string") throw new Error(`Provide ${key} as a string.`);
  }
  for (const key of ["local", "update", "clean", "enabled", "confirmed"]) {
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
  if (operation === "tool/run" && !Number.isSafeInteger(data.id)) throw new Error("Provide a numeric saved tool ID.");
  if (operation === "rules/preview" || operation === "rules/sync") {
    if (!Array.isArray(data.ids) || !data.ids.length || !data.ids.every(skillName) || new Set(data.ids).size !== data.ids.length) throw new Error("Choose unique rule destination IDs.");
  }
}

export function runCommand(command: string, args: string[], cwd: string): Promise<{ output: string; code: number }> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer): void => { output = (output + chunk.toString()).slice(-100_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", code => accept({ output, code: code ?? 1 }));
  });
}

export class FieldworkOperations {
  private readonly library: SkillLibrary;
  private readonly rules: RulesWorkspace;
  private readonly preparation = new SourcePreparation();
  private installController: AbortController | null = null;
  private skillInstall: InstallProgress | null = null;
  private updateController: AbortController | null = null;
  private skillUpdate: UpdateProgress | null = null;
  private mutations: Promise<void> = Promise.resolve();
  private readonly toolRuns: Record<number, { pending: boolean; output: string; code?: number }> = {};

  constructor(readonly store: SettingsStore) {
    this.library = new SkillLibrary(store);
    this.rules = new RulesWorkspace(store);
  }

  run(operation: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (!Object.hasOwn(operationCatalog, operation)) return Promise.reject(new Error("Unknown operation. Run afk manage describe for supported operations."));
    const action = (): Promise<unknown> => this.apply(operation as Operation, data);
    if (["state", "rules/state", "bundle/export", "tool/run", "skills/update-state", "skills/update-cancel", "skills/install-state", "skills/install-cancel"].includes(operation)) return action();
    const result = this.mutations.then(action);
    this.mutations = result.then(() => undefined, () => undefined);
    return result;
  }

  async close(): Promise<void> {
    await this.mutations;
    await this.preparation.close();
  }

  private async apply(operation: Operation, data: Record<string, unknown>): Promise<unknown> {
    if (operation === "skills/install-state") { validateInput(operation, data); return this.skillInstall; }
    if (operation === "skills/install-cancel") {
      validateInput(operation, data);
      if (!this.skillInstall?.pending) return { cancelled: false, reason: "No installation is running." };
      this.installController?.abort(); return { cancelled: true };
    }
    if (operation === "skills/update-state") return this.skillUpdate;
    if (operation === "skills/update-cancel") {
      validateInput(operation, data);
      if (!this.skillUpdate?.pending) return { cancelled: false, reason: "No skill update is running." };
      if (!this.skillUpdate.cancellable) return { cancelled: false, reason: "File replacement has started. Finishing safely." };
      this.updateController?.abort();
      return { cancelled: true };
    }
    validateInput(operation, data);
    const { store, library, rules, preparation, toolRuns } = this;
    const settings = await store.read();
    if (operation === "stack/install" || operation === "source/install") {
      const stack = operation === "stack/install" ? settings.stacks?.find(stack => stack.manifest.id === data.id) : undefined;
      const source = operation === "source/install" ? settings.favoriteSources?.find(source => source.source === data.source) : undefined;
      if (!stack && !source) throw new Error("Saved source or stack not found.");
      if (operation === "source/install" && data.skills !== undefined) {
        if (!Array.isArray(data.skills) || !data.skills.length || !data.skills.every(skillName) || new Set(data.skills).size !== data.skills.length) throw new Error("Choose unique skill names for this installation.");
        if (source?.skills && data.skills.some(name => !source.skills!.includes(name))) throw new Error("Choose skills from the bookmark’s saved selection.");
      }
      const groups = stack ? stack.manifest.sources : [{ ...source!, ...(data.skills ? { skills: data.skills as string[] } : {}) }];
      const label = stack ? stack.manifest.name : source!.name;
      this.installController = new AbortController();
      try {
        this.skillInstall = await installSkills(store, settings, groups, String(data.scope), String(data.agent), label, value => { this.skillInstall = value; }, this.installController.signal);
        return this.skillInstall;
      } finally { this.installController = null; }
    }
    if (operation === "skills/update") {
      const scope = String(data.scope);
      this.updateController = new AbortController();
      try {
        this.skillUpdate = await updateSkills(store, settings, scope, value => { this.skillUpdate = value; }, undefined, this.updateController.signal, data.names as string[] | undefined);
        return this.skillUpdate;
      } catch (error) {
        this.skillUpdate = { pending: false, phase: "Update failed; review the details", output: (this.skillUpdate?.output || "") + "\n" + (error instanceof Error ? error.message : "Update failed"), code: 1, scope };
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
      const inventories: Record<string, Awaited<ReturnType<SkillLibrary["inventory"]>>> = {};
      const skillSharing: Record<string, Awaited<ReturnType<typeof sharingState>>> = {};
      for (const scope of ["Global", ...settings.projects.map(p => p.name)]) {
        inventories[scope] = await library.inventory(settings, scope);
        skillSharing[scope] = await sharingState(store, settings, scope);
      }
      for (const profile of settings.profiles) {
        if (!profile.ready) continue;
        try { for (const name of profile.skills) await library.locate(settings, name); }
        catch { profile.ready = false; }
      }
      return { settings, settingsPath: store.path, home: store.home, inventories, skillSharing, toolRuns };
    }
    if (operation === "rules/save") {
      return await rules.saveFiles(data.files as RulesFile[], typeof data.expectedHash === "string" ? data.expectedHash : undefined);
    }
    if (operation === "rules/destination") {
      const updated = await rules.saveDestination(settings, data.destination as NonNullable<typeof settings.agentRules>["destinations"][number]);
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
      if (definitions(updated.profiles) !== definitions(settings.profiles) || JSON.stringify(updated.managedLinks) !== JSON.stringify(settings.managedLinks)) throw new Error("Profile changes must use profile operations.");
      if (JSON.stringify(updated.preferences) !== JSON.stringify(settings.preferences)) throw new Error("Invocation changes must use the invocation operation.");
      updated.profiles = settings.profiles;
      updated.independentSkills = settings.independentSkills;
      updated.agentRules = settings.agentRules;
      await store.save(updated); return { ok: true };
    }
    if (operation === "stack/script") {
      const stack = settings.stacks?.find(entry => entry.manifest.id === data.id);
      if (!stack) throw new Error("Stack not found.");
      return { script: stackInstallScript(stack.manifest, String(data.scope ?? "Global"), String(data.agent ?? "interactive"), settings.projects) };
    }
    if (operation === "stack/preview") {
      if ((data.manifest === undefined) === (data.origin === undefined)) throw new Error("Provide pasted manifest JSON or its HTTPS URL, not both.");
      const origin = data.origin === undefined ? undefined : manifestUrl(data.origin);
      const manifest = origin ? await fetchStack(origin) : validateStack(typeof data.manifest === "string" ? JSON.parse(data.manifest) : data.manifest);
      if (data.id !== undefined && data.id !== manifest.id) throw new Error("The manifest ID changed. Import it as a new stack instead.");
      return { stack: { manifest, ...(origin ? { origin } : {}) }, expected: settings.stacks?.find(stack => stack.manifest.id === manifest.id) ?? null };
    }
    if (operation === "stack/save" || operation === "stack/remove") {
      const stack = operation === "stack/save" ? validateSavedStack(data.stack) : undefined;
      const id = stack?.manifest.id ?? data.id;
      if (!skillName(id)) throw new Error("Choose a valid stack ID.");
      const existing = settings.stacks?.find(entry => entry.manifest.id === id) ?? null;
      if (data.expected === undefined || JSON.stringify(data.expected) !== JSON.stringify(existing)) throw new Error("This stack changed since review. Review it again before saving or removing.");
      if (!stack && !existing) throw new Error("Stack not found.");
      settings.stacks = (settings.stacks ?? []).filter(entry => entry.manifest.id !== id);
      if (stack) settings.stacks.push(stack);
      await store.save(settings); return { ok: true };
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
    if (operation === "profile/save") {
      const names = data.skills;
      if (!Array.isArray(names) || !names.length || !names.every(skillName) || new Set(names).size !== names.length || typeof data.name !== "string" || !data.name.trim()) throw new Error("Name the profile and choose unique members.");
      const source = String(data.source || "Local skill selection");
      const existing = settings.profiles.find(p => p.id === data.id);
      if (existing?.enabled.length) throw new Error("Disable every scope before editing members.");
      if (source === "Local skill selection") {
        for (const name of names) await library.locate(settings, name);
      } else {
        await library.storePrepared(settings, await preparation.directory(source), names);
      }
      const profile = { id: existing?.id ?? "profile-" + randomUUID(), name: data.name.trim(), source, skills: names, enabled: [], ready: true };
      settings.profiles = [...settings.profiles.filter(p => p.id !== profile.id), profile];
      await store.save(settings); return { ok: true };
    }
    if (operation === "profile/remove") {
      const profile = settings.profiles.find(p => p.id === data.id);
      if (!profile || profile.enabled.length) throw new Error("Disable every scope before removing this profile.");
      settings.profiles = settings.profiles.filter(p => p.id !== data.id);
      await store.save(settings); return { ok: true };
    }
    if (operation === "project/save") {
      const previous = settings.projects.find(p => p.name === data.previous);
      if (typeof data.name !== "string" || typeof data.path !== "string") throw new Error("Choose a project name and folder.");
      if (previous && previous.path !== data.path && settings.profiles.some(p => p.enabled.includes(previous.name))) throw new Error("Disable profiles before changing this project's folder.");
      if (previous) {
        for (const profile of settings.profiles) profile.enabled = profile.enabled.map(scope => scope === previous.name ? String(data.name) : scope);
        for (const key of Object.keys(settings.preferences)) {
          if (key.startsWith(previous.name + "|")) { settings.preferences[String(data.name) + key.slice(previous.name.length)] = settings.preferences[key]!; delete settings.preferences[key]; }
        }
        previous.name = data.name; previous.path = data.path;
      } else settings.projects.push({ name: data.name, path: data.path });
      await store.save(settings); return { ok: true };
    }
    if (operation === "location") { await store.relocate(String(data.path)); return { ok: true }; }
    if (operation === "workspace") {
      if (typeof data.folder !== "string" || !["move", "select", "create"].includes(String(data.mode))) throw new Error("Choose an AFK folder and action.");
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
        if (!profile) throw new Error("Profile not found.");
        const missing: string[] = [];
        for (const name of profile.skills) {
          try { await library.locate(settings, name); } catch { missing.push(name); }
        }
        if (missing.length) {
          if (profile.source === "Local skill selection") throw new Error(`Restore these local skill files before enabling: ${missing.join(", ")}. This profile has no repository source.`);
          await library.storePrepared(settings, await preparation.directory(profile.source), missing);
        }
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
      const imported = validateSettings(data.settings);
      imported.managedLinks = {};
      imported.independentSkills = {};
      imported.profiles = imported.profiles.map(p => ({ ...p, enabled: [], ready: false }));
      imported.agentRules = settings.agentRules;
      await store.save(imported); return { ok: true };
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
      const entry = (await library.inventory(settings, String(data.scope))).find(skill => skill.name === data.name);
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
    if (operation === "profile/read") { return { content: await library.readGroup(settings, String(data.id)) }; }
    if (operation === "tool/run") {
      const tool = settings.tools.find(t => t.id === data.id);
      if (!tool) throw new Error("Tool not found.");
      if (toolRuns[tool.id]?.pending) throw new Error("This tool command is already running. Reopen its results to follow it.");
      const command = data.update === true ? tool.update || tool.install : tool.install;
      toolRuns[tool.id] = { pending: true, output: "Running…" };
      try {
        const result = await runCommand(process.env.SHELL || "/bin/sh", ["-c", command], store.home);
        toolRuns[tool.id] = { pending: false, ...result }; return result;
      } catch (error) {
        toolRuns[tool.id] = { pending: false, code: 1, output: error instanceof Error ? error.message : "Command could not start." }; throw error;
      }
    }
    throw new Error("Unknown operation.");
  }
}
