import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { addMcpAgentNames } from "./agents.js";
import { loadMcpManifest, loadSkillManifest, loadUtilityManifest, type SkillManifestItem, type UtilityManifestItem } from "./manifest.js";
import type { AgentId, CliOptions, Runtime } from "./types.js";

export type DelegateCommand = {
  label: string;
  command: string;
  args: string[];
  cwd?: string;
};

type DelegateRunOptions = Pick<CliOptions, "dryRun" | "repoDir"> & {
  cwd?: string;
  continueOnError?: boolean;
};

export function buildSkillCommands(options: CliOptions): DelegateCommand[] {
  const manifest = loadSkillManifest(options);
  const selected =
    options.selectedSkillIds.length > 0
      ? manifest.items.filter((item) => options.selectedSkillIds.includes(item.id))
      : manifest.items.filter((item) => item.default || options.includeExternal);

  return buildSkillSourceCommands(selected, "Shared skills", [], options.setupScope);
}

export function buildMcpCommands(options: Pick<CliOptions, "agents" | "yes" | "homeDir" | "selectedMcpIds" | "setupScope">): DelegateCommand[] {
  const manifest = loadMcpManifest(options);
  const agentArgs = buildAddMcpAgentArgs(options.agents, options.yes);

  return manifest.items
    .filter((item) => options.selectedMcpIds.length === 0 ? item.default : options.selectedMcpIds.includes(item.id))
    .map((item) => ({
      label: item.label,
      command: "npx",
      args: [
        "add-mcp",
        item.source.replace("${HOME}", options.homeDir),
        ...item.args,
        ...(options.setupScope === "global" ? ["-g"] : []),
        ...agentArgs,
        ...(options.yes ? ["-y"] : []),
      ],
    }));
}

export function buildUtilityCommands(options: Pick<CliOptions, "agents" | "homeDir" | "selectedUtilIds" | "setupScope">): DelegateCommand[] {
  const manifest = loadUtilityManifest(options);
  const selected =
    options.selectedUtilIds.length > 0
      ? manifest.items.filter((item) => options.selectedUtilIds.includes(item.id))
      : manifest.items.filter((item) => item.default);

  return selected.flatMap((item) => [
    buildUtilityInstallCommand(item),
    ...buildUtilityPostInstallCommands(item, options),
  ]);
}

export async function runDelegateCommands(
  runtime: Runtime,
  commands: DelegateCommand[],
  options: DelegateRunOptions,
): Promise<number> {
  const failures: Array<{ label: string; code: number }> = [];

  for (const item of commands) {
    runtime.io.stdout(`\n${item.label}`);
    if (item.cwd) {
      runtime.io.stdout(`(in ${item.cwd})`);
    }
    runtime.io.stdout(`$ ${item.command} ${item.args.map(quoteArg).join(" ")}`);

    if (options.dryRun) {
      continue;
    }

    if (item.cwd) {
      mkdirSync(item.cwd, { recursive: true });
    }

    const result = await runtime.spawn(item.command, item.args, item.cwd ?? options.cwd ?? options.repoDir);
    if (result.code !== 0) {
      if (options.continueOnError) {
        failures.push({ label: item.label, code: result.code });
        runtime.io.stderr(`Warning: ${item.label} failed with exit code ${result.code}. Continuing.`);
        continue;
      }

      return result.code;
    }
  }

  if (failures.length > 0) {
    runtime.io.stdout("\nSome delegated commands failed:");
    for (const failure of failures) {
      runtime.io.stdout(`- ${failure.label} exited with code ${failure.code}`);
    }
  }

  return 0;
}

function buildAddMcpAgentArgs(agents: AgentId[], nonInteractive: boolean): string[] {
  const selected = agents.length > 0 ? agents : nonInteractive ? defaultMcpAgents() : [];
  const args: string[] = [];

  for (const agent of selected) {
    const addMcpName = addMcpAgentNames[agent];
    if (addMcpName) {
      args.push("-a", addMcpName);
    }
  }

  return args;
}

function defaultMcpAgents(): AgentId[] {
  return ["claude", "codex", "gemini", "opencode"];
}

function buildUtilityInstallCommand(item: UtilityManifestItem): DelegateCommand {
  return {
    label: `${item.label} / install`,
    command: item.install.command,
    args: item.install.args,
  };
}

function buildUtilityPostInstallCommands(item: UtilityManifestItem, options: Pick<CliOptions, "agents" | "homeDir" | "setupScope">): DelegateCommand[] {
  if (typeof item.postInstall === "object") {
    return [{
      label: item.postInstall.label ?? `${item.label} / post-install`,
      command: item.postInstall.command,
      args: item.postInstall.args,
    }];
  }

  if (item.postInstall !== "rtk-init") {
    return [];
  }

  const selectedAgents = options.agents.length > 0 ? options.agents : defaultMcpAgents();
  return selectedAgents.map((agent) => ({
    label: `RTK / init ${agentLabel(agent)}`,
    command: "rtk",
    args: rtkInitArgs(agent, options.setupScope),
    ...(options.setupScope === "global" && agent === "codex" ? { cwd: join(options.homeDir, ".codex") } : {}),
  }));
}

function rtkInitArgs(agent: AgentId, scope: "global" | "project"): string[] {
  if (scope === "project") {
    switch (agent) {
      case "claude":
        return ["init"];
      case "codex":
        return ["init", "--codex"];
      case "gemini":
        return ["init", "--gemini"];
      case "opencode":
        return ["init", "--opencode"];
    }
  }

  switch (agent) {
    case "claude":
      return ["init", "--global"];
    case "codex":
      return ["init", "--codex"];
    case "gemini":
      return ["init", "--global", "--gemini"];
    case "opencode":
      return ["init", "--global", "--opencode"];
  }
}

function agentLabel(agent: AgentId): string {
  switch (agent) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    case "opencode":
      return "OpenCode";
  }
}

function buildSkillSourceCommands(
  items: SkillManifestItem[],
  labelPrefix: string,
  targetArgs: string[],
  scope: "global" | "project",
): DelegateCommand[] {
  const bySource = new Map<string, SkillManifestItem[]>();

  for (const item of items) {
    bySource.set(item.source, [...(bySource.get(item.source) ?? []), item]);
  }

  return [...bySource.entries()].map(([source, sourceItems]) => ({
    label: `${labelPrefix} / ${sourceLabel(source)}`,
    command: "npx",
    args: [
      "skills",
      "add",
      source,
      ...(scope === "global" ? ["--global"] : []),
      "--yes",
      ...skillSelectionArgs(sourceItems),
      ...targetArgs,
    ],
  }));
}

function skillSelectionArgs(items: SkillManifestItem[]): string[] {
  const skillIds = items.map((item) => skillIdFromArgs(item.args));
  if (skillIds.some((id) => !id)) {
    return [];
  }

  return ["--skill", ...skillIds.filter((id): id is string => Boolean(id))];
}

function skillIdFromArgs(args: string[]): string | null {
  const index = args.indexOf("--skill");
  return index >= 0 ? args[index + 1] ?? null : null;
}

function sourceLabel(source: string): string {
  if (source.includes("logbookfordevs/ai-field-kit")) {
    return "AI Field Kit";
  }

  if (source.includes("addyosmani/agent-skills")) {
    return "Agent Skills";
  }

  return source;
}

function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}
