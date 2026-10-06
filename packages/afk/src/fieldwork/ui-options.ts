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
      port = Number(value); hasPort = true; continue;
    }
    throw new Error("Use afk [ui] [--background] [--no-open] [--port <1-65535>].");
  }
  return { port, background, open };
}
