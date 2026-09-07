import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { detectSetupTargets } from "../agent-detection.js";
import { customAgentTargetPath } from "../custom-agents.js";
import { buildSkillInstallPlans, runDelegateCommands } from "../delegates.js";
import { localAfkDir, type SkillManifestItem, type SkillPostInstallAction, type SkillPostInstallAgent } from "../manifest.js";
import type { CliOptions, Runtime } from "../types.js";

type CopyAction = Extract<SkillPostInstallAction, { type: "copy" }>;
type CopyReceipt = { destination: string; skill: string; hash: string };

export async function runSkillInstalls(runtime: Runtime, options: CliOptions): Promise<{ installCode: number; postInstallCode: number }> {
  let postInstallCode = 0;
  for (const plan of buildSkillInstallPlans(options)) {
    const installCode = await runDelegateCommands(runtime, [plan.command], options);
    if (installCode !== 0) return { installCode, postInstallCode };
    const code = await runSkillPostInstall(runtime, plan.items, options);
    postInstallCode ||= code;
  }
  return { installCode: 0, postInstallCode };
}

export async function runSkillPostInstall(runtime: Runtime, items: SkillManifestItem[], options: CliOptions): Promise<number> {
  let failed = false;
  for (const item of items) {
    for (const action of item.postInstall ?? []) {
      const label = action.label ?? `${item.label} / post-install`;
      if (action.agent && !targetsAgent(action.agent, options)) {
        runtime.io.stdout(`- ${label}: skipped (${action.agent} is not selected or detected).`);
        continue;
      }
      try {
        const skillDir = installedSkillDir(item, options);
        if (action.type === "copy") {
          copySkillFiles(runtime, item, action, skillDir, options);
        } else {
          if (!options.dryRun && !existsSync(join(skillDir, "SKILL.md"))) {
            throw new Error(`Installed skill not found: ${skillDir}`);
          }
          const expand = (value: string) => value.replace(/\$\{(SKILL_DIR|SCOPE_DIR|HOME|AGENT_DIR)\}/g, (_, token: string) => {
            if (token === "SKILL_DIR") return skillDir;
            if (token === "SCOPE_DIR") return options.setupScope === "global" ? options.homeDir : options.cwd;
            if (token === "HOME") return options.homeDir;
            if (!action.agent) throw new Error("${AGENT_DIR} requires an agent on the action.");
            return agentRoot(action.agent, options);
          });
          const code = await runDelegateCommands(runtime, [{
            label,
            command: expand(action.command),
            args: action.args.map(expand),
            cwd: skillDir,
          }], options);
          if (code !== 0) throw new Error(`Command exited with code ${code}.`);
        }
      } catch (error) {
        failed = true;
        runtime.io.stderr(`${item.label}: skill installed; post-install action failed (${label}): ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
  }
  return failed ? 1 : 0;
}

function targetsAgent(agent: SkillPostInstallAgent, options: CliOptions): boolean {
  const selectedSkillAgent = (agent === "claude" && options.selectedSkillAgentIds.includes("claude-code")) ||
    (agent === "pi" && options.selectedSkillAgentIds.includes("pi"));
  if (options.agents.length > 0) return options.agents.includes(agent) || selectedSkillAgent;
  if (agent !== "codex" && options.selectedSkillAgentIds.length > 0) return selectedSkillAgent;
  if (agent === "codex" && process.env.CODEX_HOME && existsSync(process.env.CODEX_HOME)) return true;
  return detectSetupTargets(options).agents.includes(agent);
}

function agentRoot(agent: SkillPostInstallAgent, options: CliOptions): string {
  return dirname(dirname(customAgentTargetPath("post-install", agent, options)));
}

function installedSkillDir(item: SkillManifestItem, options: CliOptions): string {
  const index = item.args.indexOf("--skill");
  const name = index >= 0 ? item.args[index + 1] : undefined;
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error("Post-install actions require one explicit --skill name.");
  }
  const root = join(options.setupScope === "global" ? options.homeDir : options.cwd, ".agents", "skills");
  const active = join(root, name);
  const disabled = join(root, ".disabled", name);
  return existsSync(active) || !existsSync(disabled) ? active : disabled;
}

function copySkillFiles(runtime: Runtime, item: SkillManifestItem, action: CopyAction, skillDir: string, options: CliOptions): void {
  const source = join(skillDir, action.from);
  const root = agentRoot(action.agent, options);
  const destination = join(root, action.to);
  const label = action.label ?? `${item.label} / post-install`;
  runtime.io.stdout(`- ${label}: copy ${source}/${action.extension ? `*${action.extension}` : "*"} → ${destination}`);
  if (options.dryRun) return;
  if (!existsSync(join(skillDir, "SKILL.md"))) throw new Error(`Installed skill not found: ${skillDir}`);
  const sourceRelative = relative(realpathSync(skillDir), realpathSync(source));
  if (sourceRelative.startsWith("..") || isAbsolute(sourceRelative)) throw new Error(`Copy source escapes the skill directory: ${source}`);
  const files = readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!action.extension || entry.name.endsWith(action.extension)))
    .map((entry) => entry.name).sort();
  if (files.length === 0) throw new Error(`No matching files found in ${source}`);

  const receiptPath = join(options.setupScope === "global" ? localAfkDir(options.homeDir) : join(options.cwd, ".agents", "afk"), "skill-post-install.json");
  const receipts = readReceipts(receiptPath);
  const copies = files.map((name) => {
    const target = resolve(destination, name);
    assertNoTargetSymlink(root, target);
    const content = readFileSync(join(source, name));
    const hash = digest(content);
    const previous = receipts.get(target);
    const current = existsSync(target) ? digest(readFileSync(target)) : undefined;
    if (current !== undefined && current !== hash && (previous?.skill !== item.id || previous.hash !== current)) {
      throw new Error(`Preserved conflicting file: ${target}. Move it aside or reconcile it, then rerun setup.`);
    }
    if (previous && previous.skill !== item.id) throw new Error(`Copy target belongs to another skill: ${target}`);
    return { target, content, hash, changed: current !== hash };
  });
  for (const copy of copies) {
    if (copy.changed) atomicWrite(copy.target, copy.content);
    receipts.set(copy.target, { destination: copy.target, skill: item.id, hash: copy.hash });
  }
  atomicWrite(receiptPath, `${JSON.stringify({ version: 1, files: [...receipts.values()] }, null, 2)}\n`);
  runtime.io.stdout(`  ${copies.filter((copy) => copy.changed).length} copied; ${copies.filter((copy) => !copy.changed).length} unchanged.`);
}

function assertNoTargetSymlink(root: string, target: string): void {
  const parts = relative(resolve(root), target).split(/[\\/]/);
  if (parts.includes("..") || isAbsolute(relative(resolve(root), target))) throw new Error(`Copy destination escapes the agent directory: ${target}`);
  let current = resolve(root);
  for (const part of parts) {
    current = join(current, part);
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Preserved symbolic link at copy destination: ${current}`);
    }
  }
}

function readReceipts(path: string): Map<string, CopyReceipt> {
  if (!existsSync(path)) return new Map();
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
    !("files" in value) || !Array.isArray(value.files) || !value.files.every((entry: unknown) => (
      Boolean(entry) && typeof entry === "object" && entry !== null &&
      "destination" in entry && typeof entry.destination === "string" &&
      "skill" in entry && typeof entry.skill === "string" &&
      "hash" in entry && typeof entry.hash === "string"
    ))) throw new Error(`Invalid copy receipts: ${path}`);
  const files = value.files as CopyReceipt[];
  return new Map(files.map((entry) => [entry.destination, entry]));
}

function digest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function atomicWrite(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
