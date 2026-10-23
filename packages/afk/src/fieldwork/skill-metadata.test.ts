import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-metadata-test-"));
  folders.push(home);
  const store = new SettingsStore(home);
  const settings = emptySettings();
  const project = join(home, "project");
  await mkdir(project);
  settings.projects.push({ name: "Demo", path: project });
  settings.profiles.push({ id: "profile", name: "Profile", source: "Local skill selection", skills: ["example"], enabled: [], ready: true });
  const path = join(home, ".agents/skills/.disabled/example");
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), "---\nname: example\ndescription: |\n  First line\n  Second line\n---\nBody\n");
  return { store, settings, project, path, library: new SkillLibrary(store) };
}

async function writeAgent(path: string, text: string) {
  await mkdir(join(path, "agents"), { recursive: true });
  await writeFile(join(path, "agents/openai.yaml"), text);
}

describe("Installed skill metadata", () => {
  it("reads descriptions and resolves absent optional policies to automatic invocation", async () => {
    const { library, settings } = await fixture();
    const [entry] = await library.inventory(settings, "Global");
    expect(entry?.description).toBe("First line\nSecond line");
    expect(entry?.invocation).toEqual({ claude: "Automatic allowed", codex: "Automatic allowed" });
    expect(entry?.defaultInvocation).toEqual(entry?.invocation);
  });

  it("reads separate Claude and Codex policies instead of echoing a stored preference", async () => {
    const { path, library, settings } = await fixture();
    settings.preferences["Global|example"] = "Automatic allowed";
    await writeFile(join(path, "SKILL.md"), "---\nname: example\ndisable-model-invocation: true\n---\nBody\n");
    await writeAgent(path, "policy:\n  allow_implicit_invocation: true\n");
    expect((await library.inventory(settings, "Global"))[0]?.invocation).toEqual({ claude: "Manual only", codex: "Automatic allowed" });
    await writeFile(join(path, "SKILL.md"), "---\nname: example\ndisable-model-invocation: false\n---\nBody\n");
    await writeAgent(path, "policy:\n  allow_implicit_invocation: false\n");
    expect((await library.inventory(settings, "Global"))[0]?.invocation).toEqual({ claude: "Automatic allowed", codex: "Manual only" });
  });

  it.each(["yes", "ON", "1", '"TRUE"'])("accepts Claude's supported boolean value %s", async value => {
    const { path, library, settings } = await fixture();
    await writeFile(join(path, "SKILL.md"), `---\ndisable-model-invocation: ${value}\n---\nBody\n`);
    expect((await library.inventory(settings, "Global"))[0]?.invocation.claude).toBe("Manual only");
  });

  it.each(["no", "OFF", "0", '"FALSE"'])("accepts Claude's supported false value %s", async value => {
    const { path, library, settings } = await fixture();
    await writeFile(join(path, "SKILL.md"), `---\ndisable-model-invocation: ${value}\n---\nBody\n`);
    expect((await library.inventory(settings, "Global"))[0]?.invocation.claude).toBe("Automatic allowed");
  });

  it.each([
    ["---\ndescription: [broken\n---\nBody\n", "policy:\n  allow_implicit_invocation: false\n", { claude: "Unknown", codex: "Manual only" }],
    ["---\ndisable-model-invocation: true\n---\nBody\n", "policy: [broken", { claude: "Manual only", codex: "Unknown" }],
    ["---\ndisable-model-invocation: perhaps\n---\nBody\n", "policy:\n  allow_implicit_invocation: 'false'\n", { claude: "Unknown", codex: "Unknown" }],
    ["---\n- list\n---\nBody\n", "policy: false", { claude: "Unknown", codex: "Unknown" }],
    ["---\ndescription: Missing closing delimiter", "- list", { claude: "Unknown", codex: "Unknown" }],
  ])("keeps malformed metadata in inventory with unknown affected policies", async (skill, agent, expected) => {
    const { path, library, settings } = await fixture();
    await writeFile(join(path, "SKILL.md"), skill);
    await writeAgent(path, agent);
    const inventory = await library.inventory(settings, "Global");
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.invocation).toEqual(expected);
  });

  it("handles empty and CRLF frontmatter without inventing a description", async () => {
    const { path, library, settings } = await fixture();
    await writeFile(join(path, "SKILL.md"), "---\r\n---\r\nBody\r\n");
    const [empty] = await library.inventory(settings, "Global");
    expect(empty?.description).toBe("");
    expect(empty?.invocation.claude).toBe("Automatic allowed");
    await writeFile(join(path, "SKILL.md"), "---\r\ndescription: 'Example: metadata'\r\ndisable-model-invocation: true\r\n---\r\nBody\r\n");
    const [crlf] = await library.inventory(settings, "Global");
    expect(crlf?.description).toBe("Example: metadata");
    expect(crlf?.invocation.claude).toBe("Manual only");
  });

  it("reports physical-copy reset policies from valid original snapshots and rejects corrupt backups", async () => {
    const { path, library, settings, store } = await fixture();
    await writeAgent(path, "policy:\n  allow_implicit_invocation: false\n");
    await setInvocation(store, settings, "example", "Global", "Manual only");
    const [overridden] = await library.inventory(settings, "Global");
    expect(overridden?.invocation).toEqual({ claude: "Manual only", codex: "Manual only" });
    expect(overridden?.defaultInvocation).toEqual({ claude: "Automatic allowed", codex: "Manual only" });
    await writeFile(join(path, ".afk-invocation-original.json"), JSON.stringify({ skill: 42, metadata: null }));
    expect((await library.inventory(settings, "Global"))[0]?.defaultInvocation).toEqual({ claude: "Unknown", codex: "Unknown" });
    await writeFile(join(path, ".afk-invocation-original.json"), "{broken");
    expect((await library.inventory(settings, "Global"))[0]?.defaultInvocation).toEqual({ claude: "Unknown", codex: "Unknown" });
  });

  it("shows isolated project files and the current Global policy that reset will reconnect", async () => {
    const { path, project, library, settings, store } = await fixture();
    await library.activate(settings, "profile", "Demo", true);
    expect((await library.inventory(settings, "Demo"))[0]?.invocationInherited).toBe(true);
    await setInvocation(store, settings, "example", "Demo", "Manual only");
    await setInvocation(store, settings, "example", "Global", "Automatic allowed");
    await writeAgent(path, "policy:\n  allow_implicit_invocation: false\n");
    const [isolated] = await library.inventory(settings, "Demo");
    expect(isolated?.invocationInherited).toBe(false);
    expect(isolated?.invocation).toEqual({ claude: "Manual only", codex: "Manual only" });
    expect(isolated?.defaultInvocation).toEqual({ claude: "Automatic allowed", codex: "Manual only" });
    await setInvocation(store, settings, "example", "Demo", "");
    const [inherited] = await library.inventory(settings, "Demo");
    expect(inherited?.invocationInherited).toBe(true);
    expect(inherited?.invocation).toEqual(isolated?.defaultInvocation);
    expect(await readlink(join(project, ".agents/skills/example"))).toBe(path);
  });

  it("keeps a physical project skill's original policy independent of Global preferences", async () => {
    const { project, library, settings, store } = await fixture();
    const local = join(project, ".agents/skills/example");
    await mkdir(local, { recursive: true });
    await writeFile(join(local, "SKILL.md"), "---\ndisable-model-invocation: true\n---\nBody\n");
    await writeAgent(local, "policy:\n  allow_implicit_invocation: true\n");
    await setInvocation(store, settings, "example", "Global", "Automatic allowed");
    await setInvocation(store, settings, "example", "Demo", "Automatic allowed");
    const [isolated] = await library.inventory(settings, "Demo");
    expect(isolated?.invocationInherited).toBe(false);
    expect(isolated?.defaultInvocation).toEqual({ claude: "Manual only", codex: "Automatic allowed" });
    await setInvocation(store, settings, "example", "Demo", "");
    expect((await library.inventory(settings, "Demo"))[0]?.invocation).toEqual(isolated?.defaultInvocation);
  });
});
