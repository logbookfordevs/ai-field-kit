import { installFromUrl } from "./install-cli.js";
import { runAdd, runKit, runMigrate } from "./kit-cli.js";
import { parseUiOptions } from "./ui-options.js";
import { startBackground, backgroundStatus, stopBackground, restartBackground } from "./background.js";
import { updateAfk } from "./update.js";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { doctor } from "./doctor.js";
import { FieldworkOperations } from "./operations.js";
import { operationCatalog } from "./operation-catalog.js";
import { SettingsStore, validateSettings } from "./settings.js";
import { settingsSchema } from "./settings-schema.js";
import { portableSettings } from "./local-state.js";
import { SkillLibrary } from "./skills.js";
import type { RestoreSummary } from "./library-restore.js";
import { applyLibraryInit, confirmLibraryInit, planLibraryInit, type LibraryInitPlan } from "./library-init.js";
import { startFieldwork } from "./server.js";

const HELP = `AFK — local skills, tools, and agent rules

  afk [start]                       Start the app in the background and open it
  afk start --no-open                Start in the background without opening a browser
  afk --foreground                  Run attached to this terminal; Ctrl+C closes it
  afk start --port <number>          Use a fixed port
  afk status                         Show the background app URL and PID
  afk stop [--force]                 Stop the background app; --force also clears one that is not answering
  afk restart                        Restart the background app on its current port
  afk skills update [name] [-g | -p <project>]  Update skills, preserving availability
  afk add <repository>               Install skills and decide where they go
  afk kit                            Compare your kit with this machine
  afk kit add <skill>... [--pack <name>]  Make skills travel with you
  afk kit drop <skill> [--pack <name>]    Stop tracking a skill; its files stay
  afk migrate [--core <stack-id>] [--apply]  Move old stacks settings to the kit format
  afk library init [--apply]         Move Core, pack and machine-only skills into AFK storage; dry run without --apply
  afk library confirm                Delete the originals kept after library init
  afk library connect <owner/repo | url> [--run-tools <id,id|all>]  Restore your library on this machine; tools run only when named
  afk install <url> [--agent <agent>] [-g | -p <folder>] [--yes]
  afk update [--dry-run]             Update AFK itself from the latest release
  afk guide                         Print the bundled agent skill path
  afk packs use <name-or-id>                 Read a pack without turning it on
  afk packs enable <name-or-id> [scope]
  afk packs disable <name-or-id> [scope]
  afk skills get <name> [scope]
  afk settings path                  Print the selected settings file path
  afk settings show                  Read settings as JSON
  afk settings schema                Print editor-oriented JSON Schema
  afk settings validate [file]       Validate JSON without importing it
  afk settings export <file>         Export without overwriting a file
  afk doctor [--json]                 Check configuration and local consistency
  afk manage describe [operation]    Describe headless operations as JSON
  afk manage <operation> [--input <file|->]

Agents: run afk guide and read the returned SKILL.md before managing AFK.
Set AFK_SETTINGS to choose your settings file. Scope defaults to Global.
Configuration edits save definitions; managed operations apply filesystem changes.`;

const MANAGE_HELP = `AFK headless management

  afk manage describe [operation]
  afk manage <operation> [--input <JSON file|->]

Input is a JSON object read from a file or stdin (-). Results are JSON.
No browser or running web app is required. Use describe for supported fields.
Tool commands run only through tool/run. Rule sync requires an exact preview.

Operations: ${Object.keys(operationCatalog).join(", ")}`;

async function confirmInTerminal(message: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try { return /^y(es)?$/i.test((await terminal.question(`${message} [y/N] `)).trim()); } finally { terminal.close(); }
}

function json(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }
function hasErrors(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const result = value as { preview?: { errors?: unknown[]; targets?: { status?: string }[] } };
  return Boolean(result.preview?.errors?.length || result.preview?.targets?.some(target => target.status === "conflict"));
}

