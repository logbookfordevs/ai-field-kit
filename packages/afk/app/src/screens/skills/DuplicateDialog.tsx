import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { useRun } from "@/screens/skills/useRun";

/** Two copies of one skill: keep the installed one or the older stored one; the other is deleted. */
export function DuplicateDialog({ name, scope, onClose }: { name: string; scope: string; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const [keep, setKeep] = useState<"installed" | "stored" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    if (!keep) { setError("Choose which copy to keep."); return; }
    setPending(true);
    const result = await run("skill/resolve-duplicate", { name, scope, keep }, { quiet: true });
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    toast.show(`Kept one copy of ${name}.`);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={<>Two copies of <span className="mono">{name}</span></>}
      description="Keep one. The other is deleted; packs and projects keep working."
      footer={(
        <>
          <button type="button" className="text" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={pending} onClick={() => void confirm()}>Keep this copy</button>
        </>
      )}
    >
      <fieldset>
        <legend>Which copy</legend>
        <div className="radio-list">
          <label className="card-radio"><input type="radio" name="keep" checked={keep === "installed"} onChange={() => setKeep("installed")} /><b>The installed one</b><span className="meta">What your agents read now.</span></label>
          <label className="card-radio"><input type="radio" name="keep" checked={keep === "stored"} onChange={() => setKeep("stored")} /><b>The stored one</b><span className="meta">The older copy AFK kept.</span></label>
        </div>
      </fieldset>
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}
