import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isUpKey,
  makeTheme,
  useKeypress,
  usePagination,
  usePrefix,
  useState,
} from "@inquirer/core";
import { afkInvocationPolicyStyle, afkSearchableCheckboxTheme } from "../prompt-ui.js";
import type { SkillRecord } from "./catalog.js";

export type InvocationPolicy = "auto" | "manual";
export type InvocationPolicyDisplayState = InvocationPolicy | "mixed" | "default";

export type InvocationPolicyEditorItem = {
  record: SkillRecord;
  initialPolicy: InvocationPolicyDisplayState;
  draftPolicy: InvocationPolicyDisplayState;
};

export type InvocationPolicyEditorState = {
  items: InvocationPolicyEditorItem[];
  active: number;
  query: string;
};

export type InvocationPolicyEditorEvent =
  | { type: "move"; offset: -1 | 1 }
  | { type: "set-policy"; policy: InvocationPolicy }
  | { type: "filter"; query: string }
  | { type: "cancel" };

export type InvocationPolicyChange = {
  record: SkillRecord;
  allowInvocation: boolean;
};

export const promptInvocationPolicyChanges = createPrompt((config: {
  message: string;
  records: SkillRecord[];
  pageSize?: number;
}, done: (value: InvocationPolicyChange[]) => void) => {
  const theme = makeTheme(afkSearchableCheckboxTheme);
  const [status, setStatus] = useState("idle");
  const [completion, setCompletion] = useState<"applied" | "cancelled" | undefined>();
  const [state, setState] = useState(() => createInvocationPolicyEditorState(config.records));
  const prefix = usePrefix({ status, theme });
  const visibleItems = visibleInvocationPolicyItems(state);
  const activeIndex = Math.min(state.active, Math.max(0, visibleItems.length - 1));
  const activeItem = visibleItems[activeIndex];

  useKeypress((key, rl) => {
    const preserveQuery = () => {
      rl.clearLine(0);
      rl.write(state.query);
    };

    if (isEnterKey(key)) {
      setCompletion("applied");
      setStatus("done");
      done(invocationPolicyChanges(state));
      return;
    }

    if (key.name === "escape") {
      setCompletion("cancelled");
      setState(reduceInvocationPolicyEditor(state, { type: "cancel" }));
      setStatus("done");
      done([]);
      return;
    }

    if (isUpKey(key) || isDownKey(key)) {
      preserveQuery();
      setState(reduceInvocationPolicyEditor(state, {
        type: "move",
        offset: isUpKey(key) ? -1 : 1,
      }));
      return;
    }

    if (key.name === "left" || key.name === "right") {
      preserveQuery();
      setState(reduceInvocationPolicyEditor(state, {
        type: "set-policy",
        policy: key.name === "left" ? "manual" : "auto",
      }));
      return;
    }

    setState(reduceInvocationPolicyEditor(state, { type: "filter", query: rl.line }));
  });

  const changes = invocationPolicyChanges(state);
  const message = theme.style.message(config.message, status);
  if (status === "done") {
    const summary = completion === "cancelled"
      ? "cancelled"
      : changes.length === 0 ? "no changes" : `${changes.length} changes`;
    const answer = theme.style.answer(summary);
    return [prefix, message, answer].filter(Boolean).join(" ");
  }

  const page = usePagination({
    items: visibleItems,
    active: activeIndex,
    renderItem({ item, isActive }) {
      const cursor = isActive ? afkInvocationPolicyStyle.cursor : " ";
      const identity = renderSkillIdentity(item.record, isActive);
      const policy = renderPolicy(item.draftPolicy);
      const changed = item.initialPolicy !== item.draftPolicy
        ? ` ${afkInvocationPolicyStyle.draft("[draft]")}`
        : "";
      const row = `${cursor} ${identity}  ${policy}${changed}`;
      if (item.record.readOnly) {
        return theme.style.disabledChoice(row);
      }
      return row;
    },
    pageSize: config.pageSize ?? 12,
    loop: false,
  });
  const header = [prefix, message, theme.style.searchTerm(state.query)].filter(Boolean).join(" ").trimEnd();
  const description = activeItem
    ? [
      theme.style.description(activeItem.record.description),
      afkInvocationPolicyStyle.scope(`Scope: ${activeItem.record.rootLabel}`),
    ].join("\n")
    : "";
  const changedLine = changes.length > 0 ? theme.style.selected(`${changes.length} changes drafted`) : "";
  const help = renderShortcutHelp();
  const details = [description, changedLine].filter(Boolean);

  return [
    header,
    page || theme.style.noMatches("No matches"),
    ...details,
    "",
    help,
  ].join("\n");
});

