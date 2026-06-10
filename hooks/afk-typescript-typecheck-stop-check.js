#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const timeoutMs = Number.parseInt(process.env.AFK_TYPECHECK_TIMEOUT_MS || "120000", 10);

main();

function main() {
  const input = readStdinJson();
  if (input.stop_hook_active === true) {
    return allow();
  }

  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const status = git(cwd, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status.ok) {
    return allow();
  }

  const changedTypeScriptPaths = parseStatusPaths(status.stdout).filter(isTypeScriptPath);
  if (changedTypeScriptPaths.length === 0) {
    return allow();
  }

  const commands = inferTypecheckCommands(cwd, changedTypeScriptPaths);
  if (commands.length === 0) {
    return block([
      "TypeScript files changed, but no typecheck command was found.",
      "Add or run the repo's typecheck before final handoff.",
    ].join(" "));
  }

  const signature = buildSignature(cwd, changedTypeScriptPaths, commands);
  if (readSentinel(cwd) === signature) {
    return allow();
  }

  for (const command of commands) {
    const result = runCommand(command);
    if (!result.ok) {
      return block([
        `TypeScript files changed and typecheck failed: ${command.display}`,
        tail(result.output),
      ].filter(Boolean).join("\n\n"));
    }
  }

  writeSentinel(cwd, signature);
  return allow();
}

function inferTypecheckCommands(cwd, changedTypeScriptPaths) {
  const packageDirs = unique(changedTypeScriptPaths.map((path) => findNearestPackageDir(cwd, path)).filter(Boolean));
  const packageCommands = packageDirs
    .map((dir) => scriptCommand(cwd, dir, "typecheck"))
    .filter(Boolean);

  if (packageCommands.length === packageDirs.length && packageCommands.length > 0) {
    return packageCommands;
  }

  const rootTypecheck = scriptCommand(cwd, cwd, "typecheck") || scriptCommand(cwd, cwd, "afk:typecheck");
  if (rootTypecheck) {
    return [rootTypecheck];
  }

  const tsconfigDir = findNearestTsconfigDir(cwd, changedTypeScriptPaths);
  if (tsconfigDir) {
    return [{
      command: "npx",
      args: ["tsc", "--noEmit"],
      cwd: tsconfigDir,
      display: displayCommand(tsconfigDir, "npx", ["tsc", "--noEmit"]),
    }];
  }

  return [];
}

function scriptCommand(repoRoot, dir, scriptName) {
  const packageJson = readPackageJson(dir);
  if (!packageJson || !hasScript(packageJson, scriptName)) {
    return null;
  }

  const packageManager = detectPackageManager(repoRoot, dir, packageJson);
  const args = ["run", scriptName];
  return {
    command: packageManager,
    args,
    cwd: dir,
    display: displayCommand(dir, packageManager, args),
  };
}

function runCommand(command) {
  try {
    const stdout = execFileSync(command.command, command.args, {
      cwd: command.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
    });
    return { ok: true, output: stdout };
  } catch (error) {
    return { ok: false, output: commandErrorOutput(error) };
  }
}

function commandErrorOutput(error) {
  if (error && typeof error === "object") {
    const stdout = Buffer.isBuffer(error.stdout) ? error.stdout.toString("utf8") : String(error.stdout || "");
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString("utf8") : String(error.stderr || "");
    return [stdout, stderr].filter(Boolean).join("\n");
  }

  return String(error || "");
}

function parseStatusPaths(status) {
  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((path) => (path.includes(" -> ") ? path.split(" -> ").pop() : path))
    .filter(Boolean);
}

function isTypeScriptPath(path) {
  const normalized = path.replace(/\\/g, "/");
  if (/^(node_modules|dist|build|coverage|\.next)\//.test(normalized)) {
    return false;
  }

  return /\.(ts|tsx)$/i.test(normalized);
}

