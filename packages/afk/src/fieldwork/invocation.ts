import { cp, lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseDocument } from "yaml";
import { SkillLibrary } from "./skills.js";
import type { Settings, SettingsStore } from "./settings.js";

async function readOptional(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

function frontmatter(skill: string) {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(skill);
  if (!match) throw new Error("SKILL.md needs YAML frontmatter before setting invocation.");
  const document = parseDocument(match[2]!);
  if (document.errors.length) throw new Error("Skill frontmatter is invalid YAML.");
  return { document, body: skill.slice(match[0].length) };
}

export async function setInvocation(store: SettingsStore, settings: Settings, name: string, scope: string, mode: string): Promise<void> {
  if (!["", "Manual only", "Automatic allowed"].includes(mode)) throw new Error("Choose a supported invocation mode.");
  const library = new SkillLibrary(store);
  const originalPath = await library.locate(settings, name, scope);
  const source = scope !== "Global" ? (await library.inventory(settings, scope)).find(entry => entry.name === name)?.source : undefined;
  const override = join(library.root(settings, scope), ".afk-overrides", name);
  const info = await lstat(originalPath);
  const linkTarget = info.isSymbolicLink() ? resolve(dirname(originalPath), await readlink(originalPath)) : undefined;
  const clonesProjectCopy = scope !== "Global" && linkTarget !== undefined && linkTarget !== override;
  const path = clonesProjectCopy ? override : originalPath;
  const alias = join(library.root(settings, scope), "../../.claude/skills", name);
  const originalLinks = { ...settings.managedLinks };
  const originalPreferences = { ...settings.preferences };
  if (!mode && scope !== "Global" && linkTarget === override) {
    const shared = await library.locate(settings, name);
    const resetsAlias = originalLinks[alias] === override;
    try {
      await rm(originalPath); await symlink(shared, originalPath, "dir");
      if (originalLinks[originalPath]) settings.managedLinks[originalPath] = shared;
      if (resetsAlias) { await rm(alias); await symlink(shared, alias, "dir"); settings.managedLinks[alias] = shared; }
      delete settings.preferences[`${scope}|${name}`];
      await store.save(settings);
    } catch (error) {
      await rm(originalPath, { force: true }); await symlink(override, originalPath, "dir");
      if (resetsAlias) { await rm(alias, { force: true }); await symlink(override, alias, "dir"); }
      settings.managedLinks = originalLinks; settings.preferences = originalPreferences;
      throw error;
    }
    await rm(override, { recursive: true, force: true });
    return;
  }
  const skill = await readFile(join(originalPath, "SKILL.md"), "utf8");
  const metadata = await readOptional(join(originalPath, "agents/openai.yaml"));
  const backupText = await readOptional(join(originalPath, ".afk-invocation-original.json"));
  const backup = backupText ? JSON.parse(backupText) as { skill: string; metadata: string | null } : { skill, metadata };
  const parsed = frontmatter(skill);
  const agent = parseDocument(metadata ?? "{}");
  if (agent.errors.length) throw new Error("agents/openai.yaml is invalid YAML.");
  if (mode) {
    parsed.document.set("disable-model-invocation", mode === "Manual only");
    agent.setIn(["policy", "allow_implicit_invocation"], mode !== "Manual only");
  } else {
    let origin = backup;
    if (scope !== "Global" && linkTarget !== undefined) {
      const shared = await library.locate(settings, name);
      origin = { skill: await readFile(join(shared, "SKILL.md"), "utf8"), metadata: await readOptional(join(shared, "agents/openai.yaml")) };
    }
    const original = frontmatter(origin.skill).document;
    if (original.has("disable-model-invocation")) parsed.document.set("disable-model-invocation", original.get("disable-model-invocation"));
    else parsed.document.delete("disable-model-invocation");
    const originalAgent = parseDocument(origin.metadata ?? "{}");
    if (originalAgent.hasIn(["policy", "allow_implicit_invocation"])) agent.setIn(["policy", "allow_implicit_invocation"], originalAgent.getIn(["policy", "allow_implicit_invocation"]));
    else agent.deleteIn(["policy", "allow_implicit_invocation"]);
  }
  let cloned = false;
  try {
    if (clonesProjectCopy) {
      await mkdir(dirname(override), { recursive: true });
      await cp(originalPath, override, { recursive: true, dereference: true, force: false, errorOnExist: true });
      cloned = true;
      if (source) await writeFile(join(override, ".afk-source.json"), JSON.stringify({ source }), { mode: 0o600 });
      await rm(originalPath); await symlink(override, originalPath, "dir");
      if (settings.managedLinks[originalPath]) settings.managedLinks[originalPath] = override;
      if (originalLinks[alias] === linkTarget) {
        await rm(alias); await symlink(override, alias, "dir"); settings.managedLinks[alias] = override;
      }
    }
    if (!backupText) await writeFile(join(path, ".afk-invocation-original.json"), JSON.stringify(backup), { mode: 0o600 });
    await mkdir(join(path, "agents"), { recursive: true });
    await writeFile(join(path, "SKILL.md"), `---\n${parsed.document.toString()}---\n${parsed.body}`);
    await writeFile(join(path, "agents/openai.yaml"), agent.toString());
    const key = `${scope}|${name}`;
    if (mode) settings.preferences[key] = mode;
    else delete settings.preferences[key];
    await store.save(settings);
  } catch (error) {
    settings.managedLinks = originalLinks; settings.preferences = originalPreferences;
    if (cloned) {
      await rm(originalPath); await symlink(linkTarget!, originalPath, "dir");
      if (originalLinks[alias] === linkTarget) { await rm(alias, { force: true }); await symlink(linkTarget!, alias, "dir"); }
      await rm(override, { recursive: true, force: true });
    } else {
      await writeFile(join(path, "SKILL.md"), skill);
      if (metadata === null) await rm(join(path, "agents/openai.yaml"), { force: true });
      else await writeFile(join(path, "agents/openai.yaml"), metadata);
    }
    throw error;
  }
}
