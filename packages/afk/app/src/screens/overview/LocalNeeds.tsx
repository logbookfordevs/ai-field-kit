import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon, type IconName } from "@/components/Icon";
import { hrefFor } from "@/shell/router";
import { useAction } from "@/screens/overview/useAction";
import type { CheckItem } from "@/screens/overview/needs";

function NeedRow({ kind, icon, tone, title, description, actions }: { kind: string; icon: IconName; tone?: "problem"; title: ReactNode; description: ReactNode; actions: ReactNode }) {
  return (
    <li className={tone ? "need bad" : "need"} data-need={kind}>
      <Icon name={icon} />
      <div>
        <h3>{title}</h3>
        <p className="sub">{description}</p>
      </div>
      <div className="acts">{actions}</div>
    </li>
  );
}

function ConfirmDialog({ title, body, confirm, pending, onConfirm, onClose }: { title: ReactNode; body: string; confirm: string; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose}>Keep it as it is</button>
          <button type="button" className="danger-outline" disabled={pending} onClick={onConfirm}>{confirm}</button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}

const isLibraryFiles = (item: CheckItem) => item.id === "edited:library";

export function EditedNeed({ item }: { item: CheckItem }) {
  const keep = useAction("backup/keep");
  const discard = useAction("backup/discard");
  const [confirming, setConfirming] = useState(false);
  const subject = isLibraryFiles(item) ? "Library files were" : <><span className="sname">{item.name}</span> was</>;
  const files = item.files?.length ? ` Changed: ${item.files.slice(0, 3).join(", ")}${item.files.length > 3 ? ` and ${item.files.length - 3} more` : ""}.` : "";

  const discardEdit = async () => {
    if (await discard.run({ id: item.id }, `${item.name} is back to its saved version.`)) setConfirming(false);
  };

  return (
    <>
      <NeedRow
        kind={`edited-${item.name}`}
        icon="edit"
        title={<>{subject} edited outside AFK</>}
        description={`Keep the edit to save it, or go back to the saved version. Saving to your backup waits until you choose.${files}`}
        actions={
          <>
            <button type="button" disabled={keep.pending} onClick={() => keep.run({ id: item.id }, `Kept your edit to ${item.name}.`)}>Keep edit</button>
            <button type="button" className="text" disabled={keep.pending} onClick={() => setConfirming(true)}>Discard</button>
          </>
        }
      />
      {confirming ? (
        <ConfirmDialog
          title={<>Discard the edit to <span className="sname">{item.name}</span>?</>}
          body="The saved version goes back in place. Your edit is not kept anywhere else."
          confirm="Discard edit"
          pending={discard.pending}
          onConfirm={discardEdit}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

export function ReplacedNeed({ item }: { item: CheckItem }) {
  const take = useAction("backup/take-update");
  const restore = useAction("backup/restore-saved");
  const [confirming, setConfirming] = useState(false);

  const restoreSaved = async () => {
    if (await restore.run({ name: item.name }, `${item.name} is back to its saved version.`)) setConfirming(false);
  };

  return (
    <>
      <NeedRow
        kind={`replaced-${item.name}`}
        icon="alert"
        title={<><span className="sname">{item.name}</span> was replaced by Skills CLI</>}
        description="A plain folder took the place of the saved copy. Take its files into your library, or put the saved version back."
        actions={
          <>
            <button type="button" disabled={take.pending} onClick={() => take.run({ name: item.name }, `${item.name} now uses the new files.`)}>Take the new files</button>
            <button type="button" className="text" disabled={take.pending} onClick={() => setConfirming(true)}>Restore saved</button>
          </>
        }
      />
      {confirming ? (
        <ConfirmDialog
          title={<>Restore the saved <span className="sname">{item.name}</span>?</>}
          body="The plain folder and its files are deleted, and the link to the saved version comes back."
          confirm="Restore saved version"
          pending={restore.pending}
          onConfirm={restoreSaved}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

export function BackupFailedNeed({ waiting, reason }: { waiting: number; reason?: string }) {
  const save = useAction("backup/save");
  const changes = waiting === 1 ? "1 change is" : `${waiting} changes are`;
  return (
    <NeedRow
      kind="backup-failed"
      icon="alert"
      tone="problem"
      title="Backup can't save"
      description={`${reason ? `${reason} ` : ""}${changes} waiting on this machine; nothing is lost.`}
      actions={<button type="button" disabled={save.pending} onClick={() => save.run({}, "Saved to your backup.")}>Try again</button>}
    />
  );
}

export function BackupOffNeed() {
  return (
    <NeedRow
      kind="backup-off"
      icon="cloudoff"
      title="Backup is off"
      description="Your library is only on this machine. Connect a private Git repository and AFK saves after every change."
      actions={<a className="button-link" href={hrefFor("backup")}>Set up backup</a>}
    />
  );
}
