// Fetch Standard port blocking: https://fetch.spec.whatwg.org/#port-blocking
const blockedPorts = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69,
  77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119,
  123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515,
  526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990,
  993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000,
  6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

export function parseUiOptions(argv: string[]): { port: number; background: boolean; open: boolean } {
  let port = 0;
  let background = false;
  let open = true;
  let hasPort = false;
  const args = argv[0] === "ui" ? argv.slice(1) : argv;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--background") { background = true; continue; }
    if (argument === "--no-open") { open = false; continue; }
    if (argument === "--port" || argument?.startsWith("--port=")) {
      const value = argument === "--port" ? args[++index] : argument.slice("--port=".length);
      if (hasPort || !value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error("Provide --port once with an integer from 1 to 65535.");
      if (blockedPorts.has(Number(value))) throw new Error(`Port ${value} is blocked by browsers and HTTP fetch. Choose a web port such as 4310 or 8080.`);
      port = Number(value); hasPort = true; continue;
    }
    throw new Error("Use afk [ui] [--background] [--no-open] [--port <1-65535>].");
  }
  return { port, background, open };
}
