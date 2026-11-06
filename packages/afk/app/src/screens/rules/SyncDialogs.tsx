import type { RulesPreview, RulesTargetPreview } from "../../../../src/fieldwork/rules.js";
import { Dialog } from "@/components/Dialog";
import { plural } from "@/screens/rules/model";
import { Diff } from "@/screens/rules/Diff";
import { Status, statusLabel } from "@/screens/rules/Status";
import "@/screens/rules/Rules.css";

export function SaveFirstDialog({ canSyncSaved, onKeepEditing, onSyncSaved, onSaveAndSync }: { canSyncSaved: boolean; onKeepEditing: () => void; onSyncSaved: () => void; onSaveAndSync: () => void }) {
  return (
    <Dialog
      open
      onClose={onKeepEditing}
      variant="small"
      title="Save before syncing?"
      description="There are unsaved changes in your rule files. Sync uses the saved files."
      footer={<><button type="button" className="text" onClick={onKeepEditing}>Keep editing</button>{canSyncSaved ? <button type="button" onClick={onSyncSaved}>Sync last saved version</button> : null}<button type="button" className="primary" onClick={onSaveAndSync}>Save &amp; sync</button></>}
    >
      <p className="sub">Save &amp; sync saves your drafts, then previews the destination changes. No agent file changes until you confirm.</p>
    </Dialog>
  );
}

function PlanBlock({ target, onReview }: { target: RulesTargetPreview; onReview: (id: string) => void }) {
  const blocked = target.status === "conflict" || target.status === "off";
  const same = target.status === "current";
  const claudeMd = target.claudeMd;
  const claudeMdChanged = claudeMd !== undefined && claudeMd.before !== claudeMd.after;
  const importing = claudeMd?.after?.includes("AFK:IMPORT:START") ?? false;
  const claudeTitle = importing ? (claudeMd?.before === null ? "Create CLAUDE.md import" : "Update CLAUDE.md import") : "Remove CLAUDE.md import";
  return (
    <section className="plan">
      <div className="plan-head">
        <div><h3>{target.name}</h3><code className="path">{target.path}</code></div>
        <Status status={target.status} />
      </div>
      <p className="sub">{target.reason}</p>
      {blocked ? <button type="button" onClick={() => onReview(target.id)}>Review conflict</button> : same ? <p className="hint">No write needed.</p> : (
        <>
          <p className="hint">An existing file is backed up before any changes.</p>
          <details open><summary>Destination file changes</summary><Diff before={target.before} after={target.after} label={`Changes to ${target.path}`} /></details>
        </>
      )}
      {claudeMd && claudeMdChanged ? <details open><summary>{claudeTitle} · {claudeMd.path}</summary><Diff before={claudeMd.before} after={claudeMd.after} label="CLAUDE.md changes" /></details> : null}
      {target.references.filter(reference => reference.before !== reference.after).map(reference => (
        <details key={reference.path}>
          <summary>{reference.after === null ? "Remove AFK copy" : reference.before === null ? "Copy reference" : "Update reference"} · {reference.path}</summary>
          <Diff before={reference.before} after={reference.after} label="Reference changes" />
        </details>
      ))}
    </section>
  );
}

export function PreviewDialog({ preview, error, syncing, onSync, onPreviewAgain, onReview, onClose }: { preview: RulesPreview; error: string; syncing: boolean; onSync: () => void; onPreviewAgain: () => void; onReview: (id: string) => void; onClose: () => void }) {
  const writable = preview.targets.filter(target => !["conflict", "off", "current"].includes(target.status));
  const canSync = writable.length > 0 && preview.errors.length === 0;
  const failed = error !== "";
  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!syncing}
      variant="wide"
      title="Sync saved rules"
      description="Preview · nothing written yet. Review the exact files AFK will change. Existing text outside its markers stays untouched."
      footer={<><button type="button" className="text" onClick={onClose} disabled={syncing}>Cancel</button>{failed ? <button type="button" className="primary" onClick={onPreviewAgain}>Preview again</button> : <button type="button" className="primary" disabled={!canSync || syncing} onClick={onSync}>{syncing ? "Syncing…" : writable.length ? `Sync ${plural(writable.length, "destination")}` : "Nothing to write"}</button>}</>}
    >
      {preview.errors.length ? <div role="alert" className="field-error">{preview.errors.map(message => <p key={message}>{message}</p>)}</div> : null}
      {preview.targets.map(target => <PlanBlock key={target.id} target={target} onReview={onReview} />)}
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}

export interface SyncOutcome { id: string; name: string; path: string; status: string; reason: string }

export function ResultDialog({ outcomes, errors, onClose }: { outcomes: SyncOutcome[]; errors: string[]; onClose: () => void }) {
  const skipped = outcomes.some(outcome => outcome.status !== "current");
  return (
    <Dialog
      open
      onClose={onClose}
      variant="wide"
      title={skipped ? "Sync finished with skips" : "Sync complete"}
      footer={<button type="button" className="primary" onClick={onClose}>Done</button>}
    >
      <div className="result-list">
        {outcomes.map(outcome => (
          <div key={outcome.id}>
            <span><strong>{outcome.name}</strong><small>{outcome.path}</small></span>
            <Status status={outcome.status === "conflict" ? "conflict" : "current"} text={outcome.reason || statusLabel(outcome.status)} />
          </div>
        ))}
      </div>
      {errors.length ? <p className="field-error">{errors.join(" ")}</p> : null}
      <p className="sub">{skipped ? "Resolve skipped destinations and sync again." : "Selected destinations have been checked. Your other files stay untouched."}</p>
    </Dialog>
  );
}
