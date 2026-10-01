import { createServer, type IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { SettingsStore, validateSettings } from "./settings.js";
import { setInvocation } from "./invocation.js";
import { SourcePreparation } from "./preparation.js";
import { randomUUID } from "node:crypto";
import { skillName } from "./settings.js";
import { SkillLibrary } from "./skills.js";

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  for await (const chunk of request) {
    text += String(chunk);
    if (text.length > 1_000_000) throw new Error("Request is too large.");
  }
  const value: unknown = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.");
  return value as Record<string, unknown>;
}

export function runCommand(command: string, args: string[], cwd: string): Promise<{ output: string; code: number }> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer): void => { output = (output + chunk.toString()).slice(-100_000); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", code => accept({ output, code: code ?? 1 }));
  });
}

export async function startFieldwork(store = new SettingsStore(), port = 0): Promise<{ url: string; close: () => Promise<void> }> {
  let closeApp: (() => Promise<void>) | undefined;
  let shutdown: Promise<void> | undefined;
  await store.initialize();
  const library = new SkillLibrary(store);
  const preparation = new SourcePreparation();
  const token = randomBytes(32).toString("hex");
  const web = resolve(dirname(fileURLToPath(import.meta.url)), "../../web");
  let mutations = Promise.resolve();
  const toolRuns: Record<number, { pending: boolean; output: string; code?: number }> = {};
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
        const settings = await store.read();
        if (request.method === "GET" && url.pathname === "/api/state") {
          const inventories: Record<string, Awaited<ReturnType<SkillLibrary["inventory"]>>> = {};
          for (const scope of ["Global", ...settings.projects.map(p => p.name)]) inventories[scope] = await library.inventory(settings, scope);
          for (const profile of settings.profiles) {
            if (!profile.ready) continue;
            try { for (const name of profile.skills) await library.locate(settings, name); }
            catch { profile.ready = false; }
          }
          send({ settings, settingsPath: store.path, home: store.home, inventories, toolRuns }); return;
        }
        if (request.method !== "POST") { send({ error: "Unknown operation." }, 404); return; }
        const data = await body(request);
        if (url.pathname === "/api/exit") {
          response.once("finish", () => { void closeApp?.().catch(error => console.error(error)); });
          send({ ok: true }); return;
        }
        if (url.pathname === "/api/settings") {
          const updated = validateSettings(data.settings);
          const definitions = (profiles: typeof settings.profiles): string => JSON.stringify(profiles.map(({ ready: _ready, ...profile }) => profile));
          if (definitions(updated.profiles) !== definitions(settings.profiles) || JSON.stringify(updated.managedLinks) !== JSON.stringify(settings.managedLinks)) throw new Error("Profile changes must use profile operations.");
          updated.profiles = settings.profiles;
          updated.independentSkills = settings.independentSkills;
          await store.save(updated); send({ ok: true }); return;
        }
        if (url.pathname === "/api/discover") {
          const names = data.local === true ? (await library.inventory(settings, "Global")).map(s => s.name) : await preparation.discover(String(data.source));
          send({ names }); return;
        }
        if (url.pathname === "/api/profile/save") {
          const names = data.skills;
          if (!Array.isArray(names) || !names.length || !names.every(skillName) || typeof data.name !== "string" || !data.name.trim()) throw new Error("Name the profile and choose its members.");
          const source = String(data.source || "Local skill selection");
          const existing = settings.profiles.find(p => p.id === data.id);
          if (existing?.enabled.length) throw new Error("Disable every scope before editing members.");
          if (source === "Local skill selection") {
            for (const name of names) await library.locate(settings, name);
          } else {
            await library.storePrepared(settings, await preparation.directory(source), names);
          }
          const profile = { id: existing?.id ?? "profile-" + randomUUID(), name: data.name.trim(), source, skills: names, enabled: [], ready: true };
          settings.profiles = [...settings.profiles.filter(p => p.id !== profile.id), profile];
          await store.save(settings); send({ ok: true }); return;
        }
        if (url.pathname === "/api/profile/remove") {
          const profile = settings.profiles.find(p => p.id === data.id);
          if (!profile || profile.enabled.length) throw new Error("Disable every scope before removing this profile.");
          settings.profiles = settings.profiles.filter(p => p.id !== data.id);
          await store.save(settings); send({ ok: true }); return;
        }
        if (url.pathname === "/api/project/save") {
          const previous = settings.projects.find(p => p.name === data.previous);
          if (typeof data.name !== "string" || typeof data.path !== "string") throw new Error("Choose a project name and folder.");
          if (previous && previous.path !== data.path && settings.profiles.some(p => p.enabled.includes(previous.name))) throw new Error("Disable profiles before changing this project's folder.");
          if (previous) {
            for (const profile of settings.profiles) profile.enabled = profile.enabled.map(scope => scope === previous.name ? String(data.name) : scope);
            for (const key of Object.keys(settings.preferences)) {
              if (key.startsWith(previous.name + "|")) { settings.preferences[String(data.name) + key.slice(previous.name.length)] = settings.preferences[key]!; delete settings.preferences[key]; }
            }
            previous.name = data.name; previous.path = data.path;
          } else settings.projects.push({ name: data.name, path: data.path });
          await store.save(settings); send({ ok: true }); return;
        }
        if (url.pathname === "/api/location") { await store.relocate(String(data.path)); send({ ok: true }); return; }
        if (url.pathname === "/api/folders") {
          const path = resolve(String(data.path ?? store.home));
          if (!(await stat(path)).isDirectory()) throw new Error("Choose a folder.");
          const entries = await readdir(path, { withFileTypes: true });
          send({ path, parent: dirname(path), folders: entries.filter(e => e.isDirectory() && !e.name.startsWith(".")).map(e => e.name).sort() }); return;
        }
        if (url.pathname === "/api/activation") {
          await library.activate(settings, String(data.id), String(data.scope), data.enabled === true); send({ ok: true }); return;
        }
        if (url.pathname === "/api/invocation") {
          await setInvocation(store, settings, String(data.name), String(data.scope), String(data.mode)); send({ ok: true }); return;
        }
        if (url.pathname === "/api/import") {
          if (settings.profiles.some(p => p.enabled.length)) throw new Error("Disable current profiles before replacing the configuration.");
          const imported = validateSettings(data.settings);
          imported.managedLinks = {};
          imported.independentSkills = {};
          imported.profiles = imported.profiles.map(p => ({ ...p, enabled: [], ready: false }));
          await store.save(imported); send({ ok: true }); return;
        }
        if (url.pathname === "/api/skill/toggle") {
          await library.toggle(settings, String(data.name), String(data.scope)); send({ ok: true }); return;
        }
        if (url.pathname === "/api/skill/read") {
          const path = await library.locate(settings, String(data.name), String(data.scope));
          const base = await realpath(path);
          const file = typeof data.file === "string" ? data.file : "SKILL.md";
          const target = await realpath(resolve(base, file));
          if (!target.startsWith(base + sep)) throw new Error("Choose a file inside the skill folder.");
          const files: string[] = [];
          const walk = async (directory: string, prefix: string): Promise<void> => {
            for (const entry of await readdir(directory, { withFileTypes: true })) {
              if (entry.name.startsWith(".") || files.length >= 200) continue;
              const relative = prefix + entry.name;
              if (entry.isDirectory()) await walk(join(directory, entry.name), relative + "/");
              else if (entry.isFile()) files.push(relative);
            }
          };
          await walk(base, "");
          if ((await stat(target)).size > 500_000) throw new Error("This file is too large to preview. Open it from the displayed skill folder.");
          send({ path, files, file, content: await readFile(target, "utf8") }); return;
        }
        if (url.pathname === "/api/profile/read") { send({ content: await library.readGroup(settings, String(data.id)) }); return; }
        if (url.pathname === "/api/tool/run") {
          const tool = settings.tools.find(t => t.id === data.id);
          if (!tool) throw new Error("Tool not found.");
          if (toolRuns[tool.id]?.pending) throw new Error("This tool command is already running. Reopen its results to follow it.");
          const command = data.update === true ? tool.update || tool.install : tool.install;
          toolRuns[tool.id] = { pending: true, output: "Running…" };
          try {
            const result = await runCommand(process.env.SHELL || "/bin/sh", ["-c", command], store.home);
            toolRuns[tool.id] = { pending: false, ...result }; send(result);
          } catch (error) {
            toolRuns[tool.id] = { pending: false, code: 1, output: error instanceof Error ? error.message : "Command could not start." }; throw error;
          }
          return;
        }
        send({ error: "Unknown operation." }, 404); return;
      }
      if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const path = resolve(web, `.${pathname}`);
      if (!path.startsWith(web + sep)) { response.writeHead(404); response.end(); return; }
      let contents: Buffer | string = await readFile(path);
      if (pathname === "/index.html") contents = contents.toString().replace("/* AFK_SESSION */", `window.afkToken=${JSON.stringify(token)};`);
      const mime = pathname.endsWith(".html") ? "text/html" : pathname.endsWith(".js") ? "text/javascript" : pathname.endsWith(".ttf") ? "font/ttf" : "application/octet-stream";
      response.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      response.end(contents);
    };
    const changesSettings = request.method === "POST" && request.url !== "/api/tool/run";
    const dispatch = changesSettings ? mutations.then(handle) : handle();
    if (changesSettings) mutations = dispatch.catch(() => undefined);
    void dispatch.catch(error => {
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Operation failed." }));
    });
  });
  await new Promise<void>((accept, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", accept); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start AFK.");
  closeApp = () => {
    shutdown ??= (async () => {
      await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
      await preparation.close();
    })();
    return shutdown;
  };
  return { url: `http://127.0.0.1:${address.port}`, close: closeApp };
}
