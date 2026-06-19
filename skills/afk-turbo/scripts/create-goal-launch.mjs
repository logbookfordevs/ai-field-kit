#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

const goalArg = args.find((arg) => !arg.startsWith("--"));
if (!goalArg) {
  fail("Missing <goal.md> path.");
}

const boardUrl = readFlagValue(args, "--board-url");
const shouldOpen = !args.includes("--no-open") && process.env.AFK_NO_OPEN !== "1";
const staticOnly = args.includes("--static");
const reviewGated = args.includes("--review-gated");
const goalPath = resolve(goalArg);
if (!existsSync(goalPath)) {
  fail(`Goal file not found: ${goalPath}`);
}
if (basename(goalPath) !== "goal.md") {
  fail("Expected a goal.md file.");
}

const goalDir = dirname(goalPath);
const workspacePath = findWorkspaceRoot(goalDir);
const relativeGoalPath = normalizePath(relative(workspacePath, goalPath));
const launchPath = join(goalDir, "goal-launch.html");
const goalText = readText(goalPath);
const factsText = readOptional(join(goalDir, "facts.md"));
const planText = readOptional(join(goalDir, "plan.md"));
const stateText = readOptional(join(goalDir, "state.yaml"));

const title = firstHeading(goalText) || titleFromSlug(basename(goalDir));
const launchCommand = reviewGated
  ? `/goal Follow ${relativeGoalPath || normalizePath(goalPath)} in AFK Turbo review-gated mode.`
  : `/goal Follow ${relativeGoalPath || normalizePath(goalPath)}.`;
const launchPrompt = [
  reviewGated ? "Run AFK Turbo in review-gated mode for this goal." : "Run AFK Turbo for this goal.",
  "",
  launchCommand,
  reviewGated
    ? "\nDo not auto-commit task code changes. Stage them and wait for human review before marking code-changing tasks done."
    : "",
].join("\n");

const codexUrl = deepLink("codex://threads/new", {
  path: workspacePath,
  prompt: launchPrompt,
});
const claudeUrl = deepLink("claude-cli://open", {
  cwd: workspacePath,
  q: launchPrompt,
});

const sections = [
  { label: "Goal", path: "goal.md", text: goalText, fallback: "Goal file is present but has no readable prose." },
  { label: "Facts", path: "facts.md", text: factsText, fallback: "No facts.md found beside the goal." },
  { label: "Plan", path: "plan.md", text: planText, fallback: "No plan.md found beside the goal." },
  { label: "Board State", path: "state.yaml", text: stateText, fallback: "No state.yaml found beside the goal." },
];

const pageData = {
  title,
  workspacePath,
  goalPath,
  relativeGoalPath,
  launchCommand,
  launchPrompt,
  codexUrl,
  claudeUrl,
  boardUrl,
  reviewGated,
  sections,
  generatedAt: new Date().toISOString(),
};

writeFileSync(launchPath, renderHtml({ ...pageData, live: false }), "utf8");

console.log(`Goal launch page written: ${launchPath}`);
console.log(`Static: ${pathToFileURL(launchPath).href}`);
if (staticOnly) {
  if (shouldOpen) {
    openUrl(pathToFileURL(launchPath).href);
  }
} else {
  await runLaunchGate(pageData, shouldOpen);
}

function printHelp() {
  console.log(`Usage: node create-goal-launch.mjs <goal.md> [--board-url <url>] [--review-gated] [--no-open] [--static]

Creates goal-launch.html beside goal.md with Codex and Claude Code deep links.

Default mode opens a localhost launch gate and waits for a button response.
Use --review-gated when Turbo should stage code changes and wait for human review before task completion.
Use --static to only open the generated file without waiting for a response.
Set AFK_NO_OPEN=1 or pass --no-open to skip opening.`);
}

function readFlagValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return "";
  return argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function runLaunchGate(data, open) {
  const action = await new Promise((resolveAction) => {
    let settled = false;
    const server = createServer((request, response) => {
      if (request.method === "GET" && (request.url === "/" || request.url === "/goal-launch.html")) {
        send(response, 200, "text/html; charset=utf-8", renderHtml({ ...data, live: true }));
        return;
      }

      if (request.method === "POST" && request.url === "/action") {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
          body += chunk;
        });
        request.on("end", () => {
          const result = parseAction(body, data);
          send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, action: result }));
          if (!settled) {
            settled = true;
            resolveAction(result);
            setTimeout(() => server.close(), 50);
          }
        });
        return;
      }

      send(response, 404, "text/plain; charset=utf-8", "Not found");
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const url = `http://127.0.0.1:${port}/goal-launch.html`;
      console.log(`Live: ${url}`);
      console.log("Waiting for launch action...");
      if (open) {
        openUrl(url);
      }
    });
  });

  console.log(`AFK_TURBO_LAUNCH_ACTION ${JSON.stringify(action)}`);
}

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

function parseAction(body, data) {
  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = {};
  }

  return {
    action: typeof parsed.action === "string" ? parsed.action : "unknown",
    goalPath: data.goalPath,
    relativeGoalPath: data.relativeGoalPath,
    launchCommand: data.launchCommand,
    workspacePath: data.workspacePath,
    timestamp: new Date().toISOString(),
  };
}

function openUrl(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const commandArgs = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    execFileSync(command, commandArgs, { stdio: "ignore" });
  } catch {
    console.warn(`Could not open launch page automatically. Open it manually: ${url}`);
  }
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function readOptional(path) {
  return existsSync(path) ? readText(path) : "";
}

