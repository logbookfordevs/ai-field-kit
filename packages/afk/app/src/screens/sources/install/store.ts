import { useSyncExternalStore } from "react";

/**
 * What to prefill when the install dialog opens. Anything left out is asked in the dialog.
 * `skills` are preselected once the repository has been searched; the destination is never assumed.
 */
export interface InstallRequest {
  /** Which way in: a repository (default) or an uploaded zip, .skill file or folder. */
  source?: "repository" | "upload";
  repository?: string;
  skills?: string[];
  /** "later" opens it to save a repository to Try later instead of installing. */
  destination?: "later";
}

interface Opened { id: number; request: InstallRequest }

let opened: Opened | null = null;
let counter = 0;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach(listener => listener());

/**
 * Opens the install dialog from anywhere in the app, for example
 * `openInstall({ repository: "owner/repo", skills: ["kami"] })` from a bookmark
 * or `openInstall({ destination: "core" })` from Overview. The dialog is rendered
 * once by `InstallHost` in the app shell.
 */
export function openInstall(request: InstallRequest = {}): void {
  opened = { id: ++counter, request };
  notify();
}

export function closeInstall(): void {
  opened = null;
  notify();
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useOpenedInstall(): Opened | null {
  return useSyncExternalStore(subscribe, () => opened);
}
