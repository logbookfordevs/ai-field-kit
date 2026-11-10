import type { AppState, SkillEntry } from "@/screens/skills/api";
import type { SkillEditorView } from "@/screens/skills/api";

type Mode = "Manual only" | "Automatic allowed";

export function entry(name: string, options: Partial<SkillEntry> & { mode?: Mode } = {}): SkillEntry {
  const { mode = "Automatic allowed", ...rest } = options;
  return {
    name,
    path: `/home/.agents/skills/${name}`,
    owners: [],
    stored: true,
    independent: true,
    available: true,
    shared: false,
    description: `${name} does one thing well.`,
    invocation: { claude: mode, codex: mode },
    defaultInvocation: { claude: "Automatic allowed", codex: "Automatic allowed" },
    invocationInherited: false,
    storage: "library",
    ...rest,
  };
}

/**
 * kami and quill are Core (quill is off, north-plan is Core but missing here), hairline belongs to the Writing pack,
 * atlas-review comes from the Atlas tool, stray was installed outside AFK and local-notes stays on this machine.
 */
export function appState(overrides: { global?: SkillEntry[]; project?: SkillEntry[]; preferences?: Record<string, string> } = {}): AppState {
  const global = overrides.global ?? [
    entry("kami", { source: "fieldnotes/agent-skills", description: "Plans a change before writing code." }),
    entry("quill", { source: "fieldnotes/agent-skills", available: false, mode: "Manual only", description: "Edits prose for clarity." }),
    entry("hairline", { source: "fieldnotes/hairline", storage: "pack", owners: ["Writing"], description: "Typography presets." }),
    entry("atlas-review", { source: "logbook/atlas", tool: "Atlas", readOnly: true, storage: undefined as never, description: "Reviews a diff." }),
    entry("stray", { source: "someone/stray", storage: undefined as never, description: "Found outside AFK." }),
    entry("local-notes", { storage: "machine", source: undefined as never, description: "Notes kept on this machine." }),
  ];
  return {
    settings: {
      version: 2,
      profiles: [{ id: "p-writing", name: "Writing", source: "fieldnotes/hairline", skills: ["hairline"], enabled: ["Global"], ready: true }],
      projects: [{ name: "Site", path: "/work/site" }],
      tools: [{ id: 7, name: "Atlas", install: "atlas install", update: "atlas update", provides: ["atlas-review"] }],
      favoriteSources: [],
      kit: { core: [{ source: "fieldnotes/agent-skills", skills: ["kami", "quill", "north-plan"] }] },
      machineOnly: ["local-notes"],
      preferences: overrides.preferences ?? { "Global|quill": "Manual only" },
      managedLinks: {},
      independentSkills: { Global: ["kami"] },
    },
    kit: {
      core: [
        { name: "kami", source: "fieldnotes/agent-skills", follow: false, status: "on" },
        { name: "north-plan", source: "fieldnotes/agent-skills", follow: false, status: "missing" },
        { name: "quill", source: "fieldnotes/agent-skills", follow: false, status: "off" },
      ],
      sources: [{ source: "fieldnotes/agent-skills", follow: false, skills: 3 }],
      tools: [{ id: 7, name: "Atlas", provides: ["atlas-review"], missing: [] }],
      undecided: [{ name: "stray", source: "someone/stray", description: "Found outside AFK.", installable: true }],
      machineOnly: ["local-notes"],
    },
    inventories: {
      Global: global.map(item => (item.storage === undefined ? withoutStorage(item) : item)),
      Site: overrides.project ?? [entry("site-deploy", { path: "/work/site/.agents/skills/site-deploy", storage: undefined as never, description: "Deploys the site." })].map(withoutStorage),
    },
    nestedInventories: { Global: [], Site: [] },
    skillSharing: { Site: { scope: "Site", status: "missing", source: "/work/site/.agents/skills", destination: "/work/site/.claude/skills" } },
    projectStatuses: { Site: "present" },
  };
}

function withoutStorage(item: SkillEntry): SkillEntry {
  const copy = { ...item };
  delete copy.storage;
  if (copy.source === undefined) delete copy.source;
  return copy;
}

export const agentFolders = { library: true, invocationAgents: { claude: ["Claude Code", "Pi"], codex: ["Codex"] } };

export function editorView(name: string, overrides: Partial<SkillEditorView> = {}): SkillEditorView {
  return {
    name,
    storage: "library",
    path: `/home/.afk/library/skills/${name}`,
    files: ["SKILL.md", "references/notes.md"],
    file: "SKILL.md",
    content: `---\nname: ${name}\ndescription: Plans a change.\n---\n\n# ${name}\n\nWrite the plan first.\n`,
    invocation: "Automatic allowed",
    updates: "none",
    ...overrides,
  };
}
