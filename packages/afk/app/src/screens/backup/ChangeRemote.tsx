import { useId, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import type { BackupActions } from "@/screens/backup/useBackupActions";

export function ChangeRemote({ actions }: { actions: BackupActions }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const close = () => { setOpen(false); setUrl(""); setMissing(false); };
  const submitRemote = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      setMissing(true);
      input.current?.focus();
      return;
    }
    const next = url.trim();
    close();
    await actions.connectRemote(next);
  };
  const disconnect = async () => {
    close();
    await actions.disconnectRemote();
  };

  return (
    <>
      <button type="button" className="text" onClick={() => setOpen(true)}>Change repository or disconnect</button>
      <Dialog
        open={open}
        onClose={close}
        variant="small"
        title="Change repository or disconnect"
        initialFocus={input}
        footer={<>
          <button type="button" className="danger-outline" onClick={() => void disconnect()}>Disconnect</button>
          <span className="spacer" />
          <button type="submit" form="change-remote" className="primary">Use this remote</button>
        </>}
      >
        <form id="change-remote" onSubmit={event => void submitRemote(event)} noValidate>
          <label>
            <span>New remote URL</span>
            <input ref={input} value={url} onChange={event => setUrl(event.target.value)} placeholder="git@github.com:owner/afk-library.git" autoComplete="off" spellCheck={false} aria-invalid={missing} aria-describedby={missing ? errorId : undefined} />
          </label>
          <p className="field-error" id={errorId}>{missing ? "Enter the URL of the Git repository." : null}</p>
        </form>
        <p className="hint">Disconnecting keeps your library and its history on this machine.</p>
      </Dialog>
    </>
  );
}
