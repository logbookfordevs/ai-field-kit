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
    "profile/remove": ["id"], "profile/read": ["id"], "profile/save": ["name"],
    activation: ["id", "scope"], "project/save": ["name", "path"],
    invocation: ["name", "scope"], "skill/toggle": ["name", "scope"],
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
  for (const key of ["local", "update", "clean", "enabled"]) {
    if (data[key] !== undefined && typeof data[key] !== "boolean") throw new Error(`Provide ${key} as true or false.`);
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
  private mutations: Promise<void> = Promise.resolve();
  private readonly toolRuns: Record<number, { pending: boolean; output: string; code?: number }> = {};

  constructor(readonly store: SettingsStore) {
    this.library = new SkillLibrary(store);
    this.rules = new RulesWorkspace(store);
  }

  run(operation: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (!Object.hasOwn(operationCatalog, operation)) return Promise.reject(new Error("Unknown operation. Run afk manage describe for supported operations."));
    const action = (): Promise<unknown> => this.apply(operation as Operation, data);
    if (["state", "rules/state", "bundle/export", "tool/run"].includes(operation)) return action();
    const result = this.mutations.then(action);
    this.mutations = result.then(() => undefined, () => undefined);
    return result;
  }

  async close(): Promise<void> {
    await this.mutations;
    await this.preparation.close();
  }

  private async apply(operation: Operation, data: Record<string, unknown>): Promise<unknown> {
    validateInput(operation, data);
    const { store, library, rules, preparation, toolRuns } = this;
    const settings = await store.read();
    if (operation === "rules/state") {
      return await rules.state(settings);
    }
    if (operation === "bundle/export") {
      return await exportBundle(store);
    }
    if (operation === "state") {
      const inventories: Record<string, Awaited<ReturnType<SkillLibrary["inventory"]>>> = {};
      for (const scope of ["Global", ...settings.projects.map(p => p.name)]) inventories[scope] = await library.inventory(settings, scope);
      for (const profile of settings.profiles) {
        if (!profile.ready) continue;
        try { for (const name of profile.skills) await library.locate(settings, name); }
        catch { profile.ready = false; }
      }
      return { settings, settingsPath: store.path, home: store.home, inventories, toolRuns };
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
      const path = await library.locate(settings, String(data.name), String(data.scope));
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
