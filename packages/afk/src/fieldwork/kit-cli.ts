import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { FieldworkOperations } from "./operations.js";
import type { InstallCandidate, KitStatus } from "./kit.js";
import type { InstallRunner } from "./skill-install.js";
import type { MigrationReport } from "./migration.js";
import type { SettingsStore } from "./settings.js";

interface CliDependencies {
  interactive?: boolean;
  ask?: (question: string) => Promise<string>;
  log?: (text: string) => void;
}

function asker(dependencies: CliDependencies): { ask: (question: string) => Promise<string>; close: () => void } {
  let terminal: ReturnType<typeof createInterface> | undefined;
  return {
    ask: dependencies.ask ?? ((question: string) => {
      terminal ??= createInterface({ input: stdin, output: stdout });
      return terminal.question(question);
    }),
    close: () => terminal?.close(),
  };
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function describeStatus(kit: KitStatus): string {
  const lines: string[] = [];
  const on = kit.core.filter(item => item.status === "on").length;
  lines.push(`Core: ${on} of ${plural(kit.core.length, "skill")} on this machine`);
  for (const item of kit.core.filter(entry => entry.status !== "on")) lines.push(`  ${item.status === "missing" ? "missing" : "off    "} ${item.name}  (${item.source})`);
  for (const tool of kit.tools) lines.push(`Tool ${tool.name}: ${tool.missing.length ? `missing ${tool.missing.join(", ")}` : `${plural(tool.provides.length, "skill")} present`}`);
  if (kit.undecided.length) {
    lines.push(`\nNot in your kit: ${plural(kit.undecided.length, "skill")}. Add with \`afk kit add <skill>\`.`);
    for (const item of kit.undecided) lines.push(`  ${item.name}  ${item.source ?? "no repository source"}${item.installable ? "" : "  (can't be reinstalled from a repository)"}`);
  }
  if (kit.machineOnly.length) lines.push(`\nThis machine only: ${kit.machineOnly.join(", ")}`);
  return lines.join("\n");
}

export function describeReport(report: MigrationReport): string {
  const lines: string[] = ["Stacks"];
  for (const stack of report.stacks) lines.push(`  ${stack.name} (${stack.id}): ${plural(stack.skills, "skill")} → ${stack.becomes === "core" ? "Core" : stack.linkedProfile ? "pack, merged with its linked profile" : "new pack"}`);
  lines.push("", `Core: ${plural(report.core.reduce((total, entry) => total + entry.skills.length, 0), "skill")}`);
  for (const entry of report.core) lines.push(`  ${entry.source}${entry.follow ? " (followed)" : ""}: ${entry.skills.join(", ")}`);
  if (report.added.length) lines.push("", `Added to Core because you follow their repository: ${report.added.map(item => item.name).join(", ")}`);
  if (report.missingHere.length) lines.push("", `In Core but missing on this machine: ${report.missingHere.join(", ")}`);
  lines.push("", `Packs: ${report.packs.map(pack => `${pack.name} (${pack.skills})`).join(", ") || "none"}`);
  if (report.tools.length) {
    lines.push("", "Tools linked to the skills they install");
    for (const tool of report.tools) lines.push(`  ${tool.name}: ${tool.provides.join(", ")}${tool.linked ? "" : "  (skipped)"}`);
  }
  lines.push("", `Unchanged: ${plural(report.preserved.sources, "bookmark")}, ${plural(report.preserved.tools, "tool")}, ${plural(report.preserved.projects, "project")}, ${plural(report.preserved.rulesDestinations, "rule destination")}, on/off state and invocation preferences.`);
  if (report.dropped.savedSkills) lines.push(`Retired: the saved skills list (${plural(report.dropped.savedSkills, "entry").replace("entrys", "entries")}), kept in the permanent copy of the old file.`);
  if (report.warnings.length) {
    lines.push("", "Warnings");
    for (const warning of report.warnings) lines.push(`  ${warning}`);
  }
  return lines.join("\n");
}

const MIGRATE_HELP = `Move old stacks settings to the kit format

  afk migrate [--core <stack-id>] [--follow <source>]... [--skip-tool <name>]... [--apply]

Without --apply this is a dry run: nothing is written.
--core        The stack that becomes Core. Omit it for an empty Core; other stacks become packs.
--follow      A Core repository to follow. Its installed skills join Core.
--skip-tool   A tool not to link to its suggested skills.
--apply       Write the change. The old file is kept permanently and can be restored with afk settings restore.`;

export async function runMigrate(args: string[], store: SettingsStore, dependencies: CliDependencies = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  if (["--help", "-h", "help"].includes(args[0] ?? "")) { log(MIGRATE_HELP); return 0; }
  let core: string | undefined, apply = false;
  const follow: string[] = [], skipTools: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const option = args[index]!;
    if (option === "--apply") { apply = true; continue; }
    if (!["--core", "--follow", "--skip-tool"].includes(option)) throw new Error(`Unknown migration option: ${option}.\n${MIGRATE_HELP}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Provide a value after ${option}.`);
    if (option === "--core") core = value;
    else (option === "--follow" ? follow : skipTools).push(value);
  }
  const choices = { ...(core ? { core } : {}), ...(follow.length ? { follow } : {}), ...(skipTools.length ? { skipTools } : {}) };
  await store.initialize();
  const operations = new FieldworkOperations(store);
  try {
    const preview = await operations.run("migration/preview", choices) as { required: boolean; fingerprint: string; report: MigrationReport };
    if (!preview.required) { log("These settings already use the kit format. Nothing to do."); return 0; }
    log(`Settings file: ${store.path}\n`);
    log(describeReport(preview.report));
    if (!apply) {
      if (!core) log("\nNo stack was chosen as Core. Add --core <stack-id> to choose one.");
      log("\nDry run: nothing was written. Add --apply to make this change.");
      return 0;
    }
    const result = await operations.run("migration/apply", { ...choices, fingerprint: preview.fingerprint }) as { backup?: string };
    log(`\nMigrated. The old file is kept at ${result.backup ?? "the AFK backups folder"}.`);
    log("Update AFK on every machine that shares this settings file before using it there.");
    return 0;
  } finally { await operations.close(); }
}

