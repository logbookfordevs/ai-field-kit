import { useSyncExternalStore } from "react";

const phone = "(max-width: 760px)";

function subscribe(onChange: () => void): () => void {
  const query = matchMedia(phone);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True at phone widths, where the layout switches at 760px like the CSS. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(phone).matches, () => false);
}
