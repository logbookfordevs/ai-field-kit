import { join } from "node:path";
import { quoteArg } from "../delegates.js";
import type { Runtime, SkillCategorizationMode } from "../types.js";
import { afkSkillsTaxonomyFileName, loadSkillCatalog, type SkillCatalogSnapshot } from "./catalog.js";
import { renderCategorizationRoute, renderPromptPreview } from "./render.js";

export type CategorizationCommand = {
  command: string;
  args: string[];
  cwd: string;
  mode: SkillCategorizationMode;
  prompt: string;
};

export async function runCodexCategorization(runtime: Runtime, options: {
  homeDir: string;
  cwd: string;
  dryRun: boolean;
  mode: SkillCategorizationMode | undefined;
  instruction: string | undefined;
}): Promise<number> {
  const built = buildCodexCategorizationCommand(options);
  runtime.io.stdout(renderCategorizationRoute({
    mode: built.mode,
    taxonomyPath: join(built.cwd, afkSkillsTaxonomyFileName),
    commandLine: `${built.command} ${[...built.args.slice(0, -1), "<prompt>"].map(quoteArg).join(" ")}`,
    dryRun: options.dryRun,
  }));

  if (options.dryRun) {
    runtime.io.stdout(renderPromptPreview(built.prompt));
    return 0;
  }

  const result = await runtime.spawn(built.command, built.args, built.cwd);
  return result.code;
}

export function buildCodexCategorizationCommand(options: {
  homeDir: string;
  cwd: string;
  mode?: SkillCategorizationMode | undefined;
  instruction?: string | undefined;
}): CategorizationCommand {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "global",
    agent: undefined,
  });
  const root = join(options.homeDir, ".agents", "skills");
  const mode = options.mode ?? recommendedCategorizationMode(snapshot);
  const prompt = buildCategorizationPrompt(snapshot, mode, options.instruction);
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--color",
    "never",
    "--ephemeral",
    "-C",
    root,
    "--add-dir",
    root,
    prompt,
  ];

  return {
    command: "codex",
    args,
    cwd: root,
    mode,
    prompt,
  };
}

export function recommendedCategorizationMode(snapshot: SkillCatalogSnapshot): SkillCategorizationMode {
  if (snapshot.categorization.state !== "loaded") {
    return "append-missing";
  }

  return snapshot.records.some((record) => !record.categoryId) ? "append-missing" : "recategorize-all";
}

export function buildCategorizationPrompt(
  snapshot: SkillCatalogSnapshot,
  mode: SkillCategorizationMode,
  instruction?: string,
): string {
  const activeFolders = snapshot.records
    .filter((record) => record.storage === "active")
    .map((record) => record.folder)
    .sort();
  const disabledFolders = snapshot.records
    .filter((record) => record.storage === "disabled")
    .map((record) => record.folder)
    .sort();
  const existingScopes = snapshot.categorization.state === "loaded"
    ? snapshot.categorization.definition.scopes.map((scope) => scope.label)
    : [];
  const instructionSection = instruction?.trim()
    ? `\n\nAdditional user guidance for this run:\n- ${instruction.trim()}`
    : "";
  const modeInstructions = mode === "append-missing"
    ? [
      "Preserve all existing skill mappings already present in afk-skills.json.",
      "Append only missing skills that are not already represented.",
    ]
    : [
      "You may revise existing skill-to-scope mappings when the current categorization no longer fits the library.",
      "Ensure every discovered skill appears exactly once after the rewrite.",
    ];

  return [
    "You are inside ~/.agents/skills.",
    "",
    `Your job is to create or update ${afkSkillsTaxonomyFileName} for AFK using this schema exactly:`,
    "- version",
    "- generatedAt",
    "- description",
    "- scopes",
    "- skills",
    "",
    "Rules:",
    "- Read local skill folders from the current directory and from .disabled.",
    "- A skill folder is a directory containing SKILL.md.",
    "- Match skills by folder name.",
    `- If ${afkSkillsTaxonomyFileName} is missing, create it.`,
    `- If ${afkSkillsTaxonomyFileName} exists and is valid, preserve existing scopes when they still fit the library well.`,
    "- Create a new scope only when no existing scope is a good fit.",
    "- Prefer intent-based scopes over umbrella buckets.",
    "- Common useful scope patterns include Frontend, Docs, Review, Debug, Automation, Project Context, Video, and Stitch.",
    "- Include both active and disabled skills.",
    "- Do not edit SKILL.md files.",
    "- Do not delete skill folders.",
    `- Write the final result to ~/.agents/skills/${afkSkillsTaxonomyFileName}.`,
    "- Keep the JSON pretty-printed.",
    ...modeInstructions.map((item) => `- ${item}`),
    "",
    "Context:",
    activeFolders.length > 0 ? `Active skill folders: ${activeFolders.join(", ")}` : "Active skill folders: none",
    disabledFolders.length > 0 ? `Disabled skill folders: ${disabledFolders.join(", ")}` : "Disabled skill folders: none",
    existingScopes.length > 0 ? `Existing scopes: ${existingScopes.join(", ")}` : "Existing scopes: none",
    taxonomyStatus(snapshot),
    instructionSection,
  ].join("\n");
}

function taxonomyStatus(snapshot: SkillCatalogSnapshot): string {
  const state = snapshot.categorization;
  switch (state.state) {
    case "missing":
      return `${afkSkillsTaxonomyFileName} is currently missing. Create it from scratch.`;
    case "invalid":
      return `${afkSkillsTaxonomyFileName} exists but cannot be parsed. Repair it. Error: ${state.message}`;
    case "loaded":
      return `${afkSkillsTaxonomyFileName} exists and is valid.`;
  }
}
