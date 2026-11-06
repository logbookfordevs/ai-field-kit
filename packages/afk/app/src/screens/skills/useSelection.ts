import { useCallback, useMemo, useState } from "react";

export interface Selection {
  names: string[];
  has: (name: string) => boolean;
  toggle: (name: string, selected: boolean) => void;
  add: (names: string[]) => void;
  remove: (names: string[]) => void;
  clear: () => void;
  /** True while a bulk change runs; rows and the bar lock. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

/** Selected skill names, limited to skills that still exist. */
export function useSelection(available: string[]): Selection {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const key = available.join("\n");
  const names = useMemo(() => {
    const present = new Set(key.split("\n"));
    return [...picked].filter(name => present.has(name));
  }, [picked, key]);

  const toggle = useCallback((name: string, selected: boolean) => setPicked(current => {
    const next = new Set(current);
    if (selected) next.add(name); else next.delete(name);
    return next;
  }), []);
  const add = useCallback((list: string[]) => setPicked(current => new Set([...current, ...list])), []);
  const remove = useCallback((list: string[]) => setPicked(current => new Set([...current].filter(name => !list.includes(name)))), []);
  const clear = useCallback(() => setPicked(new Set()), []);
  const has = useCallback((name: string) => names.includes(name), [names]);

  return { names, has, toggle, add, remove, clear, busy, setBusy };
}
