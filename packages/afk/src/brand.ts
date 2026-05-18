import { ansi, bold, paint, reset, routeGradient, terminalPalette } from "./terminal-theme.js";

export function renderBanner(): string {
  const title = [
    "    ___     ________ __",
    "   /   |   / ____/ //_/",
    "  / /| |  / /_  / ,<   ",
    " / ___ | / __/ / /| |  ",
    "/_/  |_|/_/   /_/ |_|  ",
  ];
  const name = "AI FIELD KIT";
  const subtitle = "setup router for agentic dev work";
  const rule = "─".repeat(54);

  return [
    "",
    gradient(rule),
    ...title.map((line) => `${bold}${gradient(line)}${reset}`),
    "",
    `${bold}${gradient(name)}${reset}`,
    muted(subtitle),
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
    `${bold}${gradient(title)}${reset}`,
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

function gradient(value: string): string {
  return [...value]
    .map((char, index) => {
      const colorIndex = Math.min(routeGradient.length - 1, Math.floor((index / Math.max(1, value.length - 1)) * routeGradient.length));
      const color = routeGradient[colorIndex] ?? routeGradient[0];
      return `${ansi(color[0], color[1], color[2])}${char}`;
    })
    .join("") + reset;
}
