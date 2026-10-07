import { FieldworkOperations } from "./operations.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { access, mkdtemp, mkdir, readFile, readlink, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { runFieldwork } from "./cli.js";
import { emptySettings, SettingsStore, type Settings } from "./settings.js";
import type { RulesPreview, RulesState, RulesSyncResult } from "./rules.js";

const homes: string[] = [];
const stdout: string[] = [];
const stderr: string[] = [];

beforeEach(() => {
  vi.stubEnv("AFK_SETTINGS", undefined);
  vi.spyOn(console, "log").mockImplementation((value: unknown) => { stdout.push(String(value)); });
  vi.spyOn(console, "error").mockImplementation((value: unknown) => { stderr.push(String(value)); });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  stdout.length = 0;
  stderr.length = 0;
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })));
});

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-cli-"));
  homes.push(home);
  const store = new SettingsStore(home);
  await store.save(emptySettings());
  return { home, store };
}

async function command(store: SettingsStore, argv: string[]) {
  stdout.length = 0;
  stderr.length = 0;
  const code = await runFieldwork(argv, store);
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

async function manage(store: SettingsStore, operation: string, input?: unknown) {
  const argv = ["manage", operation];
  if (input !== undefined) {
    const path = join(store.home, "operation-input.json");
    await writeFile(path, JSON.stringify(input));
    argv.push("--input", path);
  }
  return command(store, argv);
}

function json<T>(text: string): T {
  return JSON.parse(text) as T;
}

function expectFailure(result: { code: number; stdout: string; stderr: string }) {
  expect(result.code).not.toBe(0);
  expect(result.stdout).toBe("");
  expect(json<{ ok: boolean; error: string }>(result.stderr)).toEqual({ ok: false, error: expect.any(String) });
}

describe("AFK agent CLI", () => {
  it("locates the bundled guide without reading or creating settings", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-guide-"));
    homes.push(home);
    const store = new SettingsStore(home);
    const guide = await command(store, ["guide"]);
    expect(guide.code).toBe(0);
    expect(guide.stderr).toBe("");
    expect(isAbsolute(guide.stdout)).toBe(true);
    expect(guide.stdout.endsWith(join("skills", "afk-cli", "SKILL.md"))).toBe(true);
    await expect(access(store.path)).rejects.toMatchObject({ code: "ENOENT" });

    await mkdir(dirname(store.path), { recursive: true });
    await writeFile(store.path, "{broken");
    expect(await command(store, ["guide"])).toEqual(guide);
    expectFailure(await command(store, ["guide", "extra"]));
    expect(await readFile(store.path, "utf8")).toBe("{broken");
  });

  it("describes operations and configuration schema even when settings need repair", async () => {
    const { store } = await fixture();
    await writeFile(store.path, "{broken");
    const before = await readFile(store.path, "utf8");
    const catalog = await command(store, ["manage", "describe"]);
    expect(catalog.code).toBe(0);
    const descriptions = json<{ operations: { operation: string; input: Record<string, string> }[] }>(catalog.stdout);
    expect(descriptions.operations.map(entry => entry.operation)).toEqual(expect.arrayContaining(["state", "profile/save", "activation", "skill/availability", "rules/preview", "rules/sync", "tool/run"]));
    const sync = await command(store, ["manage", "describe", "rules/sync"]);
    expect(sync.code).toBe(0);
    expect(json(sync.stdout)).toMatchObject({ operation: "rules/sync", input: { ids: expect.any(String), preview: expect.any(String) } });
    const schema = await command(store, ["settings", "schema"]);
    expect(schema.code).toBe(0);
    expect(json(schema.stdout)).toMatchObject({ type: "object", properties: { version: { const: 1 }, favoriteSources: { type: "array" }, tools: { type: "array" } } });
    expectFailure(await command(store, ["manage", "describe", "missing-operation"]));
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("validates configuration files without importing or mutating them", async () => {
    const { home, store } = await fixture();
    const before = await readFile(store.path, "utf8");
    const validPath = join(home, "valid.json");
    const valid = emptySettings();
    valid.favoriteSources = [{ name: "Selected", source: "owner/toolkit", skills: ["review"] }];
    await writeFile(validPath, JSON.stringify(valid));
    const validBefore = await readFile(validPath, "utf8");
    const validated = await command(store, ["settings", "validate", validPath]);
    expect(validated.code).toBe(0);
    expect(json(validated.stdout)).toEqual({ ok: true, path: validPath });

    const invalidPath = join(home, "invalid.json");
    await writeFile(invalidPath, JSON.stringify({ ...valid, favoriteSources: [{ name: "Broken", source: "owner/toolkit", skills: [] }] }));
    const invalidBefore = await readFile(invalidPath, "utf8");
    expectFailure(await command(store, ["settings", "validate", invalidPath]));
    expect(await readFile(store.path, "utf8")).toBe(before);
    expect(await readFile(validPath, "utf8")).toBe(validBefore);
    expect(await readFile(invalidPath, "utf8")).toBe(invalidBefore);
  });

  it("reads direct configuration edits through settings, state, and doctor", async () => {
    const { home, store } = await fixture();
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "Selected", source: "owner/toolkit", skills: ["review", "render"] }];
    settings.tools = [{ id: 1, name: "Example", install: "printf example", update: "" }];
    await writeFile(store.path, JSON.stringify(settings));
    const before = await readFile(store.path, "utf8");

    expect((await command(store, ["settings", "path"])).stdout).toBe(store.path);
    const shown = await command(store, ["settings", "show"]);
    expect(shown.code).toBe(0);
    expect(json<Settings>(shown.stdout)).toEqual(settings);
    const state = await manage(store, "state");
    expect(state.code).toBe(0);
    expect(json(state.stdout)).toMatchObject({ settings, settingsPath: store.path, home });
    const doctor = await command(store, ["doctor", "--json"]);
    expect(doctor.code).toBe(0);
    expect(json(doctor.stdout)).toMatchObject({ ok: true, settingsPath: store.path, issues: [] });
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("exports settings without overwriting an existing destination", async () => {
    const { home, store } = await fixture();
    const path = join(home, "export.json");
    const before = await readFile(store.path, "utf8");
    expect((await command(store, ["settings", "export", path])).code).toBe(0);
    expect(await readFile(path, "utf8")).toBe(before);
    await writeFile(path, "Existing user file\n");
    expectFailure(await command(store, ["settings", "export", path]));
    expect(await readFile(path, "utf8")).toBe("Existing user file\n");
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("rejects missing or malformed location inputs before creating files or a location pointer", async () => {
    const { home, store } = await fixture();
    const originalPath = store.path;
    const before = await readFile(originalPath, "utf8");
    for (const input of [undefined, {}, { path: "" }]) {
      expectFailure(await manage(store, "location", input));
      expect(store.path).toBe(originalPath);
      expect(await readFile(originalPath, "utf8")).toBe(before);
      await expect(access(store.pointer)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readdir(dirname(originalPath))).toEqual(["settings.json"]);
    }
    const destination = join(home, "new-workspace");
    expectFailure(await manage(store, "workspace", { mode: ["select"], folder: destination }));
    expect(store.path).toBe(originalPath);
    expect(await readFile(originalPath, "utf8")).toBe(before);
    await expect(access(store.pointer)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates and reads a local profile and guards active definitions", async () => {
    const { home, store } = await fixture();
    const skill = join(home, ".agents/skills/.disabled/render");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\nname: render\ndescription: Render fixture\n---\nFixture instruction\n");
    const project = join(home, "project");
    await mkdir(project);
    expect((await manage(store, "project/save", { name: "Demo", path: project })).code).toBe(0);
    const discovery = await manage(store, "discover", { local: true });
    expect(json(discovery.stdout)).toMatchObject({ names: ["render"], descriptions: { render: "Render fixture" } });
    const definition = { name: "Video", source: "Local skill selection", skills: ["render"] };
    expect((await manage(store, "profile/save", definition)).code).toBe(0);
    const profile = (await store.read()).profiles[0]!;
    expect(profile).toMatchObject({ ...definition, ready: true, enabled: [] });
    expect(json<{ content: string }>((await manage(store, "profile/read", { id: profile.id })).stdout).content).toContain("Fixture instruction");
    expect((await command(store, ["profiles", "use", profile.id])).stdout).toContain("Fixture instruction");
    expect((await command(store, ["skills", "get", "render"])).stdout).toContain("Fixture instruction");
    expect((await store.read()).profiles[0]?.enabled).toEqual([]);

    expect((await manage(store, "activation", { id: profile.id, scope: "Demo", enabled: true })).code).toBe(0);
    expect(await readlink(join(project, ".agents/skills/render"))).toBe(skill);
    const activated = await readFile(store.path, "utf8");
    expectFailure(await manage(store, "activation", { id: profile.id, scope: "Demo" }));
    expectFailure(await manage(store, "profile/save", { ...definition, id: profile.id, name: "Changed" }));
    expectFailure(await manage(store, "profile/remove", { id: profile.id }));
    expectFailure(await manage(store, "import", { settings: emptySettings() }));
    expect(await readFile(store.path, "utf8")).toBe(activated);
    expect((await command(store, ["profiles", "disable", profile.id, "Demo"])).code).toBe(0);
    expect((await manage(store, "profile/remove", { id: profile.id })).code).toBe(0);
    expect((await store.read()).profiles).toEqual([]);
    expect(await readFile(join(skill, "SKILL.md"), "utf8")).toContain("Fixture instruction");
  });

  it("requires a rules preview and rejects stale reviews while preserving surrounding text", async () => {
    const { home, store } = await fixture();
    const files = [
      { path: "AGENTS.md", content: "Read [details](references/details.md).\n" },
      { path: "references/details.md", content: "Fixture details\n" },
    ];
    const saved = await manage(store, "rules/save", { files });
    expect(saved.code).toBe(0);
    const state = json<RulesState>(saved.stdout);
    const destination = state.destinations.find(entry => entry.kind === "codex")!;
    await mkdir(dirname(destination.path), { recursive: true });
    await writeFile(destination.path, "User instructions\n");
    expectFailure(await manage(store, "rules/sync", { ids: [destination.id] }));
    expect(await readFile(destination.path, "utf8")).toBe("User instructions\n");
    const preview = json<RulesPreview>((await manage(store, "rules/preview", { ids: [destination.id] })).stdout);
    await writeFile(destination.path, "User instructions changed after review\n");
    expectFailure(await manage(store, "rules/sync", { ids: [destination.id], preview }));
    expect(await readFile(destination.path, "utf8")).toBe("User instructions changed after review\n");
    expect(Object.keys((await store.read()).agentRules?.receipts ?? {})).toEqual([]);
    const fresh = json<RulesPreview>((await manage(store, "rules/preview", { ids: [destination.id] })).stdout);
    const synced = await manage(store, "rules/sync", { ids: [destination.id], preview: fresh });
    expect(synced.code).toBe(0);
    expect(json<RulesSyncResult>(synced.stdout).settings.agentRules?.receipts).toHaveProperty(destination.id);
    const content = await readFile(destination.path, "utf8");
    expect(content).toContain("User instructions changed after review\n");
    expect(content).toContain("<!-- AFK:RULES:START -->");
    const reference = join(home, ".codex/afk-rules", destination.id, "references/details.md");
    expect(await readFile(reference, "utf8")).toBe("Fixture details\n");
    const syncedSettings = await readFile(store.path, "utf8");
    expectFailure(await manage(store, "rules/disconnect", { id: destination.id, clean: "true" }));
    expect(await readFile(store.path, "utf8")).toBe(syncedSettings);
    expect(await readFile(destination.path, "utf8")).toBe(content);
    expect(await readFile(reference, "utf8")).toBe("Fixture details\n");
  });

  it("sets individual availability idempotently without toggling it on retries", async () => {
    const { home, store } = await fixture();
    const skill = join(home, ".agents/skills/.disabled/review");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\nname: review\ndescription: Review fixture\n---\nFixture instruction\n");
    const enable = { name: "review", scope: "Global", enabled: true };
    expect((await manage(store, "skill/availability", enable)).code).toBe(0);
    const enabledSettings = await readFile(store.path, "utf8");
    expectFailure(await manage(store, "skill/availability", { ...enable, enabled: "false" }));
    expect((await manage(store, "skill/availability", enable)).code).toBe(0);
    expect(await readFile(store.path, "utf8")).toBe(enabledSettings);
    const state = json<{ inventories: { Global: { name: string; available: boolean }[] } }>((await manage(store, "state")).stdout);
    expect(state.inventories.Global).toMatchObject([{ name: "review", available: true }]);
    const disable = { ...enable, enabled: false };
    expect((await manage(store, "skill/availability", disable)).code).toBe(0);
    const disabledSettings = await readFile(store.path, "utf8");
    expect((await manage(store, "skill/availability", disable)).code).toBe(0);
    expect(await readFile(store.path, "utf8")).toBe(disabledSettings);
    expect(await readFile(join(skill, "SKILL.md"), "utf8")).toContain("Fixture instruction");
  });

  it("runs only saved tool commands and reports update fallback output and exit status", async () => {
    vi.stubEnv("SHELL", "/bin/sh");
    const { store } = await fixture();
    const settings = emptySettings();
    settings.tools = [{ id: 9, name: "Fixture", install: "printf 'fixture-output'; exit 7", update: "" }];
    await store.save(settings);
    const before = await readFile(store.path, "utf8");
    const result = await manage(store, "tool/run", { id: 9, update: true });
    expect(result.code).toBe(7);
    expect(json(result.stdout)).toEqual({ output: "fixture-output", code: 7 });
    expectFailure(await manage(store, "tool/run", { id: 10, command: "printf unsaved-command" }));
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("rejects a non-boolean tool update choice before either saved command executes", async () => {
    vi.stubEnv("SHELL", "/bin/sh");
    const { home, store } = await fixture();
    const settings = emptySettings();
    settings.tools = [{ id: 9, name: "Fixture", install: "printf install > install-marker", update: "printf update > update-marker" }];
    await store.save(settings);
    const before = await readFile(store.path, "utf8");
    expectFailure(await manage(store, "tool/run", { id: 9, update: "true" }));
    await expect(access(join(home, "install-marker"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(home, "update-marker"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("preserves independently enabled skills during a rejected import and imports after disabling", async () => {
    const { home, store } = await fixture();
    const stored = join(home, ".agents/skills/.disabled/review");
    await mkdir(stored, { recursive: true });
    await writeFile(join(stored, "SKILL.md"), "---\nname: review\ndescription: Review fixture\n---\nFixture instruction\n");
    const availability = { name: "review", scope: "Global", enabled: true };
    expect((await manage(store, "skill/availability", availability)).code).toBe(0);
    const active = join(home, ".agents/skills/review");
    const alias = join(home, ".claude/skills/review");
    expect(await readlink(active)).toBe(stored);
    expect(await readlink(alias)).toBe(stored);
    const before = await readFile(store.path, "utf8");
    const imported = emptySettings();
    imported.favoriteSources = [{ name: "Imported", source: "owner/toolkit" }];
    expectFailure(await manage(store, "import", { settings: imported }));
    expect(await readFile(store.path, "utf8")).toBe(before);
    expect(await readlink(active)).toBe(stored);
    expect(await readlink(alias)).toBe(stored);
    expect((await manage(store, "skill/availability", { ...availability, enabled: false })).code).toBe(0);
    expect((await manage(store, "import", { settings: imported })).code).toBe(0);
    expect(await store.read()).toEqual(imported);
    await expect(access(active)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(alias)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toContain("Fixture instruction");
  });

  it("rejects malformed JSON, arrays, unknown options, and unknown operations without mutations", async () => {
    const { home, store } = await fixture();
    const before = await readFile(store.path, "utf8");
    const malformed = join(home, "malformed.json");
    await writeFile(malformed, "{broken");
    expectFailure(await command(store, ["manage", "profile/save", "--input", malformed]));
    expectFailure(await manage(store, "profile/save", []));
    expectFailure(await command(store, ["manage", "state", "--unknown"]));
    expectFailure(await command(store, ["manage", "missing-operation"]));
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("reads JSON input from stdin and rejects non-object input", async () => {
    const { store } = await fixture();
    const before = await readFile(store.path, "utf8");
    const input = vi.spyOn(process.stdin, Symbol.asyncIterator);
    input.mockImplementation(async function* (): AsyncGenerator<Buffer, undefined, unknown> { yield Buffer.from('{"local":true}'); });
    const result = await command(store, ["manage", "discover", "--input", "-"]);
    expect(result.code).toBe(0);
    expect(json(result.stdout)).toEqual({ names: [], descriptions: {} });
    input.mockImplementation(async function* (): AsyncGenerator<Buffer, undefined, unknown> { yield Buffer.from("[]"); });
    expectFailure(await command(store, ["manage", "discover", "--input", "-"]));
    expect(await readFile(store.path, "utf8")).toBe(before);
  });
});

it("routes named skill updates into the selected scope and propagates the result", async () => {
  const { store } = await fixture();
  const run = vi.spyOn(FieldworkOperations.prototype, "run").mockResolvedValue({ code: 130, output: "Cancelled", phase: "Update cancelled" });
  expect((await command(store, ["skills", "update", "sample", "-g"])).code).toBe(130);
  expect(run).toHaveBeenLastCalledWith("skills/update", { scope: "Global", names: ["sample"] });
  await command(store, ["skills", "update", "sample", "-p", "Demo Studio"]);
  expect(run).toHaveBeenLastCalledWith("skills/update", { scope: "Demo Studio", names: ["sample"] });
  const count = run.mock.calls.length;
  expect((await command(store, ["skills", "update", "-g", "-p", "Demo Studio"])).code).toBe(1);
  expect(run.mock.calls.length).toBe(count);
});
