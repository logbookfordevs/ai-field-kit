import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  makeTheme,
  useEffect,
  useKeypress,
  useMemo,
  usePagination,
  usePrefix,
  useState,
  type Theme,
} from "@inquirer/core";

export type SearchableCheckboxChoice<Value> = {
  value: Value;
  name: string;
  checkedName?: string;
  short?: string;
  description?: string;
  disabled?: boolean | string;
  checked?: boolean;
};

export type NormalizedSearchableCheckboxChoice<Value> = {
  id: number;
  value: Value;
  name: string;
  checkedName: string;
  short: string;
  description?: string;
  disabled: boolean | string;
  checked: boolean;
};

type SearchableCheckboxTheme = {
  icon: {
    checked: string;
    unchecked: string;
    cursor: string;
  };
  style: {
    description: (text: string) => string;
    disabledChoice: (text: string) => string;
    keysHelpTip: (keys: [key: string, action: string][]) => string | undefined;
    noMatches: (text: string) => string;
    renderSelectedChoices: <Value>(selectedChoices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>) => string;
    searchTerm: (text: string) => string;
    selected: (text: string) => string;
  };
  helpMode: "always" | "never" | "auto";
};

type PartialTheme<T> = {
  [Key in keyof T]?: T[Key] extends (...args: never[]) => unknown
    ? T[Key]
    : T[Key] extends object
      ? PartialTheme<T[Key]>
      : T[Key];
};

export type SearchableCheckboxThemeConfig = PartialTheme<Theme<SearchableCheckboxTheme>>;

const defaultTheme: SearchableCheckboxThemeConfig = {
  icon: {
    checked: "■",
    unchecked: "□",
    cursor: "◆ ",
  },
  style: {
    description: (text: string) => text,
    disabledChoice: (text: string) => `- ${text}`,
    keysHelpTip: (keys: [key: string, action: string][]) => keys.map(([key, action]) => `${key} ${action}`).join("  ·  "),
    noMatches: (text: string) => text,
    renderSelectedChoices: <Value>(selectedChoices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>) => {
      if (selectedChoices.length === 0) {
        return "none selected";
      }

      if (selectedChoices.length <= 3) {
        return selectedChoices.map((choice) => choice.short).join(", ");
      }

      return `${selectedChoices.length} selected`;
    },
    searchTerm: (text: string) => text,
    selected: (text: string) => text,
  },
  helpMode: "always",
};

export function normalizeSearchableCheckboxChoices<Value>(
  choices: ReadonlyArray<SearchableCheckboxChoice<Value>>,
): Array<NormalizedSearchableCheckboxChoice<Value>> {
  return choices.map((choice, index) => ({
    id: index,
    value: choice.value,
    name: choice.name,
    checkedName: choice.checkedName ?? choice.name,
    short: choice.short ?? choice.name,
    ...(choice.description ? { description: choice.description } : {}),
    disabled: choice.disabled ?? false,
    checked: choice.checked ?? false,
  }));
}

export function filterSearchableCheckboxChoices<Value>(
  choices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>,
  term: string | undefined,
): Array<NormalizedSearchableCheckboxChoice<Value>> {
  const tokens = term?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return [...choices];
  }

  return choices.filter((choice) => {
    const searchable = [
      choice.name,
      choice.checkedName,
      choice.short,
      choice.description ?? "",
    ].join(" ").toLowerCase();

    return tokens.every((token) => searchable.includes(token));
  });
}

export function toggleSearchableCheckboxChoice<Value>(
  choices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>,
  id: number,
): Array<NormalizedSearchableCheckboxChoice<Value>> {
  return choices.map((choice) => {
    if (choice.id !== id || choice.disabled) {
      return choice;
    }

    return { ...choice, checked: !choice.checked };
  });
}

export function selectedSearchableCheckboxValues<Value>(
  choices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>,
): Value[] {
  return choices
    .filter((choice) => choice.checked && !choice.disabled)
    .map((choice) => choice.value);
}

