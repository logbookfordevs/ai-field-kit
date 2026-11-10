import { Menu, MenuItem } from "@/components/Menu";
import { openInstall } from "@/screens/sources";
import { useNarrow } from "@/shell/useNarrow";

/** Add something new, then Update all; on a phone both wait in a menu beside the heading so the list starts sooner. */
export function SkillsActions({ onUpdateAll }: { onUpdateAll?: (() => void) | undefined }) {
  const narrow = useNarrow();
  const canUpdate = onUpdateAll !== undefined;

  if (narrow) {
    return (
      <Menu label="More skill actions">
        <MenuItem onSelect={() => openInstall()}>Add something new</MenuItem>
        {canUpdate ? <MenuItem onSelect={onUpdateAll}>Update all</MenuItem> : null}
      </Menu>
    );
  }

  return (
    <>
      <button type="button" className="primary" onClick={() => openInstall()}>Add something new</button>
      {canUpdate ? <button type="button" onClick={onUpdateAll}>Update all</button> : null}
    </>
  );
}
