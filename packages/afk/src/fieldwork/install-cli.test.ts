import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installFromUrl, installManifestUrl } from "./install-cli.js";
import { SettingsStore } from "./settings.js";
import { fetchStack, type SkillStack } from "./stacks.js";

const homes: string[] = [];
const manifest: SkillStack = { version: 1, id: "test", name: "Test stack", sources: [
  { name: "One", source: "owner/one", skills: ["review"] },
  { name: "Two", source: "other/two", skills: ["build", "verify"] },
] };
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-manifest-install-")); homes.push(home);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(manifest))));
  return new SettingsStore(home);
}
it("normalizes bare manifest URLs while retaining the HTTPS URL policy", () => {
  expect(installManifestUrl("atlas.logbookfordevs.com/stack.json")).toBe("https://atlas.logbookfordevs.com/stack.json");
  for (const url of ["http://example.com/stack.json", "https://user:pass@example.com/stack.json", "https://example.com/stack.json#fragment"]) expect(() => installManifestUrl(url)).toThrow();
});
it("fetches and installs explicit members across original repositories and saves the stack with its origin without creating a profile", async () => {
  const store = await fixture(), calls: string[][] = [];
  const code = await installFromUrl(["example.com/stack.json", "--agent", "codex", "-g", "--yes"], store, {
    log: () => {}, runner: async (cwd, env, args) => { expect(cwd).toBe(store.home); expect(env.HOME).toBe(store.home); calls.push(args); return 0; },
  });
  expect(code).toBe(0);
  expect(calls).toEqual([
    ["owner/one", "--skill", "review", "-g", "--agent", "codex", "--yes"],
    ["other/two", "--skill", "build", "--skill", "verify", "-g", "--agent", "codex", "--yes"],
  ]);
  const settings = await store.read(); expect(settings.stacks).toEqual([{ manifest, origin: "https://example.com/stack.json" }]); expect(settings.profiles).toEqual([]);
});
it("accepts a project folder without registering it in settings", async () => {
  const store = await fixture();
  const runner = vi.fn(async (cwd: string, _env: NodeJS.ProcessEnv, args: string[]) => { expect(cwd).toBe(store.home); expect(args).not.toContain("-g"); return 0; });
  expect(await installFromUrl(["example.com/stack.json", "-a", "claude-code", "-p", store.home, "-y"], store, { log: () => {}, runner })).toBe(0);
  expect(runner).toHaveBeenCalledTimes(2); expect((await store.read()).projects).toEqual([]);
});
it("reviews the manifest and target before interactive confirmation, and declining executes nothing", async () => {
  const store = await fixture(), output: string[] = [], answers = ["cursor", "project", store.home, "n"];
  const runner = vi.fn(async () => 0);
  const ask = vi.fn(async () => { expect(output.join("\n")).toContain("owner/one"); return answers.shift()!; });
  expect(await installFromUrl(["example.com/stack.json"], store, { interactive: true, ask, log: text => output.push(text), runner })).toBe(0);
  expect(ask).toHaveBeenCalledTimes(4); expect(runner).not.toHaveBeenCalled(); expect((await store.read()).stacks ?? []).toEqual([]);
});
it("reports partial failure and does not start later sources", async () => {
  const store = await fixture(), output: string[] = []; let calls = 0;
  manifest.sources.push({ name: "Three", source: "owner/three", skills: ["three"] });
  try {
    const code = await installFromUrl(["example.com/stack.json", "--agent", "universal", "-g", "--yes"], store, { log: text => output.push(text), runner: async () => ++calls === 1 ? 0 : 7 });
    expect(code).toBe(1); expect(calls).toBe(2); expect((await store.read()).stacks?.[0]?.manifest.id).toBe("test"); expect(output.join("\n")).toContain("1/3 sources completed");
  } finally { manifest.sources.pop(); }
});
it("rejects incomplete automation and conflicting options before fetching or installing", async () => {
  const store = await fixture();
  for (const options of [["--yes"], ["-g", "-p", "."], ["--agent", "unknown"], ["--wat"]]) {
    await expect(installFromUrl(["example.com/stack.json", ...options], store, { log: () => {} })).rejects.toThrow();
  }
  await expect(installFromUrl(["example.com/stack.json", "-g", "--agent", "codex"], store, { interactive: false })).rejects.toThrow(/interactive terminal/);
  expect(fetch).not.toHaveBeenCalled();
});
it("surfaces HTTP, HTML guide, JSON and manifest validation failures without installing", async () => {
  const store = await fixture(), runner = vi.fn(async () => 0);
  for (const [response, message] of [
    [new Response("missing", { status: 404 }), /404/],
    [new Response("<html>guide</html>"), /HTML guide/],
    [new Response("broken JSON"), /valid JSON/],
    [new Response(JSON.stringify({ ...manifest, version: 2 })), /version 1/],
  ] as const) {
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(installFromUrl(["example.com/stack.json", "-g", "--agent", "codex", "-y"], store, { log: () => {}, runner })).rejects.toThrow(message);
  }
  expect(runner).not.toHaveBeenCalled();
});
it("keeps redirects disabled when fetching manifests", async () => {
  await fixture(); await fetchStack("https://example.com/stack.json");
  expect(fetch).toHaveBeenCalledWith("https://example.com/stack.json", expect.objectContaining({ redirect: "error" }));
});

it("replaces a reviewed saved ID without duplicating it and preserves unrelated settings", async () => {
  const store = await fixture(); await store.initialize();
  const settings = await store.read();
  settings.stacks = [{ manifest: { ...manifest, name: "Old selection" }, origin: "https://old.example/stack.json" }];
  settings.projects.push({ name: "Existing", path: store.home });
  await store.save(settings);
  await installFromUrl(["example.com/stack.json", "-a", "codex", "-g", "-y"], store, { log: () => {}, runner: async () => 0 });
  const saved = await store.read();
  expect(saved.stacks).toEqual([{ manifest, origin: "https://example.com/stack.json" }]);
  expect(saved.projects).toEqual(settings.projects);
});
it("rejects a changed saved stack after review before starting installation", async () => {
  const store = await fixture(), runner = vi.fn(async () => 0);
  await expect(installFromUrl(["example.com/stack.json", "-a", "codex", "-g"], store, {
    interactive: true, log: () => {}, runner,
    ask: async () => {
      const settings = await store.read();
      settings.stacks = [{ manifest: { ...manifest, name: "Concurrent edit" } }];
      await store.save(settings);
      return "yes";
    },
  })).rejects.toThrow(/changed since review/);
  expect(runner).not.toHaveBeenCalled();
  expect((await store.read()).stacks?.[0]?.manifest.name).toBe("Concurrent edit");
});