export const searchableCheckbox = createPrompt(<Value>(config: {
  message: string;
  choices: ReadonlyArray<SearchableCheckboxChoice<Value>>;
  pageSize?: number;
  required?: boolean;
  instructions?: string | false;
  theme?: SearchableCheckboxThemeConfig;
  validate?: (choices: ReadonlyArray<NormalizedSearchableCheckboxChoice<Value>>) => boolean | string | Promise<boolean | string>;
}, done: (value: Value[]) => void) => {
  const { pageSize = 10, required = false, validate = () => true } = config;
  const theme = makeTheme<SearchableCheckboxTheme>(defaultTheme, config.theme);
  const [status, setStatus] = useState("idle");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState(() => normalizeSearchableCheckboxChoices(config.choices));
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const prefix = usePrefix({ status, theme });

  const visibleItems = useMemo(
    () => filterSearchableCheckboxChoices(items, searchTerm),
    [items, searchTerm],
  );
  const activeIndex = Math.min(active, Math.max(0, visibleItems.length - 1));
  const activeItem = visibleItems[activeIndex];

  useEffect(() => {
    setActive(0);
  }, [searchTerm]);

  useKeypress(async (key, rl) => {
    if (isEnterKey(key)) {
      const selected = items.filter((choice) => choice.checked && !choice.disabled);
      if (required && selected.length === 0) {
        setError("At least one choice must be selected");
        return;
      }

      const isValid = await validate(selected);
      if (isValid === true) {
        setStatus("done");
        done(selected.map((choice) => choice.value));
      } else {
        setError(isValid || "You must select a valid value");
      }
      return;
    }

    if (isUpKey(key) || isDownKey(key)) {
      rl.clearLine(0);
      rl.write(searchTerm);
      if (visibleItems.length === 0) {
        return;
      }

      const offset = isUpKey(key) ? -1 : 1;
      const next = Math.min(Math.max(activeIndex + offset, 0), visibleItems.length - 1);
      setActive(next);
      return;
    }

    if (isSpaceKey(key)) {
      rl.clearLine(0);
      rl.write(searchTerm);
      setError(undefined);
      if (activeItem) {
        setItems(toggleSearchableCheckboxChoice(items, activeItem.id));
      }
      return;
    }

    setError(undefined);
    setSearchTerm(rl.line);
  });

  const selectedChoices = items.filter((choice) => choice.checked && !choice.disabled);
  const message = theme.style.message(config.message, status);
  if (status === "done") {
    const answer = theme.style.answer(theme.style.renderSelectedChoices(selectedChoices));
    return [prefix, message, answer].filter(Boolean).join(" ");
  }

  const page = usePagination({
    items: visibleItems,
    active: activeIndex,
    renderItem({ item, isActive }) {
      const checkbox = item.checked ? theme.icon.checked : theme.icon.unchecked;
      const name = item.checked ? item.checkedName : item.name;
      const row = item.disabled
        ? theme.style.disabledChoice(`${checkbox} ${name}`)
        : `${isActive ? theme.icon.cursor : " "}${checkbox} ${name}`;
      return isActive && !item.disabled ? theme.style.highlight(row) : row;
    },
    pageSize,
    loop: false,
  });
  const search = theme.style.searchTerm(searchTerm);
  const header = [prefix, message, search].filter(Boolean).join(" ").trimEnd();
  const description = activeItem?.description ? theme.style.description(activeItem.description) : "";
  const selectedLine = selectedChoices.length > 0 ? theme.style.selected(`${selectedChoices.length} selected`) : "";
  const helpLine = config.instructions === false || theme.helpMode === "never"
    ? ""
    : typeof config.instructions === "string"
      ? theme.style.help(config.instructions)
      : theme.style.keysHelpTip([
        ["type", "filter"],
        ["↑↓", "navigate"],
        ["space", "toggle"],
        ["⏎", "submit"],
      ]);
  const body = [
    visibleItems.length > 0 ? page : theme.style.noMatches("No matches"),
    " ",
    description,
    selectedLine,
    error ? theme.style.error(error) : "",
    helpLine,
  ].filter(Boolean).join("\n").trimEnd();

  return [header, body];
});
