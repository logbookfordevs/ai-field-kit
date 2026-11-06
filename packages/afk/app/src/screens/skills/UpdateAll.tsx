import { Menu, MenuItem } from "@/components/Menu";
import { useNarrow } from "@/shell/useNarrow";

/** The page's Update all; on a phone it waits in a menu beside the heading so the list starts sooner. */
export function UpdateAll({ onSelect }: { onSelect: () => void }) {
  const narrow = useNarrow();
  if (narrow) return <Menu label="More skill actions"><MenuItem onSelect={onSelect}>Update all</MenuItem></Menu>;
  return <button type="button" onClick={onSelect}>Update all</button>;
}