async function inputObject(path?: string): Promise<Record<string, unknown>> {
  if (!path) return {};
  let text = "";
  if (path === "-") {
    for await (const chunk of process.stdin) {
      text += String(chunk);
      if (Buffer.byteLength(text) > 8_000_000) throw new Error("Input is too large.");
    }
  } else text = await readFile(path, "utf8");
  if (Buffer.byteLength(text) > 8_000_000) throw new Error("Input is too large.");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Input must be a JSON object.");
  return value as Record<string, unknown>;
}

async function manage(argv: string[], store: SettingsStore): Promise<number> {
  const [operation, option, path, extra] = argv;
  if (!operation || ["--help", "help", "-h"].includes(operation)) {
    if (argv.length > 1) throw new Error("Unexpected management arguments.");
    console.log(MANAGE_HELP); return 0;
  }
  if (operation === "describe") {
    if (path !== undefined) throw new Error("Use manage describe [operation].");
    const descriptions = Object.entries(operationCatalog).map(([operation, description]) => ({ operation, ...description }));
    if (option) {
      const description = descriptions.find(entry => entry.operation === option);
      if (!description) throw new Error("Unknown operation.");
      json(description);
    } else json({ operations: descriptions });
    return 0;
  }
  if (extra !== undefined || (option !== undefined && (option !== "--input" || !path))) throw new Error("Use manage <operation> [--input <JSON file|->].");
  const data = await inputObject(path);
  await store.initialize();
  const operations = new FieldworkOperations(store);
  const cancelUpdate = (): void => { void operations.run("skills/update-cancel").catch(error => console.error(error)); };
  if (operation === "skills/update") process.on("SIGINT", cancelUpdate);
  try {
    const result = await operations.run(operation, data);
    json(result);
    if (operation === "skills/update") return (result as { code: number }).code;
    if (operation === "tool/run") {
      const code = (result as { code: number }).code;
      return code === 0 ? 0 : Math.max(1, Math.min(255, code));
    }
    return ["rules/sync", "rules/overwrite"].includes(operation) && hasErrors(result) ? 1 : 0;
  } finally { process.removeListener("SIGINT", cancelUpdate); await operations.close(); }
}

function describeLibraryInit(plan: LibraryInitPlan, applied: boolean): string {
  const lines = [applied ? `Library started at ${plan.library}.` : `Dry run: nothing changed. Run afk library init --apply to start the library at ${plan.library}.`];
  for (const skill of plan.skills) lines.push(`  ${skill.name} (${skill.on ? "on" : "off"}${skill.record.invocation ? `, ${skill.record.invocation}` : ""}) from ${skill.from}`);
  for (const skill of plan.packSkills) lines.push(`  ${skill.name} (pack${skill.on ? ", on" : ""}) to the pack cache from ${skill.from}`);
  for (const skill of plan.machineSkills) lines.push(`  ${skill.name} (this machine${skill.on ? ", on" : ""}) to machine storage from ${skill.from}`);
  for (const skill of plan.offToolSkills) lines.push(`  ${skill.name} (tool, off) to the off folder from ${skill.from}`);
  if (plan.rules.length) lines.push(`Rules: ${plan.rules.join(", ")}`);
  if (plan.missing.length) lines.push(`Not on this machine: ${plan.missing.join(", ")}`);
  if (plan.toolSkills.length) lines.push(`Provided by tools, left in place: ${plan.toolSkills.join(", ")}`);
  lines.push(applied ? `Originals kept in ${plan.backup}. Run afk library confirm to delete them.` : `Originals would be kept in ${plan.backup}.`);
  return lines.join("\n");
}

async function libraryCommand(argv: string[], store: SettingsStore): Promise<number> {
  const [action, option, extra] = argv;
  await store.initialize();
  if (action === "init" && extra === undefined && (option === undefined || option === "--apply")) {
    const apply = option === "--apply";
    console.log(describeLibraryInit(apply ? await applyLibraryInit(store) : await planLibraryInit(store), apply));
    return 0;
  }
  if (action === "connect") return connectLibrary(argv.slice(1), store);
  if (action === "confirm" && option === undefined) { console.log(`Deleted ${await confirmLibraryInit(store)}.`); return 0; }
  throw new Error("Use afk library init [--apply], afk library confirm or afk library connect <owner/repo | url>.");
}

