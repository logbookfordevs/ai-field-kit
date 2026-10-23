import { createServer, type IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SettingsStore } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { AppUpdates } from "./app-update.js";
import { operationCatalog } from "./operation-catalog.js";

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  for await (const chunk of request) {
    text += String(chunk);
    if (text.length > 8_000_000) throw new Error("Request is too large.");
  }
  const value: unknown = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.");
  return value as Record<string, unknown>;
}

export async function startFieldwork(store = new SettingsStore(), port = 0): Promise<{ url: string; token: string; close: () => Promise<void> }> {
  let closeApp: (() => Promise<void>) | undefined;
  let shutdown: Promise<void> | undefined;
  let updatingRequested = false;
  await store.initialize();
  const operations = new FieldworkOperations(store);
  const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
  const updates = new AppUpdates(pkg.version);
  const token = randomBytes(32).toString("hex");
  const web = resolve(dirname(fileURLToPath(import.meta.url)), "../../web");
  const server = createServer((request, response) => {
    const handle = async (): Promise<void> => {
      const address = server.address();
      const expectedHost = address && typeof address !== "string" ? `127.0.0.1:${address.port}` : "";
      if (request.headers.host !== expectedHost || (request.headers.origin && request.headers.origin !== `http://${expectedHost}`)) {
        response.writeHead(403); response.end("Untrusted local request."); return;
      }
      const url = new URL(request.url ?? "/", "http://localhost");
      const send = (value: unknown, status = 200): void => {
        response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify(value));
      };
      if (url.pathname.startsWith("/api/")) {
        if (request.headers["x-afk-token"] !== token) { send({ error: "This session is not authorized. Reopen AFK from the CLI." }, 403); return; }
        const operation = url.pathname.slice("/api/".length);
        if (operation === "status" && request.method === "GET") { send({ pid: process.pid, rssBytes: process.memoryUsage.rss(), settingsPath: store.path }); return; }
        if (operation === "app/update-check" && request.method === "GET") { send(await updates.check(url.searchParams.get("refresh") === "1")); return; }
        if (operation === "app/update-state" && request.method === "GET") { send(await updates.state(store.home)); return; }
        if (operation === "app/update" && request.method === "POST") {
          if (updatingRequested) throw new Error("AFK is already updating.");
          updatingRequested = true;
          try {
            await operations.idle();
            send(await updates.start({ home: store.home, settingsPath: store.path, url: `http://${expectedHost}`, token }));
          } finally { updatingRequested = false; }
          return;
        }
        if (operation === "exit" && request.method === "POST") {
          response.once("finish", () => { void closeApp?.().catch(error => console.error(error)); });
          send({ ok: true }); return;
        }
        const isRead = ["state", "rules/state", "bundle/export"].includes(operation);
        if ((request.method !== "POST" && !(request.method === "GET" && isRead)) || !Object.hasOwn(operationCatalog, operation)) {
          send({ error: "Unknown operation." }, 404); return;
        }
        const updateReads = ["state", "rules/state", "bundle/export", "skills/update-state", "skills/install-state", "skills/restore-state", "skills/update-cancel", "skills/install-cancel", "skills/restore-cancel"];
        if (request.method === "POST" && !updateReads.includes(operation) && (updatingRequested || (await updates.state(store.home))?.pending)) throw new Error("AFK is updating. Wait for the app to restart before making changes.");
        const data = request.method === "POST" ? await body(request) : {};
        send(await operations.run(operation, data)); return;
      }
      if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const path = resolve(web, `.${pathname}`);
      if (!path.startsWith(web + sep)) { response.writeHead(404); response.end(); return; }
      let contents: Buffer | string = await readFile(path);
      if (pathname === "/index.html") contents = contents.toString().replace("/* AFK_SESSION */", `window.afkToken=${JSON.stringify(token)};`);
      const mimeTypes: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png" };
      const mime = mimeTypes[extname(pathname)] ?? "application/octet-stream";
      response.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      response.end(contents);
    };
    void handle().catch(error => {
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Operation failed." }));
    });
  });
  await new Promise<void>((accept, reject) => { server.once("error", error => {
    const code = (error as NodeJS.ErrnoException).code;
    reject(code === "EADDRINUSE" ? new Error(`Port ${port} is already in use. Choose another --port or stop the server using it.`) : error);
  }); server.listen(port, "127.0.0.1", accept); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start AFK.");
  closeApp = () => {
    shutdown ??= (async () => {
      await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
      await operations.close();
    })();
    return shutdown;
  };
  return { url: `http://127.0.0.1:${address.port}`, token, close: closeApp };
}
