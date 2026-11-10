import { useState } from "react";
import { useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Progress } from "@/components/Progress";
import { useToast } from "@/components/Toast";
import type { Skill } from "@/screens/skills/model";
import { useRun } from "@/screens/skills/useRun";
import { RunOutput } from "@/screens/tools/RunOutput";
import { useLiveRun } from "@/screens/tools/useLiveRun";

/**
 * Updates through `skills/update` (all tracked skills, or `names`), following `skills/update-state` while it runs.
 * Availability and Manual/Automatic choices are kept by the operation.
 */
export function UpdateDialog({ title, scope, names, onClose }: { title: string; scope: string; names?: string[]; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [polling, setPolling] = useState(false);
  const job = useOperation("skills/update-state", undefined, { refetchInterval: started || polling ? 1000 : false });
  const progress = job.data;
  const running = progress?.pending === true;
  if (running !== polling) setPolling(running);
  const showProgress = started || running;
  const listNames = names !== undefined && names.length > 1;
  const subject = names?.length === 1 ? names[0] : names ? `${names.length} selected skills` : "every skill that updates from a repository";

  const start = async () => {
    setStarted(true);
    const result = await run("skills/update", { scope, ...(names ? { names } : {}) });
    setStarted(false);
    if (!result.ok) return;
    const value = result.value as { code?: number; cancelled?: boolean; updated?: number } | undefined;
    if (value?.cancelled) toast.show("Update cancelled. Your skills are unchanged.");
    else if (value?.code) toast.show("Update failed. Open the details to see why.");
    else toast.show(`Skills updated${value?.updated !== undefined ? ` · ${value.updated} changed` : ""}. On and off stayed as they were.`);
  };

  const cancel = () => void run("skills/update-cancel");

  const renderProgress = () => {
    if (!progress) return <Progress label="Preparing the update…" />;
    const done = !progress.pending;
    return (
      <div role="status" className="update-status">
        {done ? <p><b>{progress.phase}</b></p> : <Progress label={progress.phase} />}
        {progress.item ? <p className="meta">{progress.item}</p> : null}
        {progress.output ? (
          <details>
            <summary>Skills CLI output</summary>
            <pre className="output">{progress.output}</pre>
          </details>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={`${scope} · through Skills CLI`}
      footer={(
        <>
          {running ? <button type="button" className="text danger-text" disabled={progress?.cancellable === false} onClick={cancel}>{progress?.cancellable === false ? "Finishing safely…" : "Cancel update"}</button> : null}
          <span className="spacer" />
          <button type="button" className={showProgress ? "primary" : "text"} onClick={onClose}>{showProgress ? "Close" : "Cancel"}</button>
          {showProgress ? null : <button type="button" className="primary" onClick={() => void start()}>Update</button>}
        </>
      )}
    >
      <p>Updates {subject}. Skills that are on stay on, skills that are off stay off, and your Manual/Automatic choices are kept. Each update is prepared separately before any file is replaced.</p>
      {listNames ? <ul className="tags" aria-label="Skills to update">{names?.map(name => <li key={name} className="tag">{name}</li>)}</ul> : null}
      {showProgress ? renderProgress() : null}
    </Dialog>
  );
}

/** Tool skills update by running their tool's update command. */
export function ToolUpdateDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const run = useRun();
  const [state, setState] = useState<"idle" | "running" | { code: number; output: string }>("idle");
  const start = async () => {
    setState("running");
    const result = await run("tool/run", { id: skill.ownerId, update: true }, { quiet: true });
    if (!result.ok) { setState({ code: 1, output: result.error.message }); return; }
    const value = result.value as { code: number; output: string };
    setState({ code: value.code, output: value.output });
  };
  const finished = typeof state === "object";
  const running = state === "running";
  const live = useLiveRun(typeof skill.ownerId === "number" ? skill.ownerId : undefined, running);
  const output = finished ? state.output : live?.output;

  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!running}
      title={`Update ${skill.name}`}
      description={`${skill.owner} installs and updates this skill.`}
      footer={(
        <>
          <button type="button" className={finished ? "primary" : "text"} onClick={onClose} disabled={running}>{finished ? "Close" : "Cancel"}</button>
          {finished ? null : <button type="button" className="primary" disabled={running} onClick={() => void start()}>{running ? "Running…" : `Run ${skill.owner}’s update`}</button>}
        </>
      )}
    >
      <p>Runs the update command saved for {skill.owner} in Tools. AFK puts your Manual/Automatic choices back afterwards.</p>
      {running ? <div role="status"><Progress label={`Running ${skill.owner}’s update…`} /></div> : null}
      {finished ? <p role="status"><b>{state.code === 0 ? "Finished" : `Stopped with code ${state.code}`}</b></p> : null}
      {output ? <RunOutput output={output} label={`Output of ${skill.owner}`} /> : null}
    </Dialog>
  );
}
