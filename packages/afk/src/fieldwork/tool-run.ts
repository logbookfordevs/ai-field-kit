import { writeInvocationChoice } from "./invocation.js";
import { readNativeMetadata } from "./skill-metadata.js";
import { ToolSkills } from "./tool-skills.js";
import type { SettingsStore } from "./settings.js";

export interface ToolRunResult {
  output: string;
  code: number;
  reapplied: string[];
  warnings: string[];
}

/**
 * Call before a tool command runs; the returned function takes its result and, once the command has finished,
 * reapplies saved invocation choices to the skills the tool provides and warns about any it brought back while off.
 */
export async function trackToolRun(store: SettingsStore, tool: { name: string; provides?: string[] | undefined }): Promise<(result: { output: string; code: number }) => Promise<ToolRunResult>> {
  const skills = new ToolSkills(store), provided = tool.provides ?? [];
  const before = new Set<string>();
  for (const name of provided) if (await skills.live(name)) before.add(name);

  return async result => {
    const { preferences } = await store.read();
    const reapplied: string[] = [], warnings: string[] = [];
    for (const name of provided) {
      const live = await skills.live(name);
      if (!live) continue;
      if (!before.has(name) && await skills.isOff(name)) warnings.push(`${name} is turned off, but ${tool.name} installed it again. It is available to agents until you turn it off.`);
      const mode = preferences[`Global|${name}`];
      if (mode !== "Manual only" && mode !== "Automatic allowed") continue;
      try {
        const { invocation } = await readNativeMetadata(live);
        if (invocation.claude === mode && invocation.codex === mode) continue;
        await writeInvocationChoice(live, mode);
        reapplied.push(name);
      } catch (error) {
        warnings.push(`Could not apply ${mode} to ${name}: ${error instanceof Error ? error.message : "unknown error"}.`);
      }
    }
    const output = warnings.length ? `${result.output.trimEnd()}\n\n${warnings.map(warning => `Warning: ${warning}`).join("\n")}` : result.output;
    return { output, code: result.code, reapplied, warnings };
  };
}
