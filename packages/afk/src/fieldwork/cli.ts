import { parseUiOptions } from "./ui-options.js";
import { startBackground, backgroundStatus, stopBackground, restartBackground } from "./background.js";
import { updateAfk } from "./update.js";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { doctor } from "./doctor.js";
import { FieldworkOperations } from "./operations.js";
import { operationCatalog } from "./operation-catalog.js";
import { SettingsStore, validateSettings } from "./settings.js";
import { settingsSchema } from "./settings-schema.js";
import { SkillLibrary } from "./skills.js";
import { startFieldwork } from "./server.js";

const HELP = `AFK — local skills, tools, and agent rules

  afk                               Open the local web app
  afk ui --no-open                   Start without opening a browser
  afk --background [--port <number>] Run the app in the background
  afk --port <number>                Open the app on a fixed port
  afk status                         Show the background app URL and PID
  afk stop                           Stop the background app
  afk restart                        Restart the background app on its current port
  afk skills update [name] [-g | -p <project>]  Update skills, preserving availability
  afk update [--dry-run]             Update AFK itself from the latest release
  afk guide                         Print the bundled agent skill path
  afk profiles use <id>              Read a group without enabling it
  afk profiles enable <id> [scope]
  afk profiles disable <id> [scope]
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

async function run(argv: string[], store: SettingsStore): Promise<number> {
  const [command, action, id, target, extra] = argv;
  if (["--help", "help", "-h"].includes(command ?? "")) { console.log(HELP); return 0; }
  if (command === "--version") {
    const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
    console.log(pkg.version); return 0;
  }
  if (command === "update") return updateAfk(argv.slice(1));
  if (command === "manage") return manage(argv.slice(1), store);
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
    if (action !== undefined) throw new Error(`Use afk ${command} without additional arguments.`);
    if (command === "status") await backgroundStatus(store.home);
    else if (command === "stop") await stopBackground(store.home);
    else await restartBackground(store.home);
    return 0;
  }
  await store.initialize();
  const library = new SkillLibrary(store);
  if (command === "profiles") {
    if (!id || extra !== undefined || (action === "use" && target !== undefined)) throw new Error("Provide a profile identifier and optional scope for enable or disable.");
    const settings = await store.read();
    if (action === "use") { console.log(await library.readGroup(settings, id)); return 0; }
    if (action === "enable" || action === "disable") { await library.activate(settings, id, target ?? "Global", action === "enable"); return 0; }
    throw new Error("Choose profiles use, enable, or disable.");
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
    if (action === "export" && id) { await writeFile(id, await readFile(store.path), { flag: "wx", mode: 0o600 }); return 0; }
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
  if (options.background) { await startBackground(store, options.port); return 0; }
  const app = await startFieldwork(store, options.port);
  console.log(`AFK is running at ${app.url}\nPress Ctrl+C to close it.`);
  if (options.open) {
    const [opener, args] = process.platform === "darwin" ? ["open", [app.url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", app.url]] : ["xdg-open", [app.url]];
    const child = spawn(opener!, args, { stdio: "ignore" });
    child.on("error", () => console.error("Open the AFK URL in your browser."));
  }
  const stop = (): void => { void app.close().then(() => { process.exitCode = 0; }); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  return 0;
}

export async function runFieldwork(argv: string[], store = new SettingsStore()): Promise<number> {
  try { return await run(argv, store); }
  catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "AFK could not complete the operation." }));
    return 1;
  }
}
