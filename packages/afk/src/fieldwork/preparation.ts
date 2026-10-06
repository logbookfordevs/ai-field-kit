import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { containsControl, skillName } from "./settings.js";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function repositoryDirectory(value: unknown): string | undefined {
  if (typeof value !== "string" || containsControl(value)) return undefined;
  const path = value.replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = path.split("/");
  if (parts.at(-1) !== "SKILL.md" || parts.some(part => !part || part === "." || part === ".." || part.includes(":")) || parts[0]?.startsWith("~")) return undefined;
  return parts.slice(0, -1).join("/") || ".";
}

export class SourcePreparation {
  private readonly sources = new Map<string, string>();

  async discover(source: string): Promise<string[]> {
    if (!source.trim() || source.startsWith("-") || containsControl(source)) throw new Error("Enter a repository URL or owner/repository.");
    let directory = this.sources.get(source);
    if (!directory) {
      directory = await mkdtemp(join(tmpdir(), "afk-prepare-"));
      const home = join(directory, "home");
      await mkdir(home);
      const result = await new Promise<{ code: number; output: string }>((accept, reject) => {
        const child = spawn("npx", ["--yes", "skills", "add", source, "--skill", "*", "--agent", "codex", "--yes", "--copy"], {
          cwd: directory, env: { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: join(home, ".local/state") }, stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        const append = (data: Buffer): void => { output = (output + data.toString()).slice(-30_000); };
        child.stdout.on("data", append); child.stderr.on("data", append);
        child.once("error", reject); child.once("close", code => accept({ code: code ?? 1, output }));
      }).catch(async error => { await rm(directory!, { recursive: true, force: true }); throw error; });
      if (result.code !== 0) { await rm(directory, { recursive: true, force: true }); throw new Error(`Skills CLI could not prepare the source:\n${result.output}`); }
      this.sources.set(source, directory);
    }
    const members = await readdir(join(directory, ".agents/skills"));
    return members.filter(name => skillName(name) && !name.startsWith("."));
  }

  async directory(source: string): Promise<string> {
    await this.discover(source);
    return join(this.sources.get(source)!, ".agents/skills");
  }

  async paths(source: string): Promise<Record<string, string>> {
    const names = await this.discover(source);
    let lock: unknown;
    try {
      lock = JSON.parse(await readFile(join(this.sources.get(source)!, "skills-lock.json"), "utf8"));
    } catch { return {}; }
    if (!record(lock) || lock.version !== 1 || !record(lock.skills)) return {};

    const paths: [string, string][] = [];
    for (const name of names) {
      const entry = lock.skills[name];
      if (!record(entry) || typeof entry.sourceType !== "string" || !["github", "gitlab", "git"].includes(entry.sourceType)) continue;
      const directory = repositoryDirectory(entry.skillPath);
      if (directory !== undefined) paths.push([name, directory]);
    }
    return Object.fromEntries(paths);
  }

  async close(): Promise<void> {
    await Promise.all([...this.sources.values()].map(path => rm(path, { recursive: true, force: true })));
    this.sources.clear();
  }
}