function findNearestPackageDir(cwd, filePath) {
  let current = dirname(resolve(cwd, filePath));
  const root = resolve(cwd);

  while (current.startsWith(root)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }

    if (current === root) {
      break;
    }
    current = dirname(current);
  }

  return "";
}

function findNearestTsconfigDir(cwd, paths) {
  for (const path of paths) {
    let current = dirname(resolve(cwd, path));
    const root = resolve(cwd);

    while (current.startsWith(root)) {
      if (existsSync(join(current, "tsconfig.json"))) {
        return current;
      }

      if (current === root) {
        break;
      }
      current = dirname(current);
    }
  }

  return existsSync(join(cwd, "tsconfig.json")) ? cwd : "";
}

function readPackageJson(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson && packageJson.scripts && typeof packageJson.scripts[scriptName] === "string");
}

function detectPackageManager(repoRoot, dir, packageJson) {
  if (typeof packageJson.packageManager === "string") {
    return packageJson.packageManager.split("@")[0] || "npm";
  }

  const lockDir = findUp(dir, repoRoot, ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json", "npm-shrinkwrap.json"]);
  if (lockDir) {
    if (existsSync(join(lockDir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(lockDir, "yarn.lock"))) {
      return "yarn";
    }
    if (existsSync(join(lockDir, "bun.lockb")) || existsSync(join(lockDir, "bun.lock"))) {
      return "bun";
    }
  }

  return "npm";
}

function findUp(start, stop, filenames) {
  let current = resolve(start);
  const root = resolve(stop);

  while (current.startsWith(root)) {
    if (filenames.some((filename) => existsSync(join(current, filename)))) {
      return current;
    }

    if (current === root) {
      break;
    }
    current = dirname(current);
  }

  return "";
}

function buildSignature(cwd, changedTypeScriptPaths, commands) {
  const payload = {
    files: changedTypeScriptPaths.sort().map((path) => [path, fileHash(join(cwd, path))]),
    commands: commands.map((command) => [command.cwd, command.command, ...command.args]),
    packageJson: commands.map((command) => fileHash(join(command.cwd, "package.json"))),
    tsconfigs: unique([cwd, ...commands.map((command) => command.cwd)]).map((dir) => fileHash(join(dir, "tsconfig.json"))),
  };

  return hash(JSON.stringify(payload));
}

function fileHash(path) {
  if (!existsSync(path)) {
    return "missing";
  }

  return hash(readFileSync(path));
}

function sentinelPath(cwd) {
  const gitDir = git(cwd, ["rev-parse", "--git-dir"]);
  if (!gitDir.ok || !gitDir.stdout.trim()) {
    return "";
  }

  const resolvedGitDir = gitDir.stdout.trim();
  const base = resolvedGitDir.startsWith("/") ? resolvedGitDir : join(cwd, resolvedGitDir);
  return join(base, "afk-hooks", "typescript-typecheck-stop-check.json");
}

function readSentinel(cwd) {
  const path = sentinelPath(cwd);
  if (!path || !existsSync(path)) {
    return "";
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed.signature === "string" ? parsed.signature : "";
  } catch {
    return "";
  }
}

function writeSentinel(cwd, signature) {
  const path = sentinelPath(cwd);
  if (!path) {
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ signature, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function displayCommand(cwd, command, args) {
  return `(cd ${quote(cwd)} && ${[command, ...args].map(quote).join(" ")})`;
}

function quote(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function tail(value) {
  const clean = String(value || "").trim();
  if (clean.length <= 4000) {
    return clean;
  }

  return clean.slice(-4000);
}

function git(cwd, args) {
  try {
    return { ok: true, stdout: execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch {
    return { ok: false, stdout: "" };
  }
}

function unique(values) {
  return [...new Set(values)];
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function allow() {
  return output({ continue: true });
}

function block(reason) {
  return output({ decision: "block", reason });
}

function output(value) {
  process.stdout.write(JSON.stringify(value));
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
