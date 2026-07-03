import type {
  HookManifest,
  HookManifestItem,
  McpManifest,
  McpManifestItem,
  RulesManifest,
  SkillManifest,
  SkillManifestItem,
  PluginManifest,
  PluginManifestItem,
} from "./manifest.js";
import type { Area } from "./types.js";

export type EditableManifestArea = Exclude<Area, "profiles">;
export type EditableManifest = RulesManifest | SkillManifest | McpManifest | PluginManifest | HookManifest | Record<string, unknown>;
export type EditableManifestItem = SkillManifestItem | McpManifestItem | PluginManifestItem | HookManifestItem;

type ItemManifest = {
  version: number;
  defaultSource?: string;
  items: EditableManifestItem[];
};

export function emptyEditableManifest(area: EditableManifestArea): RulesManifest | SkillManifest | McpManifest | PluginManifest | HookManifest {
  switch (area) {
    case "rules":
      return { version: 1, source: "github", url: "" };
    case "skills":
      return { version: 1, defaultSource: "", items: [] };
    case "mcps":
      return { version: 1, items: [] };
    case "plugins":
      return { version: 1, items: [] };
    case "hooks":
      return { version: 1, items: [] };
  }
}

export function manifestFilename(area: EditableManifestArea): `${EditableManifestArea}.json` {
  return `${area}.json`;
}

export function addManifestItem(area: Exclude<EditableManifestArea, "rules">, manifest: EditableManifest, item: EditableManifestItem): ItemManifest {
  const draft = itemManifestOrThrow(area, manifest);
  if (draft.items.some((existing) => existing.id === item.id)) {
    throw new Error(`Duplicate ${area} id: ${item.id}`);
  }

  return { ...draft, items: [...draft.items, cloneItem(item)] };
}

export function updateManifestItem(
  area: Exclude<EditableManifestArea, "rules">,
  manifest: EditableManifest,
  id: string,
  item: EditableManifestItem,
): ItemManifest {
  const draft = itemManifestOrThrow(area, manifest);
  const matched = draft.items.some((existing) => existing.id === id);
  if (!matched) {
    throw new Error(`Missing ${area} id: ${id}`);
  }

  const duplicate = draft.items.some((existing) => existing.id !== id && existing.id === item.id);
  if (duplicate) {
    throw new Error(`Duplicate ${area} id: ${item.id}`);
  }

  return {
    ...draft,
    items: draft.items.map((existing) => existing.id === id ? cloneItem(item) : cloneItem(existing)),
  };
}

export function removeManifestItem(area: Exclude<EditableManifestArea, "rules">, manifest: EditableManifest, id: string): ItemManifest {
  const draft = itemManifestOrThrow(area, manifest);
  if (!draft.items.some((item) => item.id === id)) {
    throw new Error(`Missing ${area} id: ${id}`);
  }

  return { ...draft, items: draft.items.filter((item) => item.id !== id).map(cloneItem) };
}

export function toggleManifestItemDefault(area: Exclude<EditableManifestArea, "rules">, manifest: EditableManifest, id: string): ItemManifest {
  const draft = itemManifestOrThrow(area, manifest);
  return {
    ...draft,
    items: draft.items.map((item) => {
      if (item.id !== id) {
        return cloneItem(item);
      }

      return { ...cloneItem(item), default: !item.default };
    }),
  };
}

export function setManifestItemDefaultValues(
  area: Exclude<EditableManifestArea, "rules">,
  manifest: EditableManifest,
  values: Record<string, boolean>,
): ItemManifest {
  const draft = itemManifestOrThrow(area, manifest);
  return {
    ...draft,
    items: draft.items.map((item) => {
      const nextValue = values[item.id];
      return { ...cloneItem(item), default: nextValue ?? item.default };
    }),
  };
}

export function toggleSkillAutoInvocation(manifest: EditableManifest, id: string): SkillManifest {
  if (!isSkillManifest(manifest)) {
    throw new Error("Invalid skills catalog shape");
  }

  if (!manifest.items.some((item) => item.id === id)) {
    throw new Error(`Missing skills id: ${id}`);
  }

  return {
    ...manifest,
    items: manifest.items.map((item) => item.id === id ? { ...item, autoInvocation: !item.autoInvocation } : { ...item }),
  };
}

export function setSkillAutoInvocationValues(manifest: EditableManifest, values: Record<string, boolean>): SkillManifest {
  if (!isSkillManifest(manifest)) {
    throw new Error("Invalid skills catalog shape");
  }

  return {
    ...manifest,
    items: manifest.items.map((item) => {
      const nextValue = values[item.id];
      return nextValue === undefined ? { ...item } : { ...item, autoInvocation: nextValue };
    }),
  };
}

