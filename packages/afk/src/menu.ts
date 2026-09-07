import { select } from "@inquirer/prompts";

const menuBackValue = "__afk_menu_back__";

export type MenuChoice<Value extends string> = {
  name: string;
  value: Value;
  description?: string;
};

type SelectConfig<Value> = Parameters<typeof select<Value>>[0];

export type SelectMenuOptions<Value extends string> = Omit<SelectConfig<Value | typeof menuBackValue>, "choices"> & {
  choices: readonly MenuChoice<Value>[];
  canGoBack?: boolean;
  backLabel?: string;
  backDescription?: string;
};

export async function selectMenu<Value extends string>(options: SelectMenuOptions<Value>): Promise<Value | null> {
  const {
    choices,
    canGoBack = false,
    backLabel = "Back",
    backDescription = "Return to the previous menu",
    ...selectOptions
  } = options;
  const menuChoices: SelectConfig<Value | typeof menuBackValue>["choices"] = canGoBack
    ? [
        ...choices,
        {
          name: backLabel,
          value: menuBackValue,
          description: backDescription,
        },
      ]
    : choices;

  try {
    const selected = await select<Value | typeof menuBackValue>({
      ...selectOptions,
      choices: menuChoices,
      pageSize: options.pageSize ?? menuChoices.length,
    });
    return selected === menuBackValue ? null : selected;
  } catch (error) {
    if (canGoBack && isPromptExit(error)) {
      return null;
    }

    throw error;
  }
}

export function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}
