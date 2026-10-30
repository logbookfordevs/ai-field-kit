import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SourcePreparation } from "./preparation.js";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

let preparation: SourcePreparation;
let members: string[];
let lockContents: string | undefined;

beforeEach(() => {
  preparation = new SourcePreparation();
  members = ["deploy", "guide"];
  lockContents = undefined;
  spawn.mockReset();
  spawn.mockImplementation((_command: string, _args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    void (async () => {
      for (const name of members) await mkdir(join(options.cwd, ".agents/skills", name), { recursive: true });
      if (lockContents !== undefined) await writeFile(join(options.cwd, "skills-lock.json"), lockContents);
      child.emit("close", 0);
    })().catch(error => child.emit("error", error));
    return child;
  });
});

afterEach(async () => { await preparation.close(); });

it("uses original repository directories from Skills CLI metadata independently of installed names", async () => {
  lockContents = JSON.stringify({ version: 1, skills: {
    deploy: { sourceType: "github", skillPath: "agent-skills/release-toolkit/SKILL.md" },
    guide: { sourceType: "git", skillPath: ".\\agent-skills\\workspace-guide\\SKILL.md" },
    absent: { sourceType: "github", skillPath: "agent-skills/absent/SKILL.md" },
  } });
  expect(await preparation.discover("owner/repository")).toEqual(["deploy", "guide"]);
  expect(await preparation.paths("owner/repository")).toEqual({ deploy: "agent-skills/release-toolkit", guide: "agent-skills/workspace-guide" });
  expect(spawn).toHaveBeenCalledTimes(1);
  const options = spawn.mock.calls[0]?.[2] as { cwd: string; env: NodeJS.ProcessEnv };
  expect(options.env.HOME).toBe(join(options.cwd, "home"));
  expect(options.env.USERPROFILE).toBe(options.env.HOME);
  expect(options.env.XDG_STATE_HOME).toBe(join(options.cwd, "home/.local/state"));
});

it("omits skills that live inside .agents or .claude folders of the repository", async () => {
  members = ["deploy", "guide", "internal", "mirror"];
  lockContents = JSON.stringify({ version: 1, skills: {
    deploy: { sourceType: "github", skillPath: "skills/deploy/SKILL.md" },
    guide: { sourceType: "github", skillPath: "packages/app/.agents/skills/guide/SKILL.md" },
    internal: { sourceType: "github", skillPath: ".claude/skills/internal/SKILL.md" },
    mirror: { sourceType: "github", skillPath: ".agents/skills/mirror/SKILL.md" },
  } });
  expect(await preparation.discover("owner/repository")).toEqual(["deploy"]);
  expect(await preparation.paths("owner/repository")).toEqual({ deploy: "skills/deploy" });
});

it("represents a repository root skill without inventing a folder from its name", async () => {
  lockContents = JSON.stringify({ version: 1, skills: { deploy: { sourceType: "gitlab", skillPath: "SKILL.md" } } });
  expect(await preparation.paths("owner/repository")).toEqual({ deploy: "." });
});

it.each([
  undefined,
  "{invalid",
  "null",
  JSON.stringify({ version: 2, skills: { deploy: { sourceType: "github", skillPath: "skills/deploy/SKILL.md" } } }),
  JSON.stringify({ version: 1, skills: [] }),
])("keeps repository discovery available without supported lock metadata (%s)", async contents => {
  lockContents = contents;
  expect(await preparation.paths("owner/repository")).toEqual({});
  expect(await preparation.discover("owner/repository")).toEqual(["deploy", "guide"]);
});

it.each([
  "/Users/example/private/SKILL.md", "C:\\private\\SKILL.md", "\\\\server\\share\\SKILL.md",
  "~/private/SKILL.md", "skills/../private/SKILL.md", "../private/SKILL.md", "skills\n/private/SKILL.md",
  "skills/./private/SKILL.md", "skills//private/SKILL.md", "skills/private/README.md", 7, null,
])("omits unsafe or invalid paths while retaining discovery (%s)", async skillPath => {
  lockContents = JSON.stringify({ version: 1, skills: { deploy: { sourceType: "github", skillPath } } });
  expect(await preparation.paths("owner/repository")).toEqual({});
  expect(await preparation.discover("owner/repository")).toContain("deploy");
});

it("omits local, unsupported and malformed entries while retaining valid repository metadata", async () => {
  members = ["deploy", "guide", "local", "web", "broken"];
  lockContents = JSON.stringify({ version: 1, skills: {
    deploy: { sourceType: "github", skillPath: "skills/deploy/SKILL.md" },
    guide: { sourceType: { toString: null }, skillPath: "skills/guide/SKILL.md" },
    local: { sourceType: "local", skillPath: "skills/local/SKILL.md" },
    web: { sourceType: "well-known", skillPath: "skills/web/SKILL.md" },
    broken: null,
  } });
  expect(await preparation.paths("owner/repository")).toEqual({ deploy: "skills/deploy" });
  expect(await preparation.discover("owner/repository")).toHaveLength(5);
});

it.each([
  ["https://github.com/logbookfordevs/atlas-skills/tree/feat/atlas-implement", true],
  ["https://github.com/logbookfordevs/atlas-skills#feat/atlas-implement", false],
  ["owner/repo", false],
])("reports readable clone failures with branch guidance only for ambiguous tree URLs (%s)", async (source, ambiguous) => {
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    queueMicrotask(() => {
      child.stderr.write("\u001b[31mBanner\u001b[0m\n│ fatal: Remote branch feat not found in upstream origin\n");
      child.emit("close", 1);
    });
    return child;
  });
  const error = await preparation.discover(source).catch((error: Error) => error);
  expect(error).toBeInstanceOf(Error);
  const message = (error as Error).message;
  expect(message).toContain("fatal: Remote branch feat not found");
  expect(message).not.toContain("\u001b");
  expect(message).not.toContain("Banner");
  if (ambiguous) expect(message).toContain("https://github.com/logbookfordevs/atlas-skills#feat/atlas-implement");
  else expect(message).not.toContain("If");
  expect(spawn.mock.calls[0]?.[1]).toContain(source);
});

it("explains sources without valid skills, naming skipped files and YAML guidance without installer noise", async () => {
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    queueMicrotask(() => {
      child.stdout.write("███ banner ███\n│ Tip: use the --yes flag\n◇ Repository cloned\n│\n⚠ Skipped /var/folders/_w/abc/T/skills-vD7azl/skills/iso-figure/SKILL.md — YAML parse error: Nested mappings are not allowed in compact mappings at line 2, column 14: description: Build a figure: monochrome\n◇ No skills found\n└ No valid skills found. Skills require a SKILL.md with name and description.\nnpm notice New minor version of npm available!\n");
      child.emit("close", 1);
    });
    return child;
  });
  const message = (await preparation.discover("https://github.com/owner/repo").catch((error: Error) => error) as Error).message;
  expect(message).toContain("No valid skills found in this source.");
  expect(message).toContain("- skills/iso-figure/SKILL.md: YAML parse error at line 2, column 14");
  expect(message).toContain("unquoted description");
  for (const noise of ["banner", "npm notice", "Tip:", "/var/folders"]) expect(message).not.toContain(noise);
});

it("explains an empty source without inventing skipped files", async () => {
  spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() });
    queueMicrotask(() => { child.stdout.write("◇ No skills found\n"); child.emit("close", 1); });
    return child;
  });
  const message = (await preparation.discover("owner/empty").catch((error: Error) => error) as Error).message;
  expect(message).toContain("No valid skills found in this source.");
  expect(message).not.toContain("skipped");
  expect(message).toContain("valid frontmatter");
});
