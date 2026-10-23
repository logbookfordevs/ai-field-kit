import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFieldwork } from "./server.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { SourcePreparation } from "./preparation.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

it("returns prepared repository and local descriptions through authenticated discovery before saving", async () => {
  const home = await mkdtemp(join(tmpdir(), "afk-discovery-api-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const store = new SettingsStore(home);
  await store.save(emptySettings());
  const local = join(home, ".agents/skills/.disabled/local");
  await mkdir(local, { recursive: true });
  await writeFile(join(local, "SKILL.md"), "---\ndescription: Local inventory metadata\n---\nBody\n");

  const prepared = join(home, "prepared-source/.agents/skills");
  for (const [name, metadata] of [
    ["deploy", "description: Publishes artifact releases\n"],
    ["guide", "description: >\n  Explains conventions\n  for this workspace\n"],
    ["broken", "description: [invalid\n"],
  ]) {
    const path = join(prepared, name!);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), `---\n${metadata}---\nBody\n`);
  }
  const discover = vi.spyOn(SourcePreparation.prototype, "discover").mockResolvedValue(["deploy", "guide", "broken"]);
  const directory = vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(prepared);
  const paths = vi.spyOn(SourcePreparation.prototype, "paths").mockResolvedValue({ deploy: "agent-skills/releases/deploy", guide: "agent-skills/guide" });
  const app = await startFieldwork(store);
  cleanups.push(app.close);
  const token = (await (await fetch(app.url)).text()).match(/window.afkToken="([^"]+)"/)?.[1];
  expect(token).toBeTruthy();
  const payload = JSON.stringify({ source: "example/repository" });
  const headers = { "Content-Type": "application/json", "x-afk-token": token! };

  expect((await fetch(app.url + "/api/discover", { method: "POST", body: payload })).status).toBe(403);
  expect((await fetch(app.url + "/api/discover", { method: "POST", headers: { ...headers, Origin: "https://untrusted.example" }, body: payload })).status).toBe(403);
  expect(discover).not.toHaveBeenCalled();

  const remote = await fetch(app.url + "/api/discover", { method: "POST", headers, body: payload });
  expect(remote.status).toBe(200);
  expect(await remote.json()).toEqual({
    names: ["deploy", "guide", "broken"],
    descriptions: { deploy: "Publishes artifact releases", guide: "Explains conventions for this workspace", broken: "" },
    paths: { deploy: "agent-skills/releases/deploy", guide: "agent-skills/guide" },
  });
  expect(discover).toHaveBeenCalledExactlyOnceWith("example/repository");
  expect(directory).toHaveBeenCalledExactlyOnceWith("example/repository");
  expect(paths).toHaveBeenCalledExactlyOnceWith("example/repository");

  const localResponse = await fetch(app.url + "/api/discover", { method: "POST", headers, body: JSON.stringify({ local: true }) });
  expect(localResponse.status).toBe(200);
  expect(await localResponse.json()).toEqual({ names: ["local"], descriptions: { local: "Local inventory metadata" } });
  expect(discover).toHaveBeenCalledTimes(1);
  expect(paths).toHaveBeenCalledTimes(1);
  expect((await store.read()).profiles).toEqual([]);

  const settings = await store.read();
  settings.favoriteSources = [{ name: "Release tools", source: "example/repository", skills: ["deploy"] }];
  const saved = await fetch(app.url + "/api/settings", { method: "POST", headers, body: JSON.stringify({ settings }) });
  expect(saved.status).toBe(200);
  expect((await store.read()).favoriteSources).toEqual(settings.favoriteSources);
  expect((await store.read()).profiles).toEqual([]);
  const inventory = await fetch(app.url + "/api/discover", { method: "POST", headers, body: JSON.stringify({ local: true }) });
  expect((await inventory.json()).names).toEqual(["local"]);
  expect(discover).toHaveBeenCalledTimes(1);
});
