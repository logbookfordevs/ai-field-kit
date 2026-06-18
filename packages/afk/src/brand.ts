import { ansi, bold, paint, reset, routeGradient, terminalPalette } from "./terminal-theme.js";
import type { UpdateNotice } from "./update-check.js";

export function renderBanner(input: {
  showRefreshHint?: boolean;
  updateNotice?: UpdateNotice | null;
} = {}): string {
  const title = [
    "    ___     ________ __",
    "   /   |   / ____/ //_/",
    "  / /| |  / /_  / ,<   ",
    " / ___ | / __/ / /| |  ",
    "/_/  |_|/_/   /_/ |_|  ",
  ];
  const name = "AI FIELD KIT";
  const subtitle = "setup router for agentic dev work";
  const refreshHint = "Missing something new? Run afk refresh to update local manifests.";
  const rule = "─".repeat(54);

  return [
    "",
    gradient(rule),
    ...title.map((line) => `${bold}${gradient(line)}${reset}`),
    "",
    `${bold}${brandText(name)}${reset}`,
    muted(subtitle),
    ...renderUpdateNotice(input.updateNotice),
    ...(input.showRefreshHint ? [muted(refreshHint)] : []),
    gradient(rule),
    "",
  ].join("\n");
}

export function renderSetupOutro(input: {
  dryRun: boolean;
  failed: boolean;
  scopeLabel: string;
  areas: string[];
}): string {
  const title = input.failed ? "AFK setup needs attention" : input.dryRun ? "AFK dry run complete" : "AFK setup complete";
  const body = input.failed
    ? "Some areas failed, but AFK finished the full route and kept the summary above."
    : input.dryRun
      ? "No files changed. The preview above is the exact route AFK would take."
      : "Your field kit is prepared. Restart any agents that cache config before they read the new setup.";
  const rule = "─".repeat(54);

  return [
    "",
    gradient(rule),
    `${bold}${brandText(title)}${reset}`,
    muted(body),
    muted(`Scope: ${input.scopeLabel}`),
    muted(`Areas: ${input.areas.join(", ")}`),
    gradient(rule),
    "",
  ].join("\n");
}

export function sectionTitle(value: string): string {
  return `${paint(terminalPalette.rust, "◆")} ${bold}${value}${reset}`;
}

export function muted(value: string): string {
  return paint(terminalPalette.driftwood, value);
}

function brandText(value: string): string {
  return paint(terminalPalette.brass, value);
}

function renderUpdateNotice(notice: UpdateNotice | null | undefined): string[] {
  if (!notice) {
    return [];
  }

  return [
    "",
    `${paint(terminalPalette.rust, "Update available")} ${muted(`afk ${notice.currentVersion} -> ${notice.latestVersion}`)}`,
    muted(`Run: ${notice.command}`),
  ];
}

function gradient(value: string): string {
  return [...value]
    .map((char, index) => {
      const colorIndex = Math.min(routeGradient.length - 1, Math.floor((index / Math.max(1, value.length - 1)) * routeGradient.length));
      const color = routeGradient[colorIndex] ?? routeGradient[0];
      return `${ansi(color[0], color[1], color[2])}${char}`;
    })
    .join("") + reset;
}