function findWorkspaceRoot(startDir) {
  try {
    return execFileSync("git", ["-C", startDir, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return startDir;
  }
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? cleanInlineMarkdown(match[1] ?? "").trim() : "";
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanInlineMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_#>]/g, "")
    .trim();
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function deepLink(base, params) {
  const search = new URLSearchParams(params);
  return `${base}?${search.toString()}`;
}

function summarizeMarkdown(text, fallback, maxItems = 4) {
  if (!text.trim()) return [fallback];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("```"))
    .filter((line) => !line.match(/^[-*_]{3,}$/));

  const bullets = lines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^\[[ xX-]\]\s+/.test(line))
    .map((line) => cleanInlineMarkdown(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").replace(/^\[[ xX-]\]\s+/, "")))
    .filter(Boolean);

  const paragraphs = lines
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line))
    .map(cleanInlineMarkdown)
    .filter(Boolean);

  const picked = [...bullets, ...paragraphs].slice(0, maxItems);
  return picked.length > 0 ? picked : [fallback];
}

function renderHtml(data) {
  const sectionCards = data.sections.map((section) => renderSection(section)).join("\n");
  const boardAction = data.boardUrl
    ? `<a class="link-action" href="${escapeAttribute(data.boardUrl)}">GoalBuddy board</a>`
    : `<span class="muted-action">Board appears after GoalBuddy starts</span>`;
  const liveActions = data.live
    ? `<button class="action primary" id="runHere" type="button">Run here</button>
      <button class="action quiet" id="closeGate" type="button">Close</button>`
    : "";
  const modeBadge = data.reviewGated ? `<span class="status">review-gated</span>` : `<span class="status">standard</span>`;
  const reviewNote = data.reviewGated
    ? `<p class="note">Review-gated mode stages code changes and waits for human review before code-changing tasks are marked done.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)} - AFK Turbo Launch</title>
<script>
(() => {
  const saved = localStorage.getItem("afk-goal-launch-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.classList.add("dark");
})();
</script>
<style>
  :root {
    --bg: oklch(0.982 0 0);
    --surface: oklch(1 0 0);
    --soft: oklch(0.955 0.004 250);
    --ink: oklch(0.19 0.005 250);
    --muted: oklch(0.48 0.012 250);
    --line: oklch(0.86 0.006 250);
    --accent: oklch(0.55 0.14 32);
    --accent-ink: oklch(0.99 0 0);
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  html.dark {
    --bg: oklch(0.16 0.004 250);
    --surface: oklch(0.205 0.006 250);
    --soft: oklch(0.26 0.008 250);
    --ink: oklch(0.94 0.006 250);
    --muted: oklch(0.72 0.01 250);
    --line: oklch(0.36 0.01 250);
    --accent: oklch(0.68 0.16 32);
    --accent-ink: oklch(0.14 0.004 250);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.58;
    -webkit-font-smoothing: antialiased;
  }
  code, pre { font-family: var(--mono); }
  a { color: inherit; }
  .page {
    width: min(760px, calc(100% - 28px));
    margin: 0 auto;
    padding: 24px 0 64px;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 52px;
  }
  .brand {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
  }
  .theme-toggle {
    border: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    border-radius: 8px;
    padding: 7px 10px;
    cursor: pointer;
  }
  header {
    margin-bottom: 20px;
  }
  h1 {
    margin: 0;
    font-size: 32px;
    line-height: 1.12;
    font-weight: 680;
    letter-spacing: 0;
    text-wrap: balance;
  }
  .lede {
    color: var(--muted);
    font-size: 15px;
    margin: 10px 0 0;
    max-width: 62ch;
  }
  .launch {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    padding: 18px;
    margin: 24px 0 14px;
  }
  .launch-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
    margin-bottom: 14px;
  }
  .launch h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
  }
  .status {
    color: var(--muted);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 5px 8px;
    font-family: var(--mono);
    font-size: 11px;
    white-space: nowrap;
    background: var(--soft);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
  .action {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 9px 11px;
    text-decoration: none;
    background: var(--surface);
    cursor: pointer;
    font: inherit;
    color: var(--ink);
  }
  .action.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .action.quiet, .muted-action {
    color: var(--muted);
  }
  .muted-action, .link-action {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    font-size: 14px;
  }
  .link-action {
    color: var(--accent);
    text-decoration: none;
  }
  .command {
    position: relative;
    background: var(--soft);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    overflow-x: auto;
    font-size: 13px;
  }
  .launch-status {
    min-height: 18px;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
  }
  details {
    border-top: 1px solid var(--line);
    margin-top: 18px;
    padding-top: 14px;
  }
  summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 14px;
  }
  .card {
    padding: 14px 0 0;
  }
  .card h3 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 650;
  }
  .card .path {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 11px;
    margin-bottom: 6px;
  }
  .card ul {
    margin: 0;
    padding-left: 18px;
  }
  .card li {
    margin: 4px 0;
    color: var(--muted);
    font-size: 14px;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .closing {
    position: fixed;
    inset: 0;
    display: none;
    place-items: center;
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    backdrop-filter: blur(12px);
    z-index: 10;
    text-align: center;
    padding: 24px;
  }
  .closing.active { display: grid; }
  .closing-card {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 12px;
    padding: 24px;
    width: min(420px, 100%);
  }
  .closing-count {
    display: block;
    font-size: 56px;
    line-height: 1;
    color: var(--accent);
    margin-top: 10px;
  }
  footer {
    margin-top: 18px;
    border-top: 1px solid var(--line);
    padding-top: 12px;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }
  @media (max-width: 640px) {
    .page { width: min(100% - 20px, 760px); }
    .launch-head { align-items: start; flex-direction: column; }
    .action { flex: 1 1 auto; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="topbar">
    <div class="brand">AFK Turbo / launch gate</div>
    <button class="theme-toggle" id="themeToggle" type="button">toggle theme</button>
  </div>

	  <header>
	    <h1>${escapeHtml(data.title)}</h1>
	    <p class="lede">Goal package ready. Choose where the run continues.</p>
	  </header>

  <section class="launch" aria-labelledby="launch-title">
    <div class="launch-head">
      <div>
	        <h2 id="launch-title">Launch</h2>
	        <p class="note">Deep links prefill the command; you still submit inside the agent.</p>
	      </div>
	      ${modeBadge}
	    </div>
	    ${reviewNote}
	    <div class="actions">
      ${liveActions}
      <a class="action secondary" id="openCodex" href="${escapeAttribute(data.codexUrl)}">Open in Codex</a>
      <a class="action secondary" id="openClaude" href="${escapeAttribute(data.claudeUrl)}">Open in Claude Code</a>
      <button class="action" id="copyCommand" type="button">Copy command</button>
      ${boardAction}
    </div>
    <div class="launch-status" id="launchStatus" aria-live="polite"></div>
    <pre class="command"><code>${escapeHtml(data.launchCommand)}</code></pre>
    <details>
      <summary>Package details</summary>
      <div class="card">
        <h3>Workspace</h3>
        <div class="path">${escapeHtml(data.workspacePath)}</div>
        <h3>Goal</h3>
        <div class="path">${escapeHtml(data.relativeGoalPath || data.goalPath)}</div>
      </div>
${sectionCards}
      <p class="note">Turbo contract: register the GoalBuddy board before execution and keep proof discipline visible.</p>
    </details>
  </section>

  <footer>
    <span>Generated by AFK Turbo</span>
    <span>${escapeHtml(basename(data.goalPath))}</span>
  </footer>
</div>

<div class="closing" id="closingOverlay" aria-live="polite" aria-hidden="true">
  <div class="closing-card">
    <h2>Closing this page</h2>
    <span class="closing-count" id="closingCount">3</span>
    <p class="note">If your browser keeps this tab open, you can close it manually.</p>
  </div>
</div>

<script>
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("afk-goal-launch-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
});

const launchStatus = document.getElementById("launchStatus");
const closingOverlay = document.getElementById("closingOverlay");
const closingCount = document.getElementById("closingCount");
const launchCommand = ${JSON.stringify(data.launchCommand)};
const liveGate = ${JSON.stringify(data.live === true)};
let terminalActionStarted = false;

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("copy failed");
}

function setStatus(message) {
  launchStatus.textContent = message;
}

function startCloseCountdown() {
  if (terminalActionStarted) return;
  terminalActionStarted = true;
  closingOverlay.classList.add("active");
  closingOverlay.setAttribute("aria-hidden", "false");
  let remaining = 3;
  closingCount.textContent = String(remaining);
  const timer = setInterval(() => {
    remaining -= 1;
    closingCount.textContent = String(Math.max(remaining, 0));
    if (remaining <= 0) {
      clearInterval(timer);
      window.close();
      closingCount.textContent = "done";
    }
  }, 1000);
}

async function sendAction(action) {
  if (!liveGate) return;
  const response = await fetch("/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error("launch action failed");
}

document.getElementById("copyCommand").addEventListener("click", async () => {
  try {
    await copyText(launchCommand);
    document.getElementById("copyCommand").textContent = "Copied";
    setStatus("Command copied.");
    setTimeout(() => {
      document.getElementById("copyCommand").textContent = "Copy command";
    }, 1400);
  } catch {
    setStatus("Copy failed. Select the command below and copy it manually.");
  }
});

if (liveGate) {
  document.getElementById("runHere").addEventListener("click", async () => {
    try {
      await sendAction("run-current-chat");
      await copyText(launchCommand);
      setStatus("Run request sent to the current agent. Command copied too.");
      startCloseCountdown();
    } catch {
      setStatus("Could not notify the current agent. Command is below.");
    }
  });

  document.getElementById("closeGate").addEventListener("click", async () => {
    try {
      await sendAction("closed");
      setStatus("Launch closed.");
      startCloseCountdown();
    } catch {
      setStatus("Could not notify the current agent.");
    }
  });
}

for (const item of [
  ["openCodex", "delegated-codex"],
  ["openClaude", "delegated-claude-code"],
]) {
  const [id, action] = item;
  const link = document.getElementById(id);
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await copyText(launchCommand);
      await sendAction(action);
      setStatus("Command copied. Opening selected agent.");
      startCloseCountdown();
    } catch {
      setStatus("Opening selected agent. If it does not open, paste the command below into a new agent session.");
    }
    window.location.href = link.href;
  });
}

window.addEventListener("error", (event) => {
  setStatus(event.message || "Something failed on the launch page.");
});
</script>
</body>
</html>
`;
}

function renderSection(section) {
  const items = summarizeMarkdown(section.text, section.fallback);
  return `    <article class="card">
      <h3>${escapeHtml(section.label)}</h3>
      <div class="path">${escapeHtml(section.path)}</div>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(truncate(item, 180))}</li>`).join("\n        ")}
      </ul>
    </article>`;
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