export function createInvocationPolicyEditorState(records: SkillRecord[]): InvocationPolicyEditorState {
  return {
    items: records.map((record) => {
      const policy = invocationPolicyDisplayState(record);
      return { record, initialPolicy: policy, draftPolicy: policy };
    }),
    active: 0,
    query: "",
  };
}

export function reduceInvocationPolicyEditor(
  state: InvocationPolicyEditorState,
  event: InvocationPolicyEditorEvent,
): InvocationPolicyEditorState {
  if (event.type === "cancel") {
    return {
      ...state,
      items: state.items.map((item) => ({ ...item, draftPolicy: item.initialPolicy })),
    };
  }

  if (event.type === "filter") {
    return { ...state, active: 0, query: event.query };
  }

  const visibleItems = visibleInvocationPolicyItems(state);
  if (event.type === "move") {
    const lastIndex = Math.max(0, visibleItems.length - 1);
    return { ...state, active: Math.min(Math.max(state.active + event.offset, 0), lastIndex) };
  }

  const activeItem = visibleItems[state.active];
  if (!activeItem || activeItem.record.readOnly) {
    return state;
  }

  return {
    ...state,
    items: state.items.map((item) => item === activeItem ? { ...item, draftPolicy: event.policy } : item),
  };
}

export function visibleInvocationPolicyItems(state: InvocationPolicyEditorState): InvocationPolicyEditorItem[] {
  const tokens = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return state.items;
  }

  return state.items.filter(({ record }) => {
    const searchable = [
      record.name,
      record.folder,
      record.description,
      record.rootLabel,
      record.category ?? "",
      ...record.tags,
    ].join(" ").toLowerCase();

    return tokens.every((token) => searchable.includes(token));
  });
}

export function invocationPolicyChanges(state: InvocationPolicyEditorState): InvocationPolicyChange[] {
  return state.items
    .filter(({ initialPolicy, draftPolicy, record }) => !record.readOnly && initialPolicy !== draftPolicy)
    .filter(({ draftPolicy }) => draftPolicy === "auto" || draftPolicy === "manual")
    .map(({ record, draftPolicy }) => ({
      record,
      allowInvocation: draftPolicy === "auto",
    }));
}

function invocationPolicyDisplayState(record: SkillRecord): InvocationPolicyDisplayState {
  if (record.autoInvocation === "enabled") {
    return "auto";
  }
  if (record.autoInvocation === "disabled") {
    return "manual";
  }
  return record.autoInvocation;
}

function renderPolicy(policy: InvocationPolicyDisplayState): string {
  const label = `[${policy.toUpperCase()}]`;
  switch (policy) {
    case "auto":
      return afkInvocationPolicyStyle.policy.auto(label);
    case "manual":
      return afkInvocationPolicyStyle.policy.manual(label);
    case "mixed":
      return afkInvocationPolicyStyle.policy.mixed(label);
    case "default":
      return afkInvocationPolicyStyle.policy.default(label);
  }
}

function renderSkillIdentity(record: SkillRecord, active: boolean): string {
  const name = afkInvocationPolicyStyle.skill(record.name, active);
  if (record.name.trim().toLowerCase() === record.folder.trim().toLowerCase()) {
    return name;
  }

  return `${name} ${afkInvocationPolicyStyle.folder(`[${record.folder}]`)}`;
}

function renderShortcutHelp(): string {
  return [
    ["type", "filter"],
    ["↑↓", "navigate"],
    ["←", "manual"],
    ["→", "auto"],
    ["enter", "apply"],
    ["esc", "cancel"],
  ].map(([key, action]) =>
    `${afkInvocationPolicyStyle.helpKey(key ?? "")} ${afkInvocationPolicyStyle.helpText(action ?? "")}`
  ).join(afkInvocationPolicyStyle.helpText("  ·  "));
}
