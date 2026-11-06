import { useState } from "react";
import { useToast } from "@/components/Toast";
import type { BulkResult } from "@/screens/skills/api";
import { plural } from "@/screens/skills/model";
import type { DialogRequest } from "@/screens/skills/SkillDialogs";
import { useRun } from "@/screens/skills/useRun";
import type { Selection } from "@/screens/skills/useSelection";

type Action = { action: "enable" | "disable" } | { action: "invocation"; mode: string };

/**
 * Select shown, and once something is selected: turn on/off (Global only), Manual/Automatic,
 * update and delete, all through `skills/bulk` and its reviewed deletion.
 */
export function BulkBar({ scope, selection, shown, onDialog }: { scope: string; selection: Selection; shown: string[]; onDialog: (request: DialogRequest) => void }) {
  const run = useRun();
  const toast = useToast();
  const [mode, setMode] = useState("");
  const count = selection.names.length;
  const hidden = selection.names.filter(name => !shown.includes(name)).length;
  const allShownPicked = shown.length > 0 && shown.every(name => selection.has(name));
  const global = scope === "Global";

  const apply = async (change: Action) => {
    selection.setBusy(true);
    const result = await run("skills/bulk", { names: selection.names, scope, ...change });
    selection.setBusy(false);
    setMode("");
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

  if (!count) {
    if (!shown.length) return null;
    return (
      <div className="bulk-idle">
        <button type="button" className="text" disabled={selection.busy} onClick={() => selection.add(shown)}>Select shown ({shown.length})</button>
      </div>
    );
  }

  return (
    <div className="bulk" role="group" aria-label="Selected skills">
      <p className="bulk-count">
        <b>{count} selected</b>
        {hidden ? <span className="meta"> · {hidden} hidden by filters</span> : null}
        {selection.busy ? <span className="meta"> · Applying…</span> : null}
      </p>
      <div className="bulk-acts">
        {global ? <button type="button" disabled={selection.busy} onClick={() => void apply({ action: "enable" })}>Turn on</button> : null}
        {global ? <button type="button" disabled={selection.busy} onClick={() => void apply({ action: "disable" })}>Turn off</button> : null}
        <label className="bulk-mode">
          <span className="vh">How the selected skills start</span>
          <select value={mode} disabled={selection.busy} onChange={event => {
            const value = event.target.value;
            setMode(value);
            if (value) void apply({ action: "invocation", mode: value === "default" ? "" : value });
          }}>
            <option value="">How they start…</option>
            <option value="Manual only">Manual only</option>
            <option value="Automatic allowed">Automatic allowed</option>
            <option value="default">Each skill’s default</option>
          </select>
        </label>
        <button type="button" disabled={selection.busy} onClick={() => onDialog({ kind: "update", names: selection.names, title: "Update selected skills", scope })}>Update</button>
        <button type="button" className="danger-outline" disabled={selection.busy} onClick={() => onDialog({ kind: "bulk-delete", names: selection.names, scope })}>Delete…</button>
        {allShownPicked ? null : <button type="button" className="text" disabled={selection.busy} onClick={() => selection.add(shown)}>Select shown</button>}
        <button type="button" className="text" disabled={selection.busy} onClick={selection.clear}>Clear selection</button>
      </div>
    </div>
  );
}
