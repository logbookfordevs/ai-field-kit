import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFieldwork } from "./server.js";
import { emptySettings, SettingsStore } from "./settings.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function fixtureApp() {
  const home = await mkdtemp(join(tmpdir(), "afk-next-app-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const web = join(home, "web");
  await mkdir(join(web, "next/assets"), { recursive: true });
  await writeFile(join(web, "index.html"), "<script>/* AFK_SESSION */</script><p>old app</p>");
  await writeFile(join(web, "next/index.html"), "<script>/* AFK_SESSION */</script><script type=\"module\" src=\"/next/assets/app.js\"></script>");
  await writeFile(join(web, "next/assets/app.js"), "export {};");
  await writeFile(join(web, "next/assets/app.css"), "body{}");
  const store = new SettingsStore(home);
  await store.save(emptySettings());
  const app = await startFieldwork(store, 0, { web });
  cleanups.push(app.close);
  return app;
}

const tokenIn = (html: string): string | undefined => html.match(/window\.afkToken="([^"]+)"/)?.[1];

it("serves the new app at /next/ with this session's token while / keeps the old app", async () => {
  const app = await fixtureApp();

  const next = await fetch(`${app.url}/next/`);
  expect(next.status).toBe(200);
  expect(next.headers.get("content-type")).toBe("text/html");
  const html = await next.text();
  expect(tokenIn(html)).toBe(app.token);
  expect(html).toContain("/next/assets/app.js");

  const old = await (await fetch(app.url)).text();
  expect(old).toContain("old app");
  expect(tokenIn(old)).toBe(app.token);

  const status = await fetch(`${app.url}/api/status`, { headers: { "x-afk-token": tokenIn(html)! } });
  expect(status.status).toBe(200);
});

it("redirects /next to /next/ and serves the built assets with their types", async () => {
  const app = await fixtureApp();

  const bare = await fetch(`${app.url}/next`, { redirect: "manual" });
  expect(bare.status).toBe(308);
  expect(bare.headers.get("location")).toBe("/next/");

  const script = await fetch(`${app.url}/next/assets/app.js`);
  expect(script.headers.get("content-type")).toBe("text/javascript");
  const style = await fetch(`${app.url}/next/assets/app.css`);
  expect(style.headers.get("content-type")).toBe("text/css");
  expect(await (await fetch(`${app.url}/next/missing.js`)).text()).not.toContain("afkToken");
});
