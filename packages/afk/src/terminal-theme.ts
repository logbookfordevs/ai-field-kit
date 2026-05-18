const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export const reset = useColor ? "\u001B[0m" : "";
export const bold = useColor ? "\u001B[1m" : "";

export type Rgb = readonly [red: number, green: number, blue: number];

export const terminalPalette = {
  brass: [214, 167, 86],
  rust: [185, 80, 47],
  sienna: [127, 53, 31],
  harbor: [111, 167, 163],
  deck: [24, 34, 31],
  lantern: [255, 250, 240],
  driftwood: [168, 152, 134],
  ember: [223, 135, 95],
} as const satisfies Record<string, Rgb>;

export const routeGradient = [
  terminalPalette.brass,
  terminalPalette.rust,
  terminalPalette.sienna,
  terminalPalette.harbor,
] as const;

export function paint([red, green, blue]: Rgb, value: string): string {
  if (!useColor) {
    return value;
  }

  return `${ansi(red, green, blue)}${value}${reset}`;
}

export function strong(value: string): string {
  if (!useColor) {
    return value;
  }

  return `${bold}${value}${reset}`;
}

export function ansi(red: number, green: number, blue: number): string {
  if (!useColor) {
    return "";
  }

  return `\u001B[38;2;${red};${green};${blue}m`;
}