const KIT_HELP = `Your kit: the skills that travel with you

  afk kit                                   Compare your kit with this machine
  afk kit add <skill>... [--pack <name>] [--source <repository>]
  afk kit drop <skill> [--pack <name>]      Keeps its files
  afk kit keep <skill>                      Stay on this machine only; stop asking
  afk kit follow <repository>               Offer new skills a Core repository adds
  afk kit unfollow <repository>
  afk kit check                             Look for new skills in followed repositories

Adding uses the repository a skill was installed from. Nothing here installs anything; use afk add to install.`;

export async function runKit(args: string[], store: SettingsStore, dependencies: CliDependencies = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  const [action, ...rest] = args;
  if (["--help", "-h", "help"].includes(action ?? "")) { log(KIT_HELP); return 0; }
  await store.initialize();
  const operations = new FieldworkOperations(store);
  try {
    if (!action) { log(describeStatus(await operations.run("kit/state") as KitStatus)); return 0; }
    const packId = async (name: string): Promise<string> => {
      const { profiles } = await store.read();
      const matches = profiles.filter(profile => profile.id === name || profile.name.toLowerCase() === name.trim().toLowerCase());
      if (matches.length !== 1) throw new Error(matches.length ? `Several packs are named ${name}. Use its ID.` : `No pack is named ${name}.`);
      return matches[0]!.id;
    };
    const names: string[] = [];
    let pack: string | undefined, source: string | undefined;
    for (let index = 0; index < rest.length; index++) {
      const value = rest[index]!;
      if (value === "--pack" || value === "--source") {
        const next = rest[++index];
        if (!next) throw new Error(`Provide a value after ${value}.`);
        if (value === "--pack") pack = next; else source = next;
      } else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}.\n${KIT_HELP}`);
      else names.push(value);
    }
    if (action === "add" && names.length) {
      await operations.run("kit/add", { names, to: pack ? await packId(pack) : "core", ...(source ? { source } : {}) });
      log(`Added ${names.join(", ")} to ${pack ?? "Core"}. Your library saves ${names.length === 1 ? "it" : "them"} with your next backup.`);
      return 0;
    }
    if (action === "drop" && names.length === 1) {
      await operations.run("kit/drop", { name: names[0], ...(pack ? { from: await packId(pack) } : {}) });
      log(`Dropped ${names[0]} from ${pack ?? "your kit"}. Its files stay on this machine.`);
      return 0;
    }
    if (action === "keep" && names.length === 1) {
      await operations.run("kit/machine-only", { name: names[0], enabled: true });
      log(`${names[0]} stays on this machine only.`);
      return 0;
    }
    if ((action === "follow" || action === "unfollow") && names.length === 1) {
      await operations.run("kit/follow", { source: names[0], follow: action === "follow" });
      log(`${action === "follow" ? "Following" : "No longer following"} ${names[0]}.`);
      return 0;
    }
    if (action === "check" && !names.length) {
      const { sources } = await operations.run("kit/upstream") as { sources: { source: string; names: string[]; error?: string }[] };
      if (!sources.length) log("No new skills in the repositories you follow.");
      for (const entry of sources) log(entry.error ? `${entry.source}: ${entry.error}` : `${entry.source}: ${entry.names.join(", ")}\n  Add with afk kit add <skill> --source ${entry.source}`);
      return 0;
    }
    throw new Error(KIT_HELP);
  } finally { await operations.close(); }
}

const ADD_HELP = `Install skills from a repository and decide where they go

  afk add <repository> [--skill <name>]... [--all]
          [--core | --pack <name> | --here | --later]
          [--project <name>] [--agent <agent>] [--replace] [--yes]

--core      Install now, and bring it to every machine
--pack      Download into this pack, created if new. The pack stays on or off as it is
--here      Install on this machine only. --project installs into that project instead
--later     Bookmark it to try later. Installs nothing
--replace   Allow replacing a skill installed from another repository
--yes       Skip the confirmation. Needs the skills and destination spelled out

Skills CLI does the installing. For a published manifest URL, use afk install.`;

export async function runAdd(args: string[], store: SettingsStore, dependencies: CliDependencies & { runner?: InstallRunner } = {}): Promise<number> {
  const log = dependencies.log ?? console.log;
  if (!args[0] || ["--help", "-h", "help"].includes(args[0])) { log(ADD_HELP); return args[0] ? 0 : 1; }
  const [source, ...options] = args as [string, ...string[]];
  if (source.startsWith("-")) throw new Error(ADD_HELP);
  const named: string[] = [];
  let all = false, yes = false, allowReplace = false, destination: string | undefined, packName: string | undefined, project: string | undefined, agent: string | undefined;
  const choose = (value: string): void => {
    if (destination) throw new Error("Choose one destination: --core, --pack, --here or --later.");
    destination = value;
  };
  for (let index = 0; index < options.length; index++) {
    const option = options[index]!;
    const value = (): string => {
      const next = options[++index];
      if (!next || next.startsWith("--")) throw new Error(`Provide a value after ${option}.`);
      return next;
    };
    if (option === "--skill" || option === "-s") named.push(value());
    else if (option === "--all") all = true;
    else if (option === "--core") choose("core");
    else if (option === "--here") choose("here");
    else if (option === "--later") choose("later");
    else if (option === "--pack") { choose("pack"); packName = value(); }
    else if (option === "--project" || option === "-p") project = value();
    else if (option === "--agent" || option === "-a") agent = value();
    else if (option === "--replace") allowReplace = true;
    else if (option === "--yes" || option === "-y") yes = true;
    else throw new Error(`Unknown option: ${option}.\n${ADD_HELP}`);
  }
  if (project && destination && destination !== "here") throw new Error("--project goes with --here.");
  const interactive = dependencies.interactive ?? Boolean(stdin.isTTY && stdout.isTTY);
  if (!interactive) {
    if (!named.length && !all && destination !== "later") throw new Error("Name the skills with --skill or --all, or run this in a terminal.");
    if (!destination) throw new Error("Choose a destination with --core, --pack, --here or --later, or run this in a terminal.");
    if (!yes) throw new Error("Pass --yes to confirm, or run this in a terminal.");
  }
  await store.initialize();
  const operations = new FieldworkOperations(store);
  if (dependencies.runner) operations.installRunner = dependencies.runner;
  const { ask, close } = asker(dependencies);
  try {
    if (destination === "later" && !named.length && (all || !interactive)) {
      await operations.run("kit/install", { source, names: [], to: "later" });
      log(`Saved ${source} to Try later. Nothing was installed.`);
      return 0;
    }
    log(`Reading ${source}. A large repository can take a while…`);
    const { candidates } = await operations.run("kit/install-preview", { source }) as { candidates: InstallCandidate[] };
    const note = (item: InstallCandidate): string => item.state === "tool" ? `  (installed by ${item.tool})` : item.state === "conflict" ? `  (installed from ${item.installedFrom ?? "an unknown source"})` : item.state === "installed" ? "  (already installed)" : "";
    log(`${source}: ${plural(candidates.length, "skill")}`);
    for (const item of candidates) log(`  ${item.name}${note(item)}${item.description ? `\n    ${item.description}` : ""}`);
    const installable = candidates.filter(item => item.state !== "tool").map(item => item.name);
    let selection = named;
    if (!selection.length && !all && !(destination === "later" && !interactive)) {
      if (!interactive) throw new Error("Name the skills with --skill or --all.");
      const answer = (await ask("Skills to use (comma-separated, or all): ")).trim();
      if (answer.toLowerCase() === "all") all = true;
      else selection = answer.split(/[\s,]+/).filter(Boolean);
    }
    if (!destination) {
      const answer = (await ask("Where should they go? core, pack, here or later: ")).trim().toLowerCase();
      if (!["core", "pack", "here", "later"].includes(answer)) throw new Error("Choose core, pack, here or later.");
      destination = answer;
      if (destination === "pack") packName = (await ask("Pack name: ")).trim();
      if (destination === "here" && !project) project = (await ask("Project name, or empty for this machine: ")).trim() || undefined;
    }
    if (all) selection = destination === "later" ? [] : installable;
    const conflicts = destination === "core" || destination === "here" ? candidates.filter(item => selection.includes(item.name) && item.state === "conflict") : [];
    if (conflicts.length) log(`This replaces skills installed from another repository: ${conflicts.map(item => `${item.name} (${item.installedFrom ?? "unknown source"})`).join(", ")}`);
    if (conflicts.length && !allowReplace && !interactive) throw new Error("Pass --replace to replace them, or leave them out.");
    let to = destination === "here" ? "machine" : destination!;
    if (destination === "pack") {
      const { profiles } = await store.read();
      const matches = profiles.filter(profile => profile.id === packName || profile.name.toLowerCase() === (packName ?? "").toLowerCase());
      if (matches.length > 1) throw new Error(`Several packs are named ${packName}. Use its ID.`);
      to = matches[0]?.id ?? "new-pack";
    }
    if (!yes) {
      const what = selection.length ? selection.join(", ") : "the whole repository";
      if (!["y", "yes"].includes((await ask(`${destination === "later" ? "Bookmark" : "Use"} ${what} → ${destination}${destination === "pack" ? ` (${packName})` : ""}? [y/N]: `)).trim().toLowerCase())) { log("Nothing changed."); return 0; }
    }
    const result = await operations.run("kit/install", {
      source, names: selection, to,
      ...(to === "new-pack" ? { packName } : {}), ...(project ? { scope: project } : {}), ...(agent ? { agent } : {}),
      ...(conflicts.length ? { replace: conflicts.map(item => item.name) } : {}),
    }) as { ok: boolean; install?: { output: string; phase: string; code?: number; cancelled?: boolean } };
    if (result.install) log(`${result.install.output}\n${result.install.phase}`);
    if (!result.ok) { log("Nothing was added to your kit."); return result.install?.cancelled ? 130 : Math.max(1, Math.min(255, result.install?.code ?? 1)); }
    const done = { core: "Added to Core. Other machines will see it as missing until they sync.", machine: project ? `Installed in ${project}.` : "Installed on this machine only.", later: "Saved to Try later. Nothing was installed." } as Record<string, string>;
    log(done[to] ?? `Added to ${packName}. Skills are downloaded; the pack stays as it was.`);
    return 0;
  } finally { close(); await operations.close(); }
}
