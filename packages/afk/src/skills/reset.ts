import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { applyOperation, isDirectory, pathExists, readText } from "../fs-utils.js";
import { loadSkillManifest, skillInvocationPolicy } from "../manifest.js";
import { upsertFrontmatterBoolean, upsertOpenAiImplicitInvocation } from "../skills.js";
import type { CliOptions, PathOperation } from "../types.js";
import { skillProfilePaths } from "./profiles.js";

export type SkillResetPlan = {
  activate: string[];
  disable: string[];
  uncataloged: string[];
  missing: string[];
  operations: PathOperation[];
  profileStatePath: string;
};

export function planSkillReset(options: CliOptions): SkillResetPlan {
  const skillsRoot = join(options.homeDir, ".agents", "skills");
  const disabledRoot = join(skillsRoot, ".disabled");
  const active = installedSkillIds(skillsRoot);
  const disabled = installedSkillIds(disabledRoot);
  const collisions = active.filter((id) => disabled.includes(id));
  if (collisions.length > 0) {
    throw new Error(`Cannot reset skills present in both active and disabled storage: ${collisions.join(", ")}`);
  }

  const manifest = loadSkillManifest({
    homeDir: options.homeDir,
    ...(options.manifestContents ? { manifestContents: options.manifestContents } : {}),
  });
  const catalogById = new Map(manifest.items.map((item) => [item.id.toLowerCase(), item]));
  const installed = [...active, ...disabled];
  const installedIds = new Set(installed.map((id) => id.toLowerCase()));
  const activate = disabled.filter((id) => {
    const item = catalogById.get(id.toLowerCase());
    return item !== undefined && item.startDisabled !== true;
  });
  const disable = active.filter((id) => catalogById.get(id.toLowerCase())?.startDisabled === true || !catalogById.has(id.toLowerCase()));
  const uncataloged = installed.filter((id) => !catalogById.has(id.toLowerCase())).sort();
  const missing = manifest.items.filter((item) => !installedIds.has(item.id.toLowerCase())).map((item) => item.id).sort();
  const operations: PathOperation[] = [
    ...activate.map((id): PathOperation => ({ type: "move", source: join(disabledRoot, id), target: join(skillsRoot, id) })),
    ...disable.map((id): PathOperation => ({ type: "move", source: join(skillsRoot, id), target: join(disabledRoot, id) })),
  ];

  for (const id of installed.filter((candidate) => catalogById.has(candidate.toLowerCase()))) {
    const item = catalogById.get(id.toLowerCase());
    if (!item) {
      continue;
    }
    const currentlyDisabled = disabled.includes(id);
    const targetDisabled = item.startDisabled === true;
    const sourceDir = join(currentlyDisabled ? disabledRoot : skillsRoot, id);
    const targetDir = join(targetDisabled ? disabledRoot : skillsRoot, id);
    const invocation = skillInvocationPolicy(item);
    if (invocation !== "source") {
      operations.push(...invocationPolicyOperations(sourceDir, targetDir, invocation === "auto"));
    }
  }

  const profileStatePath = skillProfilePaths({ homeDir: options.homeDir, cwd: options.cwd, local: false }).statePath;
  const emptyProfileState = `${JSON.stringify({
    version: 2,
    activations: [],
    profileMovedSkills: [],
    preExistingDisabledSkills: [],
  }, null, 2)}\n`;
  if (!pathExists(profileStatePath) || readText(profileStatePath) !== emptyProfileState) {
    operations.push({ type: "write", path: profileStatePath, content: emptyProfileState });
  }

  return { activate: activate.sort(), disable: disable.sort(), uncataloged, missing, operations, profileStatePath };
}

export function applySkillReset(plan: SkillResetPlan): void {
  for (const operation of plan.operations) {
    applyOperation(operation);
  }
}

function invocationPolicyOperations(sourceDir: string, targetDir: string, allowInvocation: boolean): PathOperation[] {
  const sourceSkillMd = join(sourceDir, "SKILL.md");
  if (!pathExists(sourceSkillMd)) {
    return [];
  }

  const operations: PathOperation[] = [];
  const currentSkillMd = readText(sourceSkillMd);
  const nextSkillMd = upsertFrontmatterBoolean(currentSkillMd, "disable-model-invocation", !allowInvocation);
  if (nextSkillMd !== currentSkillMd) {
    operations.push({ type: "write", path: join(targetDir, "SKILL.md"), content: nextSkillMd });
  }

  const sourceOpenAiYaml = join(sourceDir, "agents", "openai.yaml");
  const currentOpenAiYaml = pathExists(sourceOpenAiYaml) ? readText(sourceOpenAiYaml) : "";
  const nextOpenAiYaml = upsertOpenAiImplicitInvocation(currentOpenAiYaml, allowInvocation);
  if (nextOpenAiYaml !== currentOpenAiYaml) {
    operations.push({ type: "write", path: join(targetDir, "agents", "openai.yaml"), content: nextOpenAiYaml });
  }
  return operations;
}

function installedSkillIds(root: string): string[] {
  if (!isDirectory(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && existsSync(join(root, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}
