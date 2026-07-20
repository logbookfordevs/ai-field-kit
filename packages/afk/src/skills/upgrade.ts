import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { quoteArg } from "../delegates.js";
import type { Runtime } from "../types.js";
import { renderSkillUpgradeComplete, renderSkillUpgradeRoute } from "./render.js";

export type SkillUpgradeScope = "global" | "project" | "all";

export type LockedSkillScope = "global" | "project";

export type LockedSkillRecord = {
  name: string;
  scope: LockedSkillScope;
  source: string;
  sourceType: string;
  skillPath: string | undefined;
  updatedAt: string | undefined;
};

export type SkillUpgradeCommand = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
  scope: LockedSkillScope;
  skillNames: string[];
};

type LockEntry = {
  source?: unknown;
  sourceType?: unknown;
  skillPath?: unknown;
  skillFolderHash?: unknown;
  updatedAt?: unknown;
};

type SkillLock = {
  version?: unknown;
  skills?: unknown;
};

export function loadLockedSkills(options: {
  homeDir: string;
  cwd: string;
  scope: SkillUpgradeScope;
}): LockedSkillRecord[] {
  const records: LockedSkillRecord[] = [];

  if (options.scope === "global" || options.scope === "all") {
    records.push(...readLockFile(globalLockPath(options.homeDir), "global")
      .filter((record) => Boolean(record.skillPath)));
  }

  if (options.scope === "project" || options.scope === "all") {
    records.push(...readLockFile(projectLockPath(options.cwd), "project")
      .filter((record) => record.sourceType !== "local" && record.sourceType !== "node_modules" && Boolean(record.skillPath)));
  }

  return records.sort((left, right) => {
    if (left.scope !== right.scope) {
      return left.scope === "global" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export function buildSkillUpgradeCommands(options: {
  cwd: string;
  scope: SkillUpgradeScope;
  skills: string[];
  yes: boolean;
}): SkillUpgradeCommand[] {
  const scopes: LockedSkillScope[] = options.scope === "all" ? ["global", "project"] : [options.scope];
  return scopes.map((scope) => {
    const args = [
      "--yes",
      "skills",
      "update",
      ...options.skills,
      scope === "global" ? "-g" : "-p",
      ...(options.yes ? ["-y"] : []),
    ];

    return {
      label: scope === "global" ? "Global skills" : "Project skills",
      command: "npx",
      args,
      cwd: options.cwd,
      scope,
      skillNames: options.skills,
    };
  });
}

export async function runSkillUpgradeCommands(
  runtime: Runtime,
  commands: SkillUpgradeCommand[],
  afterSuccess?: (command: SkillUpgradeCommand) => void,
): Promise<number> {
  for (const command of commands) {
    runtime.io.stdout(renderSkillUpgradeRoute({
      label: command.label,
      commandLine: `${command.command} ${command.args.map(quoteArg).join(" ")}`,
    }));

    const result = await runtime.spawn(command.command, command.args, command.cwd);
    if (result.code !== 0) {
      return result.code;
    }
    afterSuccess?.(command);
  }

  runtime.io.stdout(renderSkillUpgradeComplete({
    scopes: commands.map((command) => command.scope),
    skillNames: commands.flatMap((command) => command.skillNames),
  }));

  return 0;
}

function readLockFile(path: string, scope: LockedSkillScope): LockedSkillRecord[] {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as SkillLock;
    if (!parsed || typeof parsed !== "object" || !parsed.skills || typeof parsed.skills !== "object") {
      return [];
    }

    return Object.entries(parsed.skills as Record<string, LockEntry>)
      .map(([name, entry]) => ({
        name,
        scope,
        source: stringValue(entry.source) ?? "unknown source",
        sourceType: stringValue(entry.sourceType) ?? "unknown",
        skillPath: stringValue(entry.skillPath),
        updatedAt: stringValue(entry.updatedAt),
      }));
  } catch {
    return [];
  }
}

function globalLockPath(homeDir: string): string {
  return join(homeDir, ".agents", ".skill-lock.json");
}

function projectLockPath(cwd: string): string {
  return join(cwd, "skills-lock.json");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
