import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function catalogFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "afk-catalog-fixture-"));
  const catalog = join(root, "afk", "catalog");
  mkdirSync(catalog, { recursive: true });
  mkdirSync(join(root, "rules"));
  writeFileSync(join(root, "rules", "AGENTS.md"), "Fixture rules.\n");
  const agentIds = ["afk-cartographer", "afk-builder", "afk-pathfinder"];
  mkdirSync(join(root, "agents"));
  for (const id of agentIds) writeFileSync(join(root, "agents", `${id}.md`), `---\nname: ${id}\ndescription: Test fixture agent.\n---\nPerform the assigned task.\n`);
  const manifests: Record<string, unknown> = {
    skills: { version: 1, defaultSource: "acme/skills", items: ["afk-architect", "afk-compass"].map(id => ({ id, label: id, source: "acme/skills", args: ["--skill", id], default: true })) },
    profiles: { version: 2, alwaysOn: [], items: [] },
    rules: { version: 2, layers: [{ id: "fixture", label: "Fixture", source: "rules/AGENTS.md" }] },
    agents: { version: 1, items: agentIds.map(id => ({ id, label: id, source: `agents/${id}.md` })) },
    mcps: { version: 1, items: [] },
    tools: { version: 1, items: [{ id: "fixture-tool", label: "Fixture tool", description: "Test", install: { command: "echo", args: ["fixture"] }, default: true }] },
    hooks: { version: 1, items: [] },
    presets: { version: 1, defaultsSource: "", presets: [
      { id: "afk-architect", label: "Architect fixture", areas: ["skills", "agents"], selections: { skills: ["afk-architect"], customAgents: agentIds } },
      { id: "daily-routine", label: "Routine fixture", areas: ["rules", "skills", "tools", "agents"], all: true },
    ] },
  };
  for (const [name, content] of Object.entries(manifests)) writeFileSync(join(catalog, `${name}.json`), JSON.stringify(content));
  return root;
}
