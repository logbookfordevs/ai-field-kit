#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { dirname, join } = require("node:path");

const agent = readArg("--agent") || "codex";

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

  const paths = parseStatusPaths(status.stdout);
  const implementationPaths = paths.filter(isImplementationPath);
  if (implementationPaths.length === 0) {
    clearSentinel(cwd);
    return allow();
  }

  const marker = readActiveTrackingMarker(cwd);
  if (!marker) {
    clearSentinel(cwd);
    return allow();
  }

  const reconciliationPaths = paths.filter((path) => isReconciliationPath(path, marker));
  if (reconciliationPaths.length > 0) {
    clearSentinel(cwd);
    return allow();
  }

  const signature = hash(implementationPaths.sort().join("\n"));
  if (readSentinel(cwd) === signature) {
    return allow();
  }

  writeSentinel(cwd, signature);
  return blockOnce();
}

function blockOnce() {
  const reason = [
    "Implementation files changed and an AFK execution-tracking marker is active, but the active tracking checkpoint, implementation notes, or ADRs do not appear to have changed.",
    "Before final handoff, update the active tracking checkpoint or related notes/ADRs if the implementation changed their status, validation, decisions, or handoff context.",
  ].join(" ");

  return output({ decision: "block", reason });
}

function allow() {
  return output({ continue: true });
}

function output(value) {
  process.stdout.write(JSON.stringify(value));
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function git(cwd, args) {
  try {
    return { ok: true, stdout: execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch {
    return { ok: false, stdout: "" };
  }
}

function parseStatusPaths(status) {
  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((path) => (path.includes(" -> ") ? path.split(" -> ").pop() : path))
    .filter(Boolean);
}

function isImplementationPath(path) {
  const normalized = path.replace(/\\/g, "/");
  if (isReconciliationPath(normalized, null)) {
    return false;
  }

  if (/^(docs|\.codex|\.claude|\.cursor|\.gemini|\.opencode|node_modules|dist|build|coverage|\.next)\//.test(normalized)) {
    return false;
  }

  if (/\.(md|mdx|txt|png|jpg|jpeg|gif|svg|webp|lock)$/i.test(normalized)) {
    return false;
  }

  return /^(src|app|pages|components|packages|lib|server|api|test|tests|__tests__)\//.test(normalized) ||
    /(^|\/)(package\.json|tsconfig[^/]*\.json|vite\.config\.[jt]s|next\.config\.[jt]s|webpack\.config\.[jt]s|\.github\/workflows\/[^/]+\.ya?ml)$/.test(normalized);
}

function isReconciliationPath(path, marker) {
  const normalized = path.replace(/\\/g, "/");
  if (marker && marker.relevantPaths.some((relevantPath) => normalized === relevantPath || normalized.startsWith(`${relevantPath}/`))) {
    return true;
  }

  return /(^|\/)docs\/[^/]+\/tracking\/[^/]+\.md$/.test(normalized) ||
    /\.tracking\.md$/.test(normalized) ||
    /\.implementation-notes\.md$/.test(normalized) ||
    /\.adr\.md$/.test(normalized) ||
    /(^|\/)docs\/[^/]+\/decisions\/[^/]+\.md$/.test(normalized);
}

function readActiveTrackingMarker(cwd) {
  const path = join(cwd, ".afk", "execution-tracking", "current.json");
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const relevantPaths = [
      typeof parsed.tracking === "string" ? parsed.tracking : "",
      typeof parsed.checkpoint === "string" ? parsed.checkpoint : "",
      ...(Array.isArray(parsed.related) ? parsed.related.filter((item) => typeof item === "string") : []),
    ]
      .map((item) => item.replace(/\\/g, "/").replace(/^\.?\//, ""))
      .filter(Boolean);

    return relevantPaths.length > 0 ? { relevantPaths } : null;
  } catch {
    return null;
  }
}

function sentinelPath(cwd) {
  const gitDir = git(cwd, ["rev-parse", "--git-dir"]);
  if (!gitDir.ok || !gitDir.stdout.trim()) {
    return "";
  }

  const resolvedGitDir = gitDir.stdout.trim();
  const base = resolvedGitDir.startsWith("/") ? resolvedGitDir : join(cwd, resolvedGitDir);
  return join(base, "afk-hooks", "execution-tracking-stop-check.json");
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

function clearSentinel(cwd) {
  const path = sentinelPath(cwd);
  if (path && existsSync(path)) {
    rmSync(path, { force: true });
  }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