async function connectLibrary(argv: string[], store: SettingsStore): Promise<number> {
  const [repository, flag, ids, ...rest] = argv;
  if (!repository || repository.startsWith("-") || rest.length || (flag !== undefined && (flag !== "--run-tools" || !ids))) throw new Error("Use afk library connect <owner/repo | url> [--run-tools <id,id|all>].");
  const operations = new FieldworkOperations(store);
  try {
    const summary = await operations.run("restore/start", { repository }) as RestoreSummary;
    const lines = [`Restored ${summary.repository}.`, `  ${summary.linked.length} Core skill${summary.linked.length === 1 ? "" : "s"} linked into ${summary.folders.join(", ")}`, `  ${summary.choices} Manual/Automatic choice${summary.choices === 1 ? "" : "s"} kept in their files`];
    if (summary.adopted.length) lines.push(`  Already here with identical files: ${summary.adopted.join(", ")}`);
    for (const move of summary.movedAside) lines.push(`  ${move.name} differed; the library copy is used and yours moved to ${move.to}`);
    if (summary.packs.length) lines.push(`  Packs are off: ${summary.packs.join(", ")}`);
    const chosen = ids === "all" ? summary.tools.map(tool => tool.id) : (ids ?? "").split(",").filter(Boolean).map(Number);
    const unknown = chosen.filter(id => !summary.tools.some(tool => tool.id === id));
    for (const tool of summary.tools) lines.push(`  Tool ${tool.id}: ${tool.name}${tool.provides?.length ? ` (provides ${tool.provides.join(", ")})` : ""} — ${chosen.includes(tool.id) ? "running" : "not run"}`);
    if (summary.tools.length && !chosen.length) lines.push("Tools did not run. Add --run-tools <id,id|all> to run the ones you want.");
    console.log(lines.join("\n"));
    if (unknown.length) throw new Error(`No saved tool has the ID ${unknown.join(", ")}.`);
    let failed = false;
    for (const id of chosen) {
      const result = await operations.run("tool/run", { id }) as { code: number; output: string };
      console.log(`Tool ${id} exited with ${result.code}.${result.code ? `\n${result.output.trim()}` : ""}`);
      failed ||= result.code !== 0;
    }
    return failed ? 1 : 0;
  } finally { await operations.close(); }
}

