import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PathCard } from "@/components/PathCard";
import { useToast } from "@/components/Toast";
import type { DeletionPreview } from "@/screens/skills/api";
import { plural } from "@/text/format";
import { BulkResultDialog } from "@/screens/skills/BulkResultDialog";
import { useReview, useRun } from "@/screens/skills/useRun";
import type { Selection } from "@/screens/skills/useSelection";
import type { BulkResult } from "@/screens/skills/api";

function PreviewDetails({ preview }: { preview: DeletionPreview }) {
  return (
    <>
      <PathCard label="Folder" path={preview.path} />
      {preview.available ? <p>It is on now. Deleting it also turns it off for every agent.</p> : null}
      {preview.claudeSharesStorage ? <p>Claude shares this skills folder, so Claude loses it too.</p> : null}
      {preview.copies.map(copy => <PathCard key={copy.path} label="Claude copy, also deleted" path={copy.path} />)}
      {preview.links.map(link => <PathCard key={link.path} label="Link removed" path={link.path} />)}
      {preview.retainedCopies.map(path => <PathCard key={path} label="Another copy stays" path={path} />)}
    </>
  );
}

/** Reviews one deletion with `skill/delete-preview`, then deletes exactly what was reviewed. */
export function DeleteDialog({ name, scope, onClose }: { name: string; scope: string; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const review = useReview("skill/delete-preview", { name, scope });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const preview = review.data;
  const stored = preview && "storage" in preview;

  const confirm = async () => {
    if (!preview) return;
    setPending(true);
    const result = await run("skill/delete", { name, scope, expected: preview, confirmed: true }, { quiet: true });
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    toast.show(`${name} deleted.`);
    onClose();
  };

  const renderBody = () => {
    if (review.error) return <p className="field-error" role="alert">{review.error}</p>;
    if (!preview) return <p className="meta" role="status">Checking what deleting {name} would remove…</p>;
    return (
      <>
        <p>{stored ? "Removes its files from this machine and from your library. Your backup keeps it in History." : "Permanently removes its files from this machine. You can reinstall it later from its repository."}</p>
        <PreviewDetails preview={preview} />
      </>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={<>Delete <span className="mono">{name}</span>?</>}
      footer={(
        <>
          <button type="button" onClick={onClose}>Keep it</button>
          <button type="button" className="danger-outline" disabled={!preview || pending} onClick={() => void confirm()}>{pending ? "Deleting…" : `Delete ${name}`}</button>
        </>
      )}
    >
      {renderBody()}
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}

/** Reviews every selected deletion, keeps blocked ones, and deletes the reviewed rest through `skills/bulk`. */
export function BulkDeleteDialog({ names, scope, selection, onClose }: { names: string[]; scope: string; selection: Selection; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const review = useReview("skills/delete-preview", { names, scope });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<BulkResult | null>(null);
  const items = review.data?.items ?? [];
  const eligible = items.filter(item => item.preview);
  const blocked = items.filter(item => !item.preview);

  const confirm = async () => {
    if (!review.data) return;
    setPending(true);
    selection.setBusy(true);
    const result = await run("skills/bulk", { names: review.data.names, scope: review.data.scope, action: "delete", expected: review.data, confirmed: true }, { quiet: true });
    selection.setBusy(false);
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    selection.remove(result.value.items.filter(item => item.ok).map(item => item.name));
    if (result.value.failed) { setFailed(result.value); return; }
    toast.show(`${plural(result.value.completed, "skill")} deleted.`);
    onClose();
  };

  if (failed) return <BulkResultDialog result={failed} scope={scope} onClose={onClose} />;

  const renderBody = () => {
    if (review.error) return <p className="field-error" role="alert">{review.error}</p>;
    if (!review.data) return <p className="meta" role="status">Checking {plural(names.length, "selected skill")}…</p>;
    return (
      <>
        <p>Permanently deletes {plural(eligible.length, "skill")} in {scope} with their supporting files, Claude copies and links.{blocked.length ? ` ${plural(blocked.length, "skill")} can’t be deleted and will be kept.` : ""}</p>
        <ul className="delete-list">
          {items.map(item => (
            <li key={item.name}>
              <span className="sname">{item.name}</span>
              {item.preview ? <code className="meta">{item.preview.path}</code> : <p className="field-error">{item.error}</p>}
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!pending}
      title="Delete the selected skills?"
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={pending}>Keep them</button>
          <button type="button" className="danger-outline" disabled={!eligible.length || pending} onClick={() => void confirm()}>{pending ? "Deleting…" : `Delete ${plural(eligible.length, "skill")}`}</button>
        </>
      )}
    >
      {renderBody()}
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}
