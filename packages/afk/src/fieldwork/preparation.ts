import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { containsControl, skillName } from "./settings.js";

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
          cwd: directory, env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: ["ignore", "pipe", "pipe"],
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

  async close(): Promise<void> {
    await Promise.all([...this.sources.values()].map(path => rm(path, { recursive: true, force: true })));
    this.sources.clear();
  }
}