async function run(argv: string[], store: SettingsStore): Promise<number> {
  const [command, action, id, target, extra] = argv;
  if (["--help", "help", "-h"].includes(command ?? "")) { console.log(HELP); return 0; }
  if (command === "--version") {
    const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
    console.log(pkg.version); return 0;
  }
  if (command === "install") return installFromUrl(argv.slice(1), store);
  if (command === "add") return runAdd(argv.slice(1), store);
  if (command === "kit") return runKit(argv.slice(1), store);
  if (command === "migrate") return runMigrate(argv.slice(1), store);
  if (command === "update") return updateAfk(argv.slice(1));
  if (command === "manage") return manage(argv.slice(1), store);
  if (command === "library") return libraryCommand(argv.slice(1), store);
  if (command === "settings" && action === "schema") {
    if (id !== undefined) throw new Error("Use settings schema without additional arguments.");
    json(settingsSchema); return 0;
  }
  if (action === "--help" || action === "help" || action === "-h") { console.log(HELP); return 0; }
  if (command === "guide") {
    if (action !== undefined) throw new Error("Use guide without additional arguments.");
    console.log(fileURLToPath(new URL("../../skills/afk-cli/SKILL.md", import.meta.url))); return 0;
  }
  if (command === "status" || command === "stop" || command === "restart") {
    const force = command === "stop" && action === "--force";
    if ((action !== undefined && !force) || id !== undefined) throw new Error(command === "stop" ? "Use afk stop [--force]." : `Use afk ${command} without additional arguments.`);
    if (command === "status") return backgroundStatus(store.home);
    if (command === "stop") await stopBackground(store.home, { force, confirm: process.stdin.isTTY && process.stdout.isTTY ? confirmInTerminal : undefined });
    else await restartBackground(store.home);
    return 0;
  }
  await store.initialize();
  const library = new SkillLibrary(store);
  if (command === "packs" || command === "profiles") {
    if (!id || extra !== undefined || (action === "use" && target !== undefined)) throw new Error("Provide a pack name or ID and optional scope for enable or disable.");
    const settings = await store.read();
    if (action === "use") { console.log(await library.readGroup(settings, id)); return 0; }
    if (action === "enable" || action === "disable") { await library.activate(settings, id, target ?? "Global", action === "enable"); return 0; }
    throw new Error("Choose packs use, enable, or disable.");
  }
  if (command === "skills" && action === "update") {
    let scope = "Global", hasScope = false;
    const names: string[] = [];
    const args = argv.slice(2);
    for (let index = 0; index < args.length; index++) {
      const argument = args[index]!;
      if (["-g", "--global", "-p", "--project"].includes(argument)) {
        if (hasScope) throw new Error("Choose one update scope.");
        hasScope = true;
        if (argument === "-p" || argument === "--project") {
          const project = args[++index];
          if (!project || project.startsWith("-")) throw new Error("Provide a configured project name after -p.");
          scope = project;
        }
      } else {
        if (argument.startsWith("-")) throw new Error("Use skills update [name] -g or -p <project>.");
        names.push(argument);
      }
    }
    const operations = new FieldworkOperations(store);
    const cancelUpdate = (): void => { void operations.run("skills/update-cancel").catch(error => console.error(error)); };
    process.on("SIGINT", cancelUpdate);
    try { const result = await operations.run("skills/update", { scope, ...(names.length ? { names } : {}) }) as { code: number; output: string; phase: string }; console.log(result.output); console.log(result.phase); return result.code; }
    finally { process.removeListener("SIGINT", cancelUpdate); await operations.close(); }
  }
  if (command === "skills" && action === "get" && id && extra === undefined) {
    const path = await library.locate(await store.read(), id, target ?? "Global");
    console.log(await readFile(`${path}/SKILL.md`, "utf8")); return 0;
  }
  if (command === "settings") {
    if (target !== undefined) throw new Error("Unexpected settings arguments.");
    if (action === "path" && id === undefined) { console.log(store.path); return 0; }
    if (action === "show" && id === undefined) { json(await store.read()); return 0; }
    if (action === "validate") {
      const path = id ? resolve(id) : store.path;
      validateSettings(JSON.parse(await readFile(path, "utf8")));
      json({ ok: true, path }); return 0;
    }
    if (action === "export" && id) { await writeFile(id, JSON.stringify(portableSettings(await store.read()), null, 2) + "\n", { flag: "wx", mode: 0o600 }); return 0; }
    throw new Error("Choose settings path, show, schema, validate, or export.");
  }
  if (command === "doctor") {
    if ((action !== undefined && action !== "--json") || id !== undefined) throw new Error("Use doctor [--json].");
    const report = await doctor(store);
    if (action === "--json") json(report);
    else {
      console.log(`AFK doctor: ${report.ok ? "no errors" : "issues found"}\nSettings: ${report.settingsPath}`);
      for (const issue of report.issues) console.log(`${issue.severity}: ${issue.message}${issue.path ? "\n  " + issue.path : ""}`);
      if (!report.issues.length) console.log("Configuration and checked local state agree. No files changed.");
    }
    return report.ok ? 0 : 1;
  }
  const options = parseUiOptions(argv);
  if (options.background) {
    const url = await startBackground(store, options.port);
    if (options.open && url) openInBrowser(url);
    return 0;
  }
  const app = await startFieldwork(store, options.port);
  console.log(`AFK is running at ${app.url}\nPress Ctrl+C to close it.`);
  if (options.open) openInBrowser(app.url);
  const stop = (): void => { void app.close().then(() => { process.exitCode = 0; }); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  return 0;
}

function openInBrowser(url: string): void {
  const [opener, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const child = spawn(opener!, args, { stdio: "ignore" });
  child.on("error", () => console.error("Open the AFK URL in your browser."));
}

export async function runFieldwork(argv: string[], store = new SettingsStore()): Promise<number> {
  try { return await run(argv, store); }
  catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "AFK could not complete the operation." }));
    return 1;
  }
}
