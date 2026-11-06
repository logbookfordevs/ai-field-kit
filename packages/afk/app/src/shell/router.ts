import { useSyncExternalStore } from "react";
import type { ScreenId } from "@/screens/types";

const screenIds: readonly ScreenId[] = ["overview", "skills", "packs", "sources", "rules", "tools", "backup", "settings"];

export interface Route {
  screen: ScreenId;
  params: URLSearchParams;
}

/** `#/skills?from=review` → { screen: "skills", params: from=review }. Anything else opens Overview. */
export function parseHash(hash: string): Route {
  const match = /^#\/([a-z-]+)(?:\?(.*))?$/.exec(hash);
  const screen = screenIds.find(id => id === match?.[1]) ?? "overview";
  return { screen, params: new URLSearchParams(match?.[2] ?? "") };
}

export function hrefFor(screen: ScreenId, params?: Record<string, string> | URLSearchParams): string {
  const query = new URLSearchParams(params).toString();
  return `#/${screen}${query ? `?${query}` : ""}`;
}

/** Opens a section; screens use this (or a link to `hrefFor`) instead of touching location directly. */
export function navigate(screen: ScreenId, params?: Record<string, string> | URLSearchParams): void {
  const href = hrefFor(screen, params);
  if (location.hash !== href) location.hash = href;
}

const subscribe = (onChange: () => void): (() => void) => {
  addEventListener("hashchange", onChange);
  return () => removeEventListener("hashchange", onChange);
};
const snapshot = (): string => location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot);
  return parseHash(hash);
}
