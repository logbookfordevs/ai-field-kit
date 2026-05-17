const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const reset = useColor ? "\u001B[0m" : "";
const bold = useColor ? "\u001B[1m" : "";

const warmGradient = [
  [246, 178, 107],
  [239, 125, 103],
  [177, 112, 184],
  [91, 141, 239],
] as const;

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
  return `${ansi(246, 178, 107)}◆${reset} ${bold}${value}${reset}`;
}

export function muted(value: string): string {
  return `${ansi(142, 129, 115)}${value}${reset}`;
}

function gradient(value: string): string {
  return [...value]
    .map((char, index) => {
      const colorIndex = Math.min(warmGradient.length - 1, Math.floor((index / Math.max(1, value.length - 1)) * warmGradient.length));
      const color = warmGradient[colorIndex] ?? warmGradient[0];
      return `${ansi(color[0], color[1], color[2])}${char}`;
    })
    .join("") + reset;
}

function ansi(red: number, green: number, blue: number): string {
  if (!useColor) {
    return "";
  }

  return `\u001B[38;2;${red};${green};${blue}m`;
}
