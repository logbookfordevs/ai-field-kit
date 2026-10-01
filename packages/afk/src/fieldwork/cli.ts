import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { startFieldwork } from "./server.js";

export async function runFieldwork(argv: string[]): Promise<number> {
  const [command, action, id, target] = argv;
  const store = new SettingsStore();
  await store.initialize();
  const library = new SkillLibrary(store);
  if (command === "--help" || command === "help" || command === "-h") {
    console.log("AFK — local skills and tools\n\n  afk                      Open the local web app\n  afk ui --no-open          Start without opening a browser\n  afk profiles use <id>     Read a group without enabling it\n  afk profiles enable <id> [scope]\n  afk profiles disable <id> [scope]\n  afk skills get <name> [scope]\n  afk settings export <file>\n\nSet AFK_SETTINGS to choose your settings file. Scope defaults to Global.");
    return 0;
  }
  if (command === "profiles") {
    if (!id) throw new Error("Provide a profile identifier.");
    const settings = await store.read();
    if (action === "use") { console.log(await library.readGroup(settings, id)); return 0; }
    if (action === "enable" || action === "disable") { await library.activate(settings, id, target ?? "Global", action === "enable"); return 0; }
    throw new Error("Choose profiles use, enable, or disable.");
  }
  if (command === "skills" && action === "get" && id) {
    const path = await library.locate(await store.read(), id, target ?? "Global");
    console.log(await readFile(`${path}/SKILL.md`, "utf8")); return 0;
  }
  if (command === "settings" && action === "export" && id) {
    await writeFile(id, await readFile(store.path), { flag: "wx", mode: 0o600 }); return 0;
  }
  if (command && command !== "ui") throw new Error("This command is outside AFK's new scope. Run afk --help for the supported commands.");
  const app = await startFieldwork(store);
  console.log(`AFK is running at ${app.url}\nPress Ctrl+C to close it.`);
  if (!argv.includes("--no-open")) {
    const [opener, args] = process.platform === "darwin" ? ["open", [app.url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", app.url]] : ["xdg-open", [app.url]];
    const child = spawn(opener!, args, { stdio: "ignore" });
    child.on("error", () => console.error("Open the AFK URL in your browser."));
  }
  const stop = (): void => { void app.close().then(() => { process.exitCode = 0; }); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  return 0;
}
