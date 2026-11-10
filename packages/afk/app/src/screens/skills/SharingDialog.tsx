import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PathCard } from "@/components/PathCard";
import { useToast } from "@/components/Toast";
import { useReview, useRun } from "@/screens/skills/useRun";

/** Reviews `skills-sharing/state`, then connects or disconnects Claude with exactly that reviewed state. */
export function SharingDialog({ scope, onClose }: { scope: string; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const review = useReview("skills-sharing/state", { scope });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const state = review.data;
  const connected = state?.status === "connected";
  const conflict = state?.status === "conflict";
  const canChange = Boolean(state) && !conflict;

  const apply = async () => {
    if (!state) return;
    setPending(true);
    const result = await run("skills-sharing/set", { scope, enabled: !connected, expected: state }, { quiet: true });
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    toast.show(connected ? "Claude no longer shares this folder. Your skills stay." : "Claude now shares this project’s skills folder.");
    onClose();
  };

  const renderBody = () => {
    if (review.error) return <p className="field-error" role="alert">{review.error}</p>;
    if (!state) return <p className="meta" role="status">Checking Claude’s folder…</p>;
    return (
      <>
        <p>{connected ? "Disconnecting removes only the folder link. Your skills stay, but Claude stops finding them here." : "Sharing lets Claude see the same skills. Missing folders are created; existing skills are never overwritten."}</p>
        <PathCard label="Skills folder" path={state.source} />
        <PathCard label="Claude folder" path={state.destination} />
        {conflict ? <p className="field-error">{state.reason}</p> : null}
      </>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title="Share skills with Claude"
      description={scope}
      footer={(
        <>
          <button type="button" className="text" onClick={onClose}>Cancel</button>
          {canChange ? <button type="button" className={connected ? "danger-outline" : "primary"} disabled={pending} onClick={() => void apply()}>{connected ? "Disconnect" : "Share with Claude"}</button> : null}
        </>
      )}
    >
      {renderBody()}
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}
