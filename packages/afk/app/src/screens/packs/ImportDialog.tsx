import { useId, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Segmented } from "@/components/Segmented";
import { groupsOf, originLabel } from "@/screens/packs/model";
import { plural } from "@/text/format";
import type { ImportProposal } from "@/screens/packs/types";

type Mode = "json" | "link";

export function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (message: string) => void }) {
  const client = useClient();
  const save = useMutation("pack/import");
  const jsonId = useId();
  const linkId = useId();
  const [mode, setMode] = useState<Mode>("json");
  const [json, setJson] = useState("");
  const [link, setLink] = useState("");
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reviewing = proposal !== null;
  const busy = checking || save.pending;

  async function review() {
    const input = mode === "json" ? json.trim() : link.trim();
    if (!input) return setProblem(mode === "json" ? "Paste a manifest first." : "Enter the link to a manifest.");
    setProblem(null);
    setChecking(true);
    const result = await client.run("pack/import-preview", mode === "json" ? { manifest: json } : { origin: input });
    setChecking(false);
    if (result.ok) setProposal(result.value);
    else setProblem(result.error.message);
  }

  async function submit() {
    if (!proposal) return;
    const result = await save.run({ pack: proposal.pack, expected: proposal.expected });
    if (result.ok) onImported(`Imported ${proposal.pack.name}. No skills installed.`);
  }

  function back() {
    save.reset();
    setProposal(null);
  }

  return (
    <Dialog
      open
      variant="wide"
      onClose={onClose}
      canClose={!busy}
      title={reviewing ? "Review the pack" : "Import a pack"}
      description={reviewing ? undefined : "Paste a manifest or give a direct HTTPS link to its JSON. You review what it contains before anything is saved."}
      footer={
        reviewing ? (
          <>
            <button type="button" className="text" onClick={back} disabled={busy}>Back</button>
            <button type="button" className="primary" onClick={() => void submit()} disabled={busy}>Save pack</button>
          </>
        ) : (
          <>
            <button type="button" className="text" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="primary" onClick={() => void review()} disabled={busy}>Review pack</button>
          </>
        )
      }
    >
      {proposal ? (
        <Review proposal={proposal} problem={save.error?.message ?? null} />
      ) : (
        <>
          <Segmented<Mode>
            legend="Import from"
            options={[{ value: "json", label: "Pasted JSON" }, { value: "link", label: "From a link" }]}
            value={mode}
            onChange={next => { setMode(next); setProblem(null); }}
          />
          {mode === "json" ? (
            <div className="field">
              <label htmlFor={jsonId}>Manifest JSON</label>
              <textarea id={jsonId} rows={8} spellCheck={false} value={json} onChange={event => { setJson(event.target.value); setProblem(null); }} />
            </div>
          ) : (
            <div className="field">
              <label htmlFor={linkId}>HTTPS link to the manifest</label>
              <input id={linkId} type="url" inputMode="url" autoComplete="off" placeholder="https://example.com/pack.json" value={link} onChange={event => { setLink(event.target.value); setProblem(null); }} />
            </div>
          )}
          {problem ? <p className="field-error" role="alert">{problem}</p> : null}
        </>
      )}
    </Dialog>
  );
}

function Review({ proposal, problem }: { proposal: ImportProposal; problem: string | null }) {
  const { pack, expected } = proposal;
  const isOn = Boolean(expected?.enabled.length);
  const consequence = expected
    ? `Saving replaces the saved ${expected.name} (${plural(expected.skills.length, "skill")}) with this version.${isOn ? " It's on, so it stays on." : ""} No skills are installed.`
    : "Saving adds this pack. No skills are installed.";

  return (
    <>
      <section className="review">
        <h3>{pack.name}</h3>
        {pack.description ? <p className="sub">{pack.description}</p> : null}
        {pack.origin ? <p className="meta">From {pack.origin}</p> : null}
        {groupsOf(pack).map(group => (
          <div key={group.source} className="review-group">
            <p className="sname">{originLabel(pack, group.source)}</p>
            <ul className="member-names">
              {group.skills.map(name => <li key={name} className="tag">{name}</li>)}
            </ul>
          </div>
        ))}
      </section>
      <p className="sub">{consequence}</p>
      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
    </>
  );
}
