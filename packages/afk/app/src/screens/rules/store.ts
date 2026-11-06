import { useSyncExternalStore } from "react";
import { emptyDrafts, type Drafts } from "@/screens/rules/model";

let current: Drafts = emptyDrafts();
const listeners = new Set<() => void>();

/**
 * Rule drafts live outside the screen so they survive moving to another page and back,
 * as they did in the earlier app. Nothing here is written to disk until Save.
 */
export const draftStore = {
  get: (): Drafts => current,
  update(change: (drafts: Drafts) => Drafts): void {
    const next = change(current);
    if (next === current) return;
    current = next;
    listeners.forEach(listener => listener());
  },
  reset(): void {
    current = emptyDrafts();
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

const subscribe = (listener: () => void): (() => void) => draftStore.subscribe(listener);
const snapshot = (): Drafts => draftStore.get();

export function useDrafts(): Drafts {
  return useSyncExternalStore(subscribe, snapshot);
}
