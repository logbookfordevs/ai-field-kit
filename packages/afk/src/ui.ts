import { quoteArg } from "./delegates.js";
import type { CliOptions, Runtime } from "./types.js";

export type UiSkillsCommand = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
};

export function buildUiSkillsCommand(commandPath: string[], options: Pick<CliOptions, "cwd" | "uiCategory">): UiSkillsCommand {
  const command = commandPath[1] ?? "";
  const operands = commandPath.slice(2);
  const args = ["--yes", "ui-skills"];

  if (!command) {
    return { label: "UI Skills", command: "npx", args, cwd: options.cwd };
  }

  if (command === "start" || command === "categories") {
    if (operands.length > 0) {
      throw new Error(`Too many arguments for afk ui ${command}.`);
    }

    return { label: "UI Skills", command: "npx", args: [...args, command], cwd: options.cwd };
  }

  if (command === "list") {
    if (operands.length > 0) {
      throw new Error("Too many arguments for afk ui list.");
    }

    return {
      label: "UI Skills",
      command: "npx",
      args: [...args, "list", ...(options.uiCategory ? ["--category", options.uiCategory] : [])],
      cwd: options.cwd,
    };
  }

  if (command === "get") {
    if (operands.length === 0) {
      throw new Error("Missing skill slug.");
    }

    if (operands.length > 1) {
      throw new Error("Too many arguments for afk ui get.");
    }

    return { label: "UI Skills", command: "npx", args: [...args, "get", operands[0] ?? ""], cwd: options.cwd };
  }

  throw new Error(`Unknown ui command: ${command}`);
}

export async function runUiCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  try {
    const command = buildUiSkillsCommand(commandPath, options);

    if (options.dryRun) {
      runtime.io.stdout("UI Skills delegation");
      runtime.io.stdout(`$ ${command.command} ${command.args.map(quoteArg).join(" ")}`);
      return 0;
    }

    const result = await runtime.spawn(command.command, command.args, command.cwd, { verbose: true });
    return result.code;
  } catch (error) {
    runtime.io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
