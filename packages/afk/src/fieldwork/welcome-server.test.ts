import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFieldwork } from "./server.js";
import { emptySettings, SettingsStore, validateSettings, type Settings } from "./settings.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

it("persists welcome dismissal across server sessions without losing serialized profile changes", async () => {
  const home = await mkdtemp(join(tmpdir(), "afk-welcome-api-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const store = new SettingsStore(home);
  const settings = emptySettings();
  settings.projects.push({ name: "Demo", path: join(home, "project") });
  settings.favoriteSources.push({ name: "Source", source: "example/source" });
  await store.save(settings);
  const skill = join(home, ".agents/skills/.disabled/example");
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, "SKILL.md"), "---\nname: example\n---\nBody\n");

  const app = await startFieldwork(store);
  cleanups.push(app.close);
  const token = (await (await fetch(app.url)).text()).match(/window.afkToken="([^"]+)"/)?.[1];
  expect(token).toBeTruthy();
  const post = (path: string, body: unknown) => fetch(app.url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-afk-token": token! },
    body: JSON.stringify(body),
  });
  expect((await fetch(app.url + "/api/welcome", { method: "POST", body: "{}" })).status).toBe(403);
  expect((await store.read()).welcomeDismissed).toBeUndefined();

  const responses = await Promise.all([
    post("/api/profile/save", { name: "Example profile", source: "Local skill selection", skills: ["example"] }),
    post("/api/welcome", {}),
  ]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  const saved = await store.read();
  expect(saved.welcomeDismissed).toBe(true);
  expect(saved.profiles).toHaveLength(1);
  expect(saved.profiles[0]?.skills).toEqual(["example"]);
  expect(saved.projects).toEqual(settings.projects);
  expect(saved.favoriteSources).toEqual(settings.favoriteSources);

  const rejectedImport = await post("/api/import", { settings: { ...saved, welcomeDismissed: "true" } });
  expect(rejectedImport.status).toBe(400);
  expect(await store.read()).toEqual(saved);
  await app.close();

  const restarted = await startFieldwork(new SettingsStore(home));
  cleanups.push(restarted.close);
  const newToken = (await (await fetch(restarted.url)).text()).match(/window.afkToken="([^"]+)"/)?.[1];
  const response = await fetch(restarted.url + "/api/state", { headers: { "x-afk-token": newToken! } });
  expect(response.status).toBe(200);
  expect(((await response.json()) as { settings: Settings }).settings).toEqual(saved);
});

it("accepts legacy and boolean welcome state while rejecting invalid imported values", () => {
  expect(validateSettings(emptySettings()).welcomeDismissed).toBeUndefined();
  for (const welcomeDismissed of [true, false]) expect(validateSettings({ ...emptySettings(), welcomeDismissed }).welcomeDismissed).toBe(welcomeDismissed);
  for (const welcomeDismissed of ["true", 1, null, []]) expect(() => validateSettings({ ...emptySettings(), welcomeDismissed })).toThrow("Invalid welcome dismissal state.");
});
