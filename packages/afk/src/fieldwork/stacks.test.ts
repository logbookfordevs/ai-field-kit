import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchStack, manifestUrl, stackInstallScript, stackSchema, validateStack, type SkillStack } from "./stacks.js";
import { emptySettings, SettingsStore, validateSettings } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { doctor } from "./doctor.js";

const manifest: SkillStack = { version: 1, id: "studio", name: "Studio", sources: [
  { name: "Video", source: "owner/video", skills: ["render", "review"] },
  { name: "Design", source: "owner/design", skills: ["layout"] },
] };
const homes: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-stacks-")); homes.push(home);
  const store = new SettingsStore(home); await store.save(emptySettings());
  return { home, store, operations: new FieldworkOperations(store) };
}

describe("portable skill stacks", () => {
  it("publishes the exact runtime schema and a valid example", async () => {
    expect(JSON.parse(await readFile(new URL("../../../../docs/schemas/skill-stack.v1.schema.json", import.meta.url), "utf8"))).toEqual(stackSchema);
    expect(validateStack(JSON.parse(await readFile(new URL("../../../../docs/examples/skill-stack.v1.json", import.meta.url), "utf8"))).sources).toHaveLength(2);
  });
  it.each([
    { ...manifest, version: 2 }, { ...manifest, command: "curl | sh" }, { ...manifest, sources: [] },
    { ...manifest, sources: [{ ...manifest.sources[0], skills: ["*"] }] },
    { ...manifest, sources: [{ ...manifest.sources[0], skills: ["review", "review"] }] },
    { ...manifest, sources: [{ ...manifest.sources[0], source: "--all" }] },
    { ...manifest, sources: [{ ...manifest.sources[0], install: "sh" }] },
  ])("rejects incompatible or executable manifests", input => { expect(() => validateStack(input)).toThrow(); });
  it("keeps legacy bookmarks intact and rejects invalid or duplicate stack definitions", () => {
    const settings = emptySettings(); settings.favoriteSources = [{ name: "All", source: "owner/all" }, { name: "Some", source: "owner/some", skills: ["review"] }];
    expect(validateSettings(settings)).toEqual(settings);
    expect(validateSettings({ ...settings, stacks: [{ manifest }] }).favoriteSources).toEqual(settings.favoriteSources);
    expect(() => validateSettings({ ...settings, stacks: [{ manifest }, { manifest }] })).toThrow(/unique/);
    expect(() => validateSettings({ ...settings, stacks: [{ manifest, origin: "http://example.com/stack.json" }] })).toThrow();
  });
  it("reviews and saves JSON without preparing skills or creating profiles, then rejects stale replacement", async () => {
    const { home, store, operations } = await fixture();
    try {
      const preview = await operations.run("stack/preview", { manifest: JSON.stringify(manifest) }) as { stack: unknown; expected: unknown };
      expect((await store.read()).stacks).toBeUndefined();
      await operations.run("stack/save", preview);
      expect((await store.read()).stacks).toEqual([{ manifest }]);
      expect((await store.read()).profiles).toEqual([]);
      expect(await readdir(home)).toEqual([".afk"]);
      await expect(operations.run("stack/save", preview)).rejects.toThrow(/changed/);
      await operations.run("stack/remove", { id: manifest.id, expected: { manifest } });
      expect((await store.read()).stacks).toEqual([]);
    } finally { await operations.close(); }
  });
  it("fetches remote JSON into the same review and refuses changed identity on refresh", async () => {
    const { store, operations } = await fixture();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(manifest))); vi.stubGlobal("fetch", fetcher);
    try {
      const preview = await operations.run("stack/preview", { origin: "https://example.com/stack.json" }) as { stack: unknown; expected: unknown };
      expect(preview.stack).toEqual({ manifest, origin: "https://example.com/stack.json" });
      expect((await store.read()).stacks).toBeUndefined();
      await operations.run("stack/save", preview);
      fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...manifest, name: "Updated", sources: [manifest.sources[1]] })));
      const refreshed = await operations.run("stack/preview", { origin: "https://example.com/stack.json", id: manifest.id });
      expect((await store.read()).stacks?.[0]?.manifest.name).toBe("Studio");
      expect(refreshed).toMatchObject({ expected: { manifest }, stack: { manifest: { name: "Updated" } } });
      await expect(operations.run("stack/preview", { origin: "https://example.com/stack.json", id: "other" })).rejects.toThrow(/ID changed/);
      await expect(operations.run("stack/preview", { origin: "https://example.com/stack.json", manifest })).rejects.toThrow(/not both/);
    } finally { await operations.close(); }
  });
  it("rejects failed, invalid, oversized and non-HTTPS remote documents", async () => {
    for (const url of ["http://example.com/a", "https://user:secret@example.com/a", "file:///a"]) expect(() => manifestUrl(url)).toThrow();
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 })); await expect(fetchStack("https://example.com/a")).rejects.toThrow(/404/);
    vi.stubGlobal("fetch", async () => new Response("<html>")); await expect(fetchStack("https://example.com/a")).rejects.toThrow();
    vi.stubGlobal("fetch", async () => new Response(" ".repeat(1_000_001))); await expect(fetchStack("https://example.com/a")).rejects.toThrow(/1 MB/);
  });
  it("quotes original sources and preserves explicit selections and project/agent options", () => {
    const stack = { ...manifest, sources: [{ name: "Quoted", source: "owner/repo'$(touch ignored)", skills: ["render"] }, manifest.sources[1]!] };
    const script = stackInstallScript(stack, "Demo", "claude-code", [{ name: "Demo", path: "~/Demo Studio" }]);
    expect(script).toContain('cd -- "$HOME"/\'Demo Studio\' && npx skills add');
    expect(script).toContain("'owner/repo'\"'\"'$(touch ignored)' --skill 'render' --agent 'claude-code'");
    expect(script).not.toContain("--skill '*'"); expect(script).not.toContain(" -g");
    expect(script.indexOf("render")).toBeLessThan(script.indexOf("layout"));
    expect(stackInstallScript(manifest, "Global", "interactive", [])).toContain("--skill 'review' -g)");
    expect(() => stackInstallScript(manifest, "Missing", "interactive", [])).toThrow();
  });
  it("executes copied shell syntax as sequential literal arguments with a harmless CLI fixture", async () => {
    const { home, operations } = await fixture();
    const bin = join(home, "bin"), log = join(home, "calls.jsonl");
    await mkdir(bin);
    await writeFile(join(bin, "npx"), `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.STACK_CALLS,JSON.stringify(process.argv.slice(2))+'\\n');\n`, { mode: 0o700 });
    const tricky = { ...manifest, sources: [{ name: "Literal", source: "owner/repo'$(touch should-not-exist)", skills: ["review"] }, manifest.sources[1]!] };
    const path = join(home, "install.sh");
    await writeFile(path, stackInstallScript(tricky, "Global", "codex", []));
    await promisify(execFile)("/bin/sh", [path], { cwd: home, env: { ...process.env, PATH: bin + ":" + process.env.PATH, STACK_CALLS: log } });
    const calls = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line) as string[]);
    expect(calls).toEqual([
      ["skills", "add", "owner/repo'$(touch should-not-exist)", "--skill", "review", "-g", "--agent", "codex"],
      ["skills", "add", "owner/design", "--skill", "layout", "-g", "--agent", "codex"],
    ]);
    expect(await readdir(home)).not.toContain("should-not-exist");
    await operations.close();
  });
  it("doctor checks saved manifests without fetching or requiring installed skills", async () => {
    const { store, operations } = await fixture();
    const settings = emptySettings(); settings.stacks = [{ manifest }]; await store.save(settings);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await doctor(store)).toMatchObject({ ok: true, checked: { stacks: 1 }, issues: [] });
    expect(fetcher).not.toHaveBeenCalled();
    settings.stacks[0]!.manifest.sources[1]!.skills = ["review"]; await store.save(settings);
    expect((await doctor(store)).issues).toContainEqual(expect.objectContaining({ code: "stack_skill_collision", severity: "warning" }));
    await operations.close();
  });
});
