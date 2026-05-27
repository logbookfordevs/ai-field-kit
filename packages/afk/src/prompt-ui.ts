import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";

let promptStep = 0;

export const DEFAULT_CHECKED = false;

export const defaultCheckedDetail = DEFAULT_CHECKED
  ? "Everything starts selected. Use space to unselect anything you want to skip."
  : "Nothing starts selected. Use space to choose what you want to include.";

export function resetPromptSteps(): void {
  promptStep = 0;
}

export function renderPromptStep(title: string, detail?: string): string {
  promptStep += 1;
  const step = String(promptStep).padStart(2, "0");
  const lines = [
    "",
    `${chartLine("┌")}   ${badge(`step ${step}`)} ${bold}${title}${reset}`,
  ];

  if (detail) {
    lines.push(`${chartLine("│")}   ${muted(detail)}`);
  }

  return lines.join("\n");
}

export const afkSelectTheme = {
  prefix: {
    idle: sea("◇"),
    done: signal("◆"),
  },
  icon: {
    cursor: brass("◆"),
  },
  style: {
    answer: (text: string) => sea(text),
    message: (text: string) => `${bold}${text}${reset}`,
    description: (text: string) => muted(text),
    highlight: (text: string) => brass(text),
    help: (text: string) => muted(text),
    key: (text: string) => sea(`<${text}>`),
    keysHelpTip: (keys: [key: string, action: string][]) => formatKeys(keys),
  },
} as const;

export const afkCheckboxTheme = {
  prefix: {
    idle: sea("◇"),
    done: signal("◆"),
  },
  icon: {
    checked: brass("■"),
    unchecked: muted("□"),
    cursor: signal("◆ "),
  },
  style: {
    answer: (text: string) => sea(text),
    message: (text: string) => `${bold}${text}${reset}`,
    description: (text: string) => muted(text),
    highlight: (text: string) => brass(text),
    help: (text: string) => muted(text),
    key: (text: string) => sea(`<${text}>`),
    disabledChoice: (text: string) => muted(`- ${text}`),
    renderSelectedChoices: <Value>(selectedChoices: ReadonlyArray<{ short: string }>) => {
      if (selectedChoices.length === 0) {
        return "none selected";
      }

      if (selectedChoices.length <= 3) {
        return selectedChoices.map((choice) => choice.short).join(", ");
      }

      return `${selectedChoices.length} selected`;
    },
    keysHelpTip: (keys: [key: string, action: string][]) => formatKeys(keys),
  },
  helpMode: "always",
} as const;

export const afkPromptTheme = {
  prefix: {
    idle: sea("◇"),
    done: signal("◆"),
  },
  style: {
    answer: (text: string) => sea(text),
    message: (text: string) => `${bold}${text}${reset}`,
    error: (text: string) => ember(`> ${text}`),
    defaultAnswer: (text: string) => muted(`(${text})`),
    help: (text: string) => muted(text),
    highlight: (text: string) => brass(text),
    key: (text: string) => sea(`<${text}>`),
  },
} as const;

function formatKeys(keys: [key: string, action: string][]): string {
  return muted(keys.map(([key, action]) => `${sea(key)} ${action}`).join("  ·  "));
}

function badge(value: string): string {
  return `${signal(" ")}${signal(value)}${signal(" ")}`;
}

function sea(value: string): string {
  return paint(terminalPalette.harbor, value);
}

function brass(value: string): string {
  return paint(terminalPalette.brass, value);
}

function signal(value: string): string {
  return paint(terminalPalette.rust, value);
}

function muted(value: string): string {
  return paint(terminalPalette.driftwood, value);
}

function ember(value: string): string {
  return paint(terminalPalette.ember, value);
}

function chartLine(value: string): string {
  return paint(terminalPalette.sienna, value);
}
