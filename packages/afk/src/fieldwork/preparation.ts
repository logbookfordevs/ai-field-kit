import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { ProcessOutput } from "./process-output.js";
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

function skippedSkills(transcript: string): string[] {
  return transcript.split("\n").flatMap(line => {
    const match = line.match(/Skipped\s+(\S*SKILL\.md)\s+[—–-]\s+(.+)$/);
    if (!match) return [];
    const path = match[1]!.replace(/\\/g, "/").match(/\/skills-[^/]+\/(.+)$/)?.[1] ?? match[1]!.split("/").slice(-2).join("/");
    const yaml = match[2]!.match(/YAML parse error.*?(at line \d+, column \d+)/);
    return [`${path}: ${yaml ? `YAML parse error ${yaml[1]}` : match[2]!.trim()}`];
  });
}

function noValidSkills(transcript: string): Error {
  const skipped = skippedSkills(transcript);
  const details = skipped.length ? `\nSkills CLI skipped:\n${skipped.map(entry => `- ${entry}`).join("\n")}` : "";
  const yaml = skipped.some(entry => entry.includes("YAML parse error"))
    ? "\nA YAML error in SKILL.md frontmatter is often an unquoted description containing \": \". Ask the maintainer to quote it, or add a fixed fork as the source."
    : "\nEach skill needs a SKILL.md with a name and description in valid frontmatter.";
  return new Error(`No valid skills found in this source.${details}${yaml}`);
}

function preparationFailure(source: string, output: string): Error {
  const transcript = new ProcessOutput().append(output).trim();
  if (/No (valid )?skills found/i.test(transcript)) return noValidSkills(transcript);
  const fatal = transcript.split("\n").find(line => line.includes("fatal:"));
  const summary = fatal ? fatal.slice(fatal.indexOf("fatal:")) : transcript.slice(-4000);
  let guidance = "";
  try {
    const url = new URL(source);
    const tree = url.hostname === "github.com" && url.pathname.match(/^\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
    if (tree && /Remote branch .+ not found in upstream origin/.test(summary)) {
      const [, owner, repo, branch, remainder] = tree;
      guidance = `\nSkills CLI reads only "${branch}" as the branch in this /tree/ URL. If "${branch}/${remainder}" is the full branch name, use https://github.com/${owner}/${repo}#${branch}/${remainder}. If part of the path is a folder, use the repository URL followed by # and the exact branch name, then choose the skills.`;
    }
  } catch { /* Non-URL source references also use Skills CLI. */ }
  return new Error(`Skills CLI could not prepare the source:\n${summary || "No error output was returned."}${guidance}`);
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
      if (result.code !== 0) { await rm(directory, { recursive: true, force: true }); throw preparationFailure(source, result.output); }
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
