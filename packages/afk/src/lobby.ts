import { select } from "@inquirer/prompts";
import { renderBanner, muted, sectionTitle } from "./brand.js";
import { afkSelectTheme } from "./prompt-ui.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { Runtime } from "./types.js";

export type LobbyChoiceValue = "setup" | "refresh" | "skills" | "mcps" | "utils" | "hooks" | "configure" | "inspect" | "help";

type TtyState = {
  stdin: boolean;
  stdout: boolean;
};

type LobbyChoice = {
  name: string;
  value: LobbyChoiceValue;
  description: string;
};

export const compassLobbyChoices: LobbyChoice[] = [
  {
    name: "Prepare this machine for agent work",
    value: "setup",
    description: "Route: afk setup",
  },
  {
    name: "Refresh manifests",
    value: "refresh",
    description: "Route: afk setup refresh",
  },
  {
    name: "Add or update skills",
    value: "skills",
    description: "Route: afk setup skills",
  },
  {
    name: "Add MCP tools",
    value: "mcps",
    description: "Route: afk setup mcps",
  },
  {
    name: "Install optional utilities",
    value: "utils",
    description: "Route: afk setup utils",
  },
  {
    name: "Add lifecycle hooks",
    value: "hooks",
    description: "Route: afk setup hooks",
  },
  {
    name: "Build or edit a custom field kit",
    value: "configure",
    description: "Route: afk manifests configure",
  },
  {
    name: "Inspect what AFK knows",
    value: "inspect",
    description: "Route: afk manifests show",
  },
  {
    name: "Show command help",
    value: "help",
    description: "Route: afk --help",
  },
];

export function shouldOpenCompassLobby(argv: string[], env: NodeJS.ProcessEnv, tty: TtyState = currentTtyState()): boolean {
  return argv.length === 0 && tty.stdin && tty.stdout && env.CI !== "true" && env.AFK_NO_LOBBY !== "1";
}

export function renderCompassLobbyIntro(): string {
  return [
    renderBanner(),
    sectionTitle("Field check"),
    fieldLine("Mode", "Compass lobby"),
    fieldLine("Route preview", "on"),
    fieldLine("Next step", "Pick an intent; AFK will show the command before it runs."),
    "",
    sectionTitle("Where are we headed?"),
  ].join("\n");
}

export async function selectCompassLobbyRoute(runtime: Runtime): Promise<string[]> {
  runtime.io.stdout(renderCompassLobbyIntro());
  const selected = await select<LobbyChoiceValue>({
    message: "Pick an intent",
    choices: compassLobbyChoices,
    pageSize: compassLobbyChoices.length,
    loop: false,
    theme: afkSelectTheme,
  });
  const route = routeForLobbyChoice(selected);
  runtime.io.stdout(renderRoutePreview(route));
  return route;
}

export function routeForLobbyChoice(value: LobbyChoiceValue): string[] {
  switch (value) {
    case "setup":
      return ["setup"];
    case "refresh":
      return ["setup", "refresh"];
    case "skills":
      return ["setup", "skills"];
    case "mcps":
      return ["setup", "mcps"];
    case "utils":
      return ["setup", "utils"];
    case "hooks":
      return ["setup", "hooks"];
    case "configure":
      return ["manifests", "configure"];
    case "inspect":
      return ["manifests", "show"];
    case "help":
      return ["--help"];
  }
}

function renderRoutePreview(route: string[]): string {
  return [
    "",
    `${paint(terminalPalette.harbor, "Route")} ${bold}afk ${route.join(" ")}${reset}`,
    muted("Handing off now."),
  ].join("\n");
}

function fieldLine(label: string, value: string): string {
  return `  ${paint(terminalPalette.driftwood, label.padEnd(14))} ${paint(terminalPalette.lantern, value)}`;
}

function currentTtyState(): TtyState {
  return {
    stdin: Boolean(process.stdin.isTTY),
    stdout: Boolean(process.stdout.isTTY),
  };
}
