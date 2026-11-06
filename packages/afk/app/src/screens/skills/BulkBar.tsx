import { Icon } from "@/components/Icon";
import { Menu, MenuItem, MenuNote, MenuSeparator } from "@/components/Menu";
import { useToast } from "@/components/Toast";
import { useNarrow } from "@/shell/useNarrow";
import type { BulkResult } from "@/screens/skills/api";
import { plural } from "@/text/format";
import type { DialogRequest } from "@/screens/skills/SkillDialogs";
import { useRun } from "@/screens/skills/useRun";
import type { Selection } from "@/screens/skills/useSelection";

type Action = { action: "enable" | "disable" } | { action: "invocation"; mode: string };

/** Starts a selection from what the filters show; sits in the list's count row. */
export function SelectShown({ selection, shown }: { selection: Selection; shown: string[] }) {
  const idle = selection.names.length === 0 && shown.length > 0;
  if (!idle) return null;
  return <button type="button" className="text" disabled={selection.busy} onClick={() => selection.add(shown)}>Select shown ({shown.length})</button>;
}

/**
 * Once something is selected: turn on/off (Global only), Manual/Automatic,
 * update and delete, all through `skills/bulk` and its reviewed deletion.
 */
export function BulkBar({ scope, selection, shown, onDialog }: { scope: string; selection: Selection; shown: string[]; onDialog: (request: DialogRequest) => void }) {
  const run = useRun();
  const toast = useToast();
  const narrow = useNarrow();
  const count = selection.names.length;
  const hidden = selection.names.filter(name => !shown.includes(name)).length;
  const allShownPicked = shown.length > 0 && shown.every(name => selection.has(name));
  const global = scope === "Global";

  const apply = async (change: Action) => {
    if (selection.busy) return;
    selection.setBusy(true);
    const result = await run("skills/bulk", { names: selection.names, scope, ...change });
    selection.setBusy(false);
    if (!result.ok) return;
    report(result.value);
  };

  const report = (result: BulkResult) => {
    if (result.failed) {
      selection.remove(result.items.filter(item => item.ok).map(item => item.name));
      onDialog({ kind: "bulk-result", result, scope });
      return;
    }
    toast.show(`${plural(result.completed, "skill")} changed in ${scope}.`);
  };

  if (!count) return null;

  const busy = selection.busy;
  const setMode = (mode: string) => void apply({ action: "invocation", mode });
  const modeItems = (
    <>
      <MenuItem onSelect={() => setMode("Manual only")}>Manual only</MenuItem>
      <MenuItem onSelect={() => setMode("Automatic allowed")}>Automatic allowed</MenuItem>
      <MenuItem onSelect={() => setMode("")}>Each skill’s default</MenuItem>
    </>
  );
  const update = () => onDialog({ kind: "update", names: selection.names, title: "Update selected skills", scope });
  const remove = () => onDialog({ kind: "bulk-delete", names: selection.names, scope });
  const turnOn = global ? <button type="button" disabled={busy} onClick={() => void apply({ action: "enable" })}>Turn on</button> : null;

  const renderActions = () => {
    if (narrow) {
      return (
        <div className="bulk-acts">
          {turnOn}
          <Menu label="More actions for selected" triggerClassName="icon-btn on-accent">
            {global ? <MenuItem onSelect={() => void apply({ action: "disable" })}>Turn off</MenuItem> : null}
            {global ? <MenuSeparator /> : null}
            <MenuNote>How they start</MenuNote>
            {modeItems}
            <MenuSeparator />
            <MenuItem onSelect={update}>Update</MenuItem>
            {allShownPicked ? null : <MenuItem onSelect={() => selection.add(shown)}>Select shown</MenuItem>}
            <MenuItem onSelect={selection.clear}>Clear selection</MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={remove}>Delete…</MenuItem>
          </Menu>
        </div>
      );
    }
    return (
      <div className="bulk-acts">
        {turnOn}
        {global ? <button type="button" disabled={busy} onClick={() => void apply({ action: "disable" })}>Turn off</button> : null}
        <Menu label="How they start" trigger={<>How they start <Icon name="chev" size="sm" className="down" /></>} triggerClassName="bulk-mode">
          {modeItems}
        </Menu>
        <button type="button" disabled={busy} onClick={update}>Update</button>
        <button type="button" className="danger-outline" disabled={busy} onClick={remove}>Delete…</button>
        {allShownPicked ? null : <button type="button" className="text" disabled={busy} onClick={() => selection.add(shown)}>Select shown</button>}
        <button type="button" className="text" disabled={busy} onClick={selection.clear}>Clear selection</button>
      </div>
    );
  };

  return (
    <div className="bulk" role="group" aria-label="Selected skills">
      <p className="bulk-count">
        <b>{count} selected</b>
        {hidden ? <span className="meta"> · {hidden} hidden by filters</span> : null}
        {busy ? <span className="meta"> · Applying…</span> : null}
      </p>
      {renderActions()}
    </div>
  );
}
