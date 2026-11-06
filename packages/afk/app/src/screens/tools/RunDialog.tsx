import { useState } from "react";
import { useOperation, useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { RunOutput } from "@/screens/tools/RunOutput";
import { commandFor, pollEvery, type RunKind, type ToolEntry } from "@/screens/tools/types";

export interface RunDialogProps {
  tool: ToolEntry;
  kind: RunKind;
  home: string;
  onClose: () => void;
}

/** Shows the exact command, runs it only on request, and follows its output until it ends. */
export function RunDialog({ tool, kind, home, onClose }: RunDialogProps) {
  const [starting, setStarting] = useState(false);
  const state = useOperation("tool/state", {}, { refetchInterval: starting ? pollEvery : false });
  const { run: runTool, error, reset } = useMutation("tool/run");
  const latest = state.data?.runs[tool.id];
  const running = starting || Boolean(latest?.pending);
  const followsOutput = running ? Boolean(latest?.pending) : Boolean(latest);
  const hasReusedCommand = kind === "update" && !tool.update;
  const hasFailedToStart = Boolean(error) && latest?.output === error?.message;
  const showsOutput = followsOutput && latest && !hasFailedToStart;
  const failed = latest?.code !== undefined && latest.code !== 0;
  const label = kind === "update" ? "Update" : "Install";
  const buttonText = running ? "Running…" : latest ? "Run again" : "Run command";

  const start = async () => {
    reset();
    setStarting(true);
    try {
      await runTool({ id: tool.id, update: kind === "update" });
    } finally {
      await state.reload();
      setStarting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="wide"
      title={`Run ${kind} for ${tool.name}`}
      description="Runs this saved command now, from the folder below. Nothing else runs."
      footer={
        <>
          <button type="button" className="text" onClick={onClose}>Close</button>
          <button type="button" className="primary" disabled={running} onClick={() => void start()}>{buttonText}</button>
        </>
      }
    >
      <div className="tool-run-command">
        <span className="k">{label} command</span>
        <code className="tool-cmd">{commandFor(tool, kind)}</code>
        {hasReusedCommand ? <p className="hint">This tool has no update command, so Update runs its install command.</p> : null}
        <span className="k">Runs in</span>
        <code className="tool-home">{home}</code>
      </div>
      <div className="tool-run-result" aria-live="polite">
        {running ? <p className="tool-state"><span className="spin" aria-hidden="true" />Running…</p> : null}
        {!running && latest && !hasFailedToStart ? <p className={failed ? "tool-state failed" : "tool-state"}><strong>{failed ? "Last run failed" : "Last run finished"}</strong><span>Exit {latest.code}</span></p> : null}
        {error ? <p className="field-error" role="alert">{error.message}</p> : null}
      </div>
      {showsOutput ? <RunOutput output={latest.output} label={`Output of ${tool.name}`} /> : null}
      {!running && latest?.warnings?.length ? <ul className="tool-warnings">{latest.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      {!running && latest?.reapplied?.length ? <p className="hint">Manual/Automatic choices reapplied to {latest.reapplied.join(", ")}.</p> : null}
    </Dialog>
  );
}
