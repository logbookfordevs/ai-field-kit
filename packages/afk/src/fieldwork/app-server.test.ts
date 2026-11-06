import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFieldwork } from "./server.js";
import { emptySettings, SettingsStore } from "./settings.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function fixtureApp() {
  const home = await mkdtemp(join(tmpdir(), "afk-app-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const web = join(home, "web");
  await mkdir(join(web, "assets"), { recursive: true });
  await writeFile(join(web, "index.html"), "<script>/* AFK_SESSION */</script><script type=\"module\" src=\"/assets/app.js\"></script>");
  await writeFile(join(web, "assets/app.js"), "export {};");
  await writeFile(join(web, "assets/app.css"), "body{}");
  await writeFile(join(web, "assets/font-0.ttf"), "font");
  const store = new SettingsStore(home);
  await store.save(emptySettings());
  const app = await startFieldwork(store, 0, { web });
  cleanups.push(app.close);
  return app;
}

const tokenIn = (html: string): string | undefined => html.match(/window\.afkToken="([^"]+)"/)?.[1];

it("serves the app at / with this session's token, which authorizes the API", async () => {
  const app = await fixtureApp();

  const page = await fetch(app.url);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toBe("text/html");
  const html = await page.text();
  expect(tokenIn(html)).toBe(app.token);
  expect(html).toContain("/assets/app.js");

  expect((await fetch(`${app.url}/api/status`, { headers: { "x-afk-token": tokenIn(html)! } })).status).toBe(200);
  expect((await fetch(`${app.url}/api/status`, { headers: { "x-afk-token": "stale" } })).status).toBe(403);
});

it("serves the built assets and bundled fonts with their types, and no longer serves /next/", async () => {
  const app = await fixtureApp();

  expect((await fetch(`${app.url}/assets/app.js`)).headers.get("content-type")).toBe("text/javascript");
  expect((await fetch(`${app.url}/assets/app.css`)).headers.get("content-type")).toBe("text/css");
  expect((await fetch(`${app.url}/assets/font-0.ttf`)).headers.get("content-type")).toBe("font/ttf");
  const next = await fetch(`${app.url}/next/`, { redirect: "manual" });
  expect(next.status).not.toBe(200);
  expect(await next.text()).not.toContain("afkToken");
});
