import type { ComponentType } from "react";

export type ScreenId = "overview" | "skills" | "packs" | "sources" | "rules" | "tools" | "backup" | "settings";

/** What the navigation shows next to a section name. Always readable text, never a bare total. */
export interface Attention {
  text: string;
  /** attention: something to do (filled dot); quiet: a state such as "Off" (hollow dot); problem: failing (Rust Deep). */
  tone?: "attention" | "quiet" | "problem";
}

export interface ScreenProps {
  /** Query parameters from the address, e.g. `#/skills?from=review`. */
  params: URLSearchParams;
}

export interface ScreenDefinition {
  id: ScreenId;
  /** Navigation label and the page's h1. */
  label: string;
  Screen: ComponentType<ScreenProps>;
  /** A hook, called on every render of the navigation; return null when nothing needs saying. */
  useAttention: () => Attention | null;
}

export const noAttention = (): Attention | null => null;