export function validateEditableManifest(area: EditableManifestArea, manifest: EditableManifest): string[] {
  const errors: string[] = [];
  const validShape = isManifestForArea(area, manifest);
  if (!validShape) {
    errors.push(`Invalid ${area} manifest shape`);
    return errors;
  }

  if (area === "rules") {
    return errors;
  }

  const draft = itemManifestOrThrow(area, manifest);
  const seen = new Set<string>();
  for (const item of draft.items) {
    if (seen.has(item.id)) {
      errors.push(`Duplicate ${area} id: ${item.id}`);
      continue;
    }
    seen.add(item.id);
  }

  return errors;
}

export function serializeEditableManifest(area: EditableManifestArea, manifest: EditableManifest): string {
  const errors = validateEditableManifest(area, manifest);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function isItemManifestArea(area: EditableManifestArea): area is Exclude<EditableManifestArea, "rules"> {
  return area !== "rules";
}

export function itemLabel(item: EditableManifestItem): string {
  return item.label === item.id ? item.id : `${item.label} (${item.id})`;
}

function itemManifestOrThrow(area: Exclude<EditableManifestArea, "rules">, manifest: EditableManifest): ItemManifest {
  if (!isItemManifest(manifest)) {
    throw new Error(`Invalid ${area} manifest shape`);
  }

  return {
    version: manifest.version,
    ...(manifest.defaultSource === undefined ? {} : { defaultSource: manifest.defaultSource }),
    items: manifest.items.map(cloneItem),
  };
}

function isManifestForArea(area: EditableManifestArea, manifest: EditableManifest): boolean {
  switch (area) {
    case "rules":
      return isRulesManifest(manifest);
    case "skills":
      return isSkillManifest(manifest);
    case "mcps":
      return isMcpManifest(manifest);
    case "plugins":
      return isPluginManifest(manifest);
    case "hooks":
      return isHookManifest(manifest);
  }
}

function cloneItem<Item extends EditableManifestItem>(item: Item): Item {
  return JSON.parse(JSON.stringify(item)) as Item;
}

function isItemManifest(value: EditableManifest): value is ItemManifest {
  const record = toRecord(value);
  return Boolean(record && typeof record.version === "number" && Array.isArray(record.items) && record.items.every(isItemRecord));
}

function isItemRecord(value: unknown): value is EditableManifestItem {
  return isRecord(value) && typeof value.id === "string";
}

function isRulesManifest(value: EditableManifest): value is RulesManifest {
  const record = toRecord(value);
  return Boolean(record && typeof record.version === "number" && (record.source === "github" || record.source === "local") && typeof record.url === "string");
}

function isSkillManifest(value: EditableManifest): value is SkillManifest {
  const record = toRecord(value);
  return (
    Boolean(record) &&
    typeof record?.version === "number" &&
    typeof record.defaultSource === "string" &&
    Array.isArray(record.items) &&
    record.items.every((item: unknown) => (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.source === "string" &&
      isStringArray(item.args) &&
      typeof item.default === "boolean" &&
      (item.autoInvocation === undefined || typeof item.autoInvocation === "boolean") &&
      (item.startDisabled === undefined || typeof item.startDisabled === "boolean")
    ))
  );
}

function isMcpManifest(value: EditableManifest): value is McpManifest {
  const record = toRecord(value);
  return (
    Boolean(record) &&
    typeof record?.version === "number" &&
    Array.isArray(record.items) &&
    record.items.every((item: unknown) => (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.source === "string" &&
      isStringArray(item.args) &&
      typeof item.default === "boolean"
    ))
  );
}

function isPluginManifest(value: EditableManifest): value is PluginManifest {
  const record = toRecord(value);
  return (
    Boolean(record) &&
    typeof record?.version === "number" &&
    Array.isArray(record.items) &&
    record.items.every((item: unknown) => (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.description === "string" &&
      isRecord(item.install) &&
      typeof item.install.command === "string" &&
      isStringArray(item.install.args) &&
      (item.postInstall === undefined || isPluginPostInstallCommand(item.postInstall)) &&
      typeof item.default === "boolean"
    ))
  );
}

function isPluginPostInstallCommand(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.label === undefined || typeof value.label === "string") &&
    typeof value.command === "string" &&
    isStringArray(value.args)
  );
}

function isHookManifest(value: EditableManifest): value is HookManifest {
  const record = toRecord(value);
  return (
    Boolean(record) &&
    typeof record?.version === "number" &&
    Array.isArray(record.items) &&
    record.items.every((item: unknown) => (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.description === "string" &&
      typeof item.source === "string" &&
      typeof item.command === "string" &&
      isStringArray(item.args) &&
      Array.isArray(item.events) &&
      item.events.every((event) => event === "stop") &&
      Array.isArray(item.agents) &&
      item.agents.every((agent) => agent === "codex" || agent === "claude" || agent === "cursor-local") &&
      typeof item.default === "boolean"
    ))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
