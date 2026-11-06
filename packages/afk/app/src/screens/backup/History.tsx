import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { Ledger, Row } from "@/components/Row";
import { ago } from "@/screens/backup/format";
import type { BackupActions } from "@/screens/backup/useBackupActions";
import type { SaveEntry } from "../../../../src/fieldwork/library-backup.js";

export function History({ entries, actions }: { entries: SaveEntry[]; actions: BackupActions }) {
  const [target, setTarget] = useState<SaveEntry | null>(null);
  const close = () => setTarget(null);
  const goBack = async () => {
    if (!target) return;
    const { id } = target;
    close();
    await actions.goBackTo(id);
  };

  return (
    <section aria-labelledby="history-h">
      <div className="sec-head">
        <div>
          <h2 id="history-h">History</h2>
          <p className="sub">Going back makes a new save, so it can be undone too.</p>
        </div>
      </div>
      {entries.length === 0 ? <EmptyState title="No saves yet">Each change to your library becomes a save here.</EmptyState> : (
        <Ledger label="Saves" className="no-aside">
          {entries.map((entry, index) => (
            <Row
              key={entry.id}
              title={entry.message}
              meta={`${ago(entry.at)}${entry.pushed ? "" : " · not pushed yet"}`}
              actions={index === 0
                ? <span className="state-text">Current</span>
                : <button type="button" className="text" disabled={actions.busy} aria-label={`Go back to ${entry.message}`} onClick={() => setTarget(entry)}>Go back here</button>}
            />
          ))}
        </Ledger>
      )}
      <Dialog
        open={target !== null}
        onClose={close}
        variant="small"
        title="Go back to this save?"
        footer={<>
          <button type="button" onClick={close}>Cancel</button>
          <button type="button" className="primary" onClick={() => void goBack()}>Go back</button>
        </>}
      >
        <p>The library returns to how it was right after <b>{target?.message}</b>{target ? ` (${ago(target.at)})` : ""}.</p>
        <p className="hint">This becomes a new save, so you can go back again if you change your mind.</p>
      </Dialog>
    </section>
  );
}
