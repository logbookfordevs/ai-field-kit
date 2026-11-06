import type { RulesTargetPreview } from "../../../../src/fieldwork/rules.js";
import { Dialog } from "@/components/Dialog";
import { Diff } from "@/screens/rules/Diff";
import { RULES_END, RULES_START } from "@/screens/rules/model";
import "@/screens/rules/Rules.css";

/** True when the destination holds an AFK marker AFK cannot pair up safely. */
export function hasBrokenMarkers(content: string): boolean {
  const start = content.indexOf(RULES_START), end = content.indexOf(RULES_END);
  const present = start >= 0 || end >= 0;
  return present && (start < 0 || end < start || content.split(RULES_START).length !== 2 || content.split(RULES_END).length !== 2);
}

export interface ConflictDialogProps {
  target: RulesTargetPreview;
  previewErrors: string[];
  busy: boolean;
  error: string;
  /** After a failed replace the reviewed snapshot is stale; replacing is withdrawn until it is reviewed again. */
  stale: boolean;
  onAdopt: () => void;
  onReplace: () => void;
  onReviewAgain: () => void;
  onRecheck: () => void;
  onClose: () => void;
}

function explain(target: RulesTargetPreview): { title: string; reason: string; unownedReference: boolean } {
  const reason = target.reason;
  const unownedRegion = reason.includes("AFK region without local ownership");
  const editedRegion = reason.includes("destination rules were edited outside AFK");
  const editedReference = reason.includes("reference was changed outside AFK");
  const unownedReference = reason.includes("existing reference is not owned by AFK");
  if (unownedRegion) return { title: "Existing AFK region needs review", reason: "This file already has an AFK region, but this AFK folder has no record of managing it. Choose which rules to keep.", unownedReference };
  if (editedRegion) return { title: "Destination rules changed", reason: "The rules inside the AFK markers changed since the last sync. Choose which rules to keep.", unownedReference };
  if (editedReference) return { title: "Reference copy changed", reason: "A reference copy changed since the last sync. Bringing rules into the editor does not import reference copies.", unownedReference };
  if (unownedReference) return { title: "Existing reference file needs review", reason: "A reference file already exists where AFK would copy one. AFK cannot replace a file it did not create. Move or rename that file, then review again.", unownedReference };
  return { title: "Destination needs attention", reason, unownedReference };
}

export function ConflictDialog({ target, previewErrors, busy, error, stale, onAdopt, onReplace, onReviewAgain, onRecheck, onClose }: ConflictDialogProps) {
  const content = target.before ?? "";

  if (hasBrokenMarkers(content)) {
    return (
      <Dialog
        open
        onClose={onClose}
        variant="wide"
        title="Repair the AFK markers"
        description={<>AFK cannot safely identify its region in <code>{target.path}</code>. Repair the markers in your editor, then check again. Nothing is written while the markers are broken.</>}
        footer={<><button type="button" className="text" onClick={onClose}>Close</button><button type="button" className="primary" onClick={onRecheck}>Check again</button></>}
      >
        <pre>{content}</pre>
        <p className="hint">Use exactly one matching START and END marker. AFK will not guess where its instructions stop.</p>
      </Dialog>
    );
  }

  const { title, reason, unownedReference } = explain(target);
  const canAdopt = target.currentRegion !== null;
  const canReplace = Boolean(target.region) && !unownedReference && !stale;
  const changedReferences = target.references.filter(reference => reference.before !== reference.after);
  const replaceHint = stale ? "The destination changed. Review it again before replacing." : unownedReference ? "Resolve the reference file collision before replacing." : "Fix the saved rules or destination before replacing.";

  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!busy}
      variant="wide"
      title={title}
      description={<><strong>{target.name}</strong> · <code>{target.path}</code></>}
      footer={<button type="button" className="text" onClick={onClose} disabled={busy}>Decide later</button>}
    >
      <p>{reason}</p>
      <ul className="conflict-options">
        <li className="conflict-choice">
          <h3>Keep the destination rules</h3>
          <p className="sub">Load the rules inside the AFK markers as an unsaved editor draft. Your current draft is kept aside. Reference copies are not imported. Save and sync when ready.</p>
          <button type="button" disabled={!canAdopt || busy} onClick={onAdopt}>Bring rules into editor</button>
          {canAdopt ? null : <p className="hint">There is no AFK region to bring into the editor.</p>}
        </li>
        <li className="conflict-choice">
          <h3>Use the saved AFK rules</h3>
          <p className="sub">Replace only the AFK region and reference copies AFK owns. Text outside the markers stays untouched. Existing files are backed up before writing.</p>
          <button type="button" className="danger-outline" disabled={!canReplace || busy} onClick={onReplace}>{busy ? "Replacing AFK region…" : "Replace AFK region with saved rules"}</button>
          {canReplace ? null : <p className="hint">{replaceHint}</p>}
        </li>
      </ul>
      <div>
        <p className="field-error" role="alert">{[...previewErrors, error].filter(Boolean).join(" ")}</p>
        {stale ? <button type="button" onClick={onReviewAgain}>Review again</button> : null}
      </div>
      <details open><summary>Current destination → saved AFK rules</summary><Diff before={target.before} after={target.after} label="Changes from the current destination to saved AFK rules" /></details>
      {changedReferences.map(reference => <details key={reference.path}><summary>Reference · {reference.path}</summary><Diff before={reference.before} after={reference.after} label="Reference conflict" /></details>)}
    </Dialog>
  );
}
