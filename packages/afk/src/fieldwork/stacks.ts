export interface SkillStack {
  $schema?: string;
  version: 1;
  id: string;
  name: string;
  description?: string;
  sources: { name: string; source: string; skills: string[] }[];
}

export interface SavedStack {
  manifest: SkillStack;
  origin?: string;
}

const identifier = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*$", maxLength: 200 };
const text = { type: "string", pattern: "^(?![\\s\\S]*[\\u0000-\\u001f\\u007f-\\u009f])(?=[\\s\\S]*\\S)[\\s\\S]+$", maxLength: 4000 };
export const stackSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", title: "AFK skill stack version 1",
  type: "object", additionalProperties: false, required: ["version", "id", "name", "sources"],
  properties: {
    $schema: { type: "string" }, version: { const: 1 }, id: { $ref: "#/$defs/identifier" },
    name: { $ref: "#/$defs/text" }, description: { $ref: "#/$defs/text" },
    sources: {
      type: "array", minItems: 1, maxItems: 100,
      items: {
        type: "object", additionalProperties: false, required: ["name", "source", "skills"],
        properties: {
          name: { $ref: "#/$defs/text" },
          source: { allOf: [{ $ref: "#/$defs/text" }, { pattern: "^[^-]" }] },
          skills: { type: "array", minItems: 1, maxItems: 1000, uniqueItems: true, items: { $ref: "#/$defs/identifier" } },
        },
      },
    },
  },
  $defs: { identifier, text },
} as const;

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validText(value: unknown): value is string { return typeof value === "string" && value.length <= 4000 && new RegExp(text.pattern).test(value); }
function validId(value: unknown): value is string { return typeof value === "string" && value.length <= 200 && new RegExp(identifier.pattern).test(value); }
function only(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).every(key => keys.includes(key)); }

export function validateStack(value: unknown): SkillStack {
  if (!record(value) || !only(value, ["$schema", "version", "id", "name", "description", "sources"]) || value.version !== 1 || !validId(value.id) || !validText(value.name) || (value.description !== undefined && !validText(value.description)) || (value.$schema !== undefined && typeof value.$schema !== "string")) throw new Error("Expected an AFK stack version 1 with id, name, and sources. Executable or unknown fields are not supported.");
  if (!Array.isArray(value.sources) || !value.sources.length || value.sources.length > 100) throw new Error("Choose between 1 and 100 stack source groups.");
  for (const group of value.sources) {
    if (!record(group) || !only(group, ["name", "source", "skills"]) || !validText(group.name) || !validText(group.source) || group.source.startsWith("-")) throw new Error("Stack groups need a name and original repository reference.");
    if (!Array.isArray(group.skills) || !group.skills.length || group.skills.length > 1000 || !group.skills.every(validId) || new Set(group.skills).size !== group.skills.length) throw new Error("Each stack source needs explicit, unique skill names. All-skills wildcards are not supported.");
  }
  return structuredClone(value) as unknown as SkillStack;
}

export function manifestUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 4000 || [...value].some(character => { const code = character.codePointAt(0)!; return code <= 32 || (code >= 127 && code <= 159); })) throw new Error("Use a direct HTTPS manifest URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Use a direct HTTPS manifest URL without credentials or fragments.");
  return url.href;
}

export function validateSavedStack(value: unknown): SavedStack {
  if (!record(value) || !only(value, ["manifest", "origin"])) throw new Error("A saved stack needs a manifest and optional origin URL.");
  const manifest = validateStack(value.manifest);
  return value.origin === undefined ? { manifest } : { manifest, origin: manifestUrl(value.origin) };
}

export async function fetchStack(origin: string): Promise<SkillStack> {
  const url = manifestUrl(origin);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json, text/plain" } });
  if (!response.ok) throw new Error(`Manifest request failed (${response.status}). Use a direct HTTPS JSON URL.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The manifest response was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) throw new Error("Stack manifests must be smaller than 1 MB.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return validateStack(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export function stackInstallScript(stack: SkillStack, target: string, agent: string, projects: { name: string; path: string }[]): string {
  const manifest = validateStack(stack);
  const quote = (value: string): string => {
    if (!value.trim() || [...value].some(character => { const code = character.codePointAt(0)!; return code < 32 || (code >= 127 && code <= 159) || (code >= 0xd800 && code <= 0xdfff); })) throw new Error("Use command values without control characters or invalid Unicode.");
    return "'" + value.replaceAll("'", "'\"'\"'") + "'";
  };
  if (!["interactive", "codex", "claude-code", "cursor", "opencode"].includes(agent)) throw new Error("Choose a supported installation agent.");
  const path = projects.find(project => project.name === target)?.path;
  if (target !== "Global" && !path) throw new Error("Choose a configured project with a local folder.");
  const directory = path === "~" ? '"$HOME"' : path?.startsWith("~/") ? '"$HOME"/' + quote(path.slice(2)) : path ? quote(path) : "";
  const prefix = target === "Global" ? "" : "cd -- " + directory + " && ";
  const commands = manifest.sources.map(group => "(" + prefix + "npx skills add " + quote(group.source) + group.skills.map(name => " --skill " + quote(name)).join("") + (target === "Global" ? " -g" : "") + (agent === "interactive" ? "" : " --agent " + quote(agent)) + ")");
  return "#!/bin/sh\nset -e\n# Run manually. Each source is installed sequentially; prompts remain enabled.\n" + commands.join("\n") + "\n";
}
