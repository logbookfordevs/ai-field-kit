import { createInterface } from "node:readline/promises";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { FieldworkOperations } from "./operations.js";
import { fetchStack, manifestUrl } from "./stacks.js";
import { installSkills, type InstallRunner } from "./skill-install.js";
import type { SettingsStore } from "./settings.js";

export const INSTALL_HELP = `Install a version 1 skill stack from a direct HTTPS JSON manifest

  afk install <url> [--agent <agent>] [-g | -p <folder>] [--yes]

Agents: universal, codex, claude-code, cursor, opencode.
Omitted targets are selected interactively, followed by a manifest review.
--yes skips confirmation and requires both an agent and scope.
Bare domain/path URLs use HTTPS. HTML guides are not manifests.
The confirmed stack is saved in Sources & Stacks before installation.
Sources run sequentially through Skills CLI; existing skills may be replaced.
Completed or partial installations remain if a later source fails or is cancelled.`;

interface InstallDependencies {
  fetch?: typeof fetchStack;
  runner?: InstallRunner;
  interactive?: boolean;
  ask?: (question: string) => Promise<string>;
  log?: (text: string) => void;
}

export function installManifestUrl(value: string): string {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  return manifestUrl(candidate);
}

export async function installFromUrl(args: string[], store: SettingsStore, dependencies: InstallDependencies = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  if (args.length === 1 && ["--help", "-h", "help"].includes(args[0]!)) { log(INSTALL_HELP); return 0; }
  const [url, ...options] = args;
  if (!url || url.startsWith("-")) throw new Error(INSTALL_HELP);
  const origin = installManifestUrl(url);
  let agent: string | undefined, scope: string | undefined, project: string | undefined, yes = false;
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (option === "--yes" || option === "-y") { yes = true; continue; }
    if (option === "--global" || option === "-g") {
      if (scope) throw new Error("Choose one installation scope.");
      scope = "Global"; continue;
    }
    if (["--agent", "-a", "--project", "-p"].includes(option!)) {
      const value = options[++index];
      if (!value || value.startsWith("-")) throw new Error(`Provide a value after ${option}.`);
      if (option === "--agent" || option === "-a") {
        if (agent) throw new Error("Choose one installation agent.");
        agent = value;
      } else {
        if (scope) throw new Error("Choose one installation scope.");
        scope = "Project"; project = value;
      }
      continue;
    }
    throw new Error(`Unknown installation option: ${option}.\n${INSTALL_HELP}`);
  }
  const agents = ["universal", "codex", "claude-code", "cursor", "opencode"];
  if (agent && !agents.includes(agent)) throw new Error(`Choose an agent: ${agents.join(", ")}.`);
  if (yes && (!agent || !scope)) throw new Error("--yes requires --agent and either --global or --project <folder>.");
  if (!yes && !(dependencies.interactive ?? Boolean(stdin.isTTY && stdout.isTTY))) throw new Error("Use an interactive terminal, or provide --agent, --global/--project and --yes.");
  const manifest = await (dependencies.fetch ?? fetchStack)(origin);
  await store.initialize();
  const reviewedSettings = await store.read();
  const expected = reviewedSettings.stacks?.find(stack => stack.manifest.id === manifest.id) ?? null;
  log(`${manifest.name}\nManifest: ${origin}`);
  for (const group of manifest.sources) log(`  ${group.name}: ${group.source}\n    ${group.skills.join(", ")}`);
  if (expected) log(`The saved stack "${expected.manifest.name}" (${manifest.id}) will be replaced with this manifest and URL.`);
  log("Confirming saves this stack in Sources & Stacks, even if installation later fails.");
  let terminal: ReturnType<typeof createInterface> | undefined;
  const ask = dependencies.ask ?? ((question: string) => {
    terminal ??= createInterface({ input: stdin, output: stdout });
    return terminal.question(question);
  });
  try {
    if (!agent) agent = (await ask(`Agent (${agents.join(", ")}) [universal]: `)).trim() || "universal";
    if (!agents.includes(agent)) throw new Error(`Choose an agent: ${agents.join(", ")}.`);
    if (!scope) {
      const destination = (await ask("Scope (global/project) [global]: ")).trim().toLowerCase() || "global";
      if (!["global", "project"].includes(destination)) throw new Error("Choose global or project scope.");
      scope = destination === "global" ? "Global" : "Project";
      if (scope === "Project") project = (await ask("Project folder [.]: ")).trim() || ".";
    }
    const path = project === "~" ? store.home : project?.startsWith("~/") ? resolve(store.home, project.slice(2)) : project ? resolve(project) : undefined;
    if (path && !(await stat(path)).isDirectory()) throw new Error("Choose an existing project folder.");
    log(`Target: ${agent}, ${path ?? "Global"}\nSkills CLI may replace existing skills. Completed or partial installations remain on failure.`);
    if (!yes && !["y", "yes"].includes((await ask("Install this stack? [y/N]: ")).trim().toLowerCase())) { log("Installation cancelled; no skills installed."); return 0; }
  } finally { terminal?.close(); }
  const operations = new FieldworkOperations(store);
  try {
    await operations.run("stack/save", { stack: { manifest, origin }, expected });
  } finally { await operations.close(); }
  log(`Saved ${manifest.name} in Sources & Stacks.`);
  const settings = await store.read();
  if (project) {
    const path = project === "~" ? store.home : project.startsWith("~/") ? resolve(store.home, project.slice(2)) : resolve(project);
    settings.projects = [{ name: "Project", path }];
  }
  const controller = new AbortController();
  const cancel = (): void => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  let phase = "";
  try {
    const result = await installSkills(store, settings, manifest.sources, scope, agent, manifest.name, progress => {
      if (progress.phase !== phase) { phase = progress.phase; log(phase); }
    }, controller.signal, dependencies.runner);
    log(result.output);
    log(`${result.phase}: ${result.completed}/${result.total} sources completed.`);
    return result.code === 0 ? 0 : result.cancelled ? 130 : 1;
  } finally { process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); }
}
