import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Ledger, Row } from "@/components/Row";
import { ago } from "@/text/format";
import type { BackupActions } from "@/screens/backup/useBackupActions";
import type { AttentionItem } from "../../../../src/fieldwork/library-checks.js";

type Confirming = { kind: "discard" | "restore"; item: AttentionItem } | null;

function filesLine(item: AttentionItem): string {
  const files = item.files ?? [];
  const named = files.slice(0, 3).join(", ");
  const more = files.length > 3 ? ` and ${files.length - 3} more` : "";
  const when = item.at ? ` changed ${ago(item.at)}` : "";
  return `${named}${more}${when} outside AFK's editor. Not saved yet.`;
}

export function NeedsAttention({ items, held, actions }: { items: AttentionItem[]; held: boolean; actions: BackupActions }) {
  const [confirming, setConfirming] = useState<Confirming>(null);
  if (items.length === 0) return null;

  const close = () => setConfirming(null);
  const confirm = async () => {
    if (!confirming) return;
    const { kind, item } = confirming;
    close();
    await (kind === "discard" ? actions.discardEdit(item.id) : actions.restoreSavedVersion(item.name));
  };
  const isDiscarding = confirming?.kind === "discard";

  return (
    <section aria-labelledby="attention-h">
      <div className="sec-head"><h2 id="attention-h">Needs attention · {items.length}</h2></div>
      <Ledger labelledBy="attention-h" className="no-aside">
        {items.map(item => item.kind === "replaced" ? (
          <Row
            key={item.id}
            className="attn"
            title={<>
              <span className="sname">{item.name}</span> <span className="state-text warn">Replaced by Skills CLI</span>
              <p className="sub">{item.changed ? "npx skills update swapped the link for a plain folder with a newer version." : "Skills CLI swapped the link for a plain folder with the same files."}</p>
            </>}
            actions={<>
              <button type="button" className="primary" disabled={actions.busy} onClick={() => void actions.takeUpdate(item.name)}>Take the update</button>
              <button type="button" disabled={actions.busy} onClick={() => setConfirming({ kind: "restore", item })}>Restore saved version</button>
            </>}
          />
        ) : (
          <Row
            key={item.id}
            className="attn"
            title={<>
              <span className="sname">{item.name}</span> <span className="state-text warn">Edited outside AFK</span>
              <p className="sub">{filesLine(item)}</p>
            </>}
            actions={<>
              <button type="button" className="primary" disabled={actions.busy} onClick={() => void actions.keepEdit(item.id)}>Keep edit</button>
              <button type="button" disabled={actions.busy} onClick={() => setConfirming({ kind: "discard", item })}>Discard</button>
            </>}
          />
        ))}
      </Ledger>
      {held ? <p className="hint paused-note">Saving to the remote is paused until the edits made outside AFK are kept or discarded.</p> : null}
      <Dialog
        open={confirming !== null}
        onClose={close}
        variant="small"
        title={isDiscarding ? "Discard this edit?" : "Restore the saved version?"}
        footer={<>
          <button type="button" onClick={close}>Cancel</button>
          <button type="button" className="danger-outline" onClick={() => void confirm()}>{isDiscarding ? "Discard edit" : "Restore saved version"}</button>
        </>}
      >
        {isDiscarding ? (
          <>
            <p>The saved version of <b>{confirming?.item.name}</b> comes back and your edit is deleted.</p>
            <p className="hint">Nothing is saved to the remote, so this cannot be undone.</p>
          </>
        ) : (
          <>
            <p>The link to the saved <b>{confirming?.item.name}</b> returns and the plain folder Skills CLI wrote is deleted.</p>
            <p className="hint">Take the update instead to keep its new files.</p>
          </>
        )}
      </Dialog>
    </section>
  );
}
