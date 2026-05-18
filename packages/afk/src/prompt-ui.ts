const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const reset = useColor ? "\u001B[0m" : "";
const bold = useColor ? "\u001B[1m" : "";

let promptStep = 0;

export function resetPromptSteps(): void {
  promptStep = 0;
}

export function renderPromptStep(title: string, detail?: string): string {
  promptStep += 1;
  const step = String(promptStep).padStart(2, "0");
  const lines = [
    "",
    `${warm("┌")}   ${badge(`step ${step}`)} ${bold}${title}${reset}`,
  ];

  if (detail) {
    lines.push(`${warm("│")}   ${muted(detail)}`);
  }

  return lines.join("\n");
}

export const afkSelectTheme = {
  prefix: {
    idle: cool("◇"),
    done: success("◆"),
  },
  icon: {
    cursor: cool("◆"),
  },
  style: {
    answer: (text: string) => success(text),
    message: (text: string) => `${bold}${text}${reset}`,
    description: (text: string) => muted(text),
    highlight: (text: string) => cool(text),
    help: (text: string) => muted(text),
    key: (text: string) => cool(`<${text}>`),
    keysHelpTip: (keys: [key: string, action: string][]) => formatKeys(keys),
  },
} as const;

export const afkCheckboxTheme = {
  prefix: {
    idle: cool("◇"),
    done: success("◆"),
  },
  icon: {
    checked: success("■"),
    unchecked: muted("□"),
    cursor: cool("◆ "),
  },
  style: {
    answer: (text: string) => success(text),
    message: (text: string) => `${bold}${text}${reset}`,
    description: (text: string) => muted(text),
    highlight: (text: string) => cool(text),
    help: (text: string) => muted(text),
    key: (text: string) => cool(`<${text}>`),
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
    idle: cool("◇"),
    done: success("◆"),
  },
  style: {
    answer: (text: string) => success(text),
    message: (text: string) => `${bold}${text}${reset}`,
    error: (text: string) => color(239, 125, 103, `> ${text}`),
    defaultAnswer: (text: string) => muted(`(${text})`),
    help: (text: string) => muted(text),
    highlight: (text: string) => cool(text),
    key: (text: string) => cool(`<${text}>`),
  },
} as const;

function formatKeys(keys: [key: string, action: string][]): string {
  return muted(keys.map(([key, action]) => `${cool(key)} ${action}`).join("  ·  "));
}

function badge(value: string): string {
  return `${cool(" ")}${cool(value)}${cool(" ")}`;
}

function success(value: string): string {
  return color(132, 181, 135, value);
}

function cool(value: string): string {
  return color(91, 141, 239, value);
}

function warm(value: string): string {
  return color(246, 178, 107, value);
}

function muted(value: string): string {
  return color(142, 129, 115, value);
}

function color(red: number, green: number, blue: number, value: string): string {
  if (!useColor) {
    return value;
  }

  return `\u001B[38;2;${red};${green};${blue}m${value}${reset}`;
}
