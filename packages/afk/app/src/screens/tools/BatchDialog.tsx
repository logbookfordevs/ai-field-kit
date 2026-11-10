import { useState } from "react";
import { useOperation, useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { RunOutput } from "@/screens/tools/RunOutput";
import { commandFor, pollEvery, type RunKind, type ToolEntry } from "@/screens/tools/types";

interface Outcome {
  code: number;
  output: string;
  skipped?: boolean;
}

export interface BatchDialogProps {
  tools: ToolEntry[];
  kind: RunKind;
  home: string;
  onClose: () => void;
}

/** Reviews every command, then runs them one at a time. A failure does not stop the others. */
export function BatchDialog({ tools, kind, home, onClose }: BatchDialogProps) {
  const toast = useToast();
  const [phase, setPhase] = useState<"ready" | "running" | "finished">("ready");
  const [current, setCurrent] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const state = useOperation("tool/state", {}, { refetchInterval: phase === "running" ? pollEvery : false });
  const { run: runTool } = useMutation("tool/run");
  const running = phase === "running";
  const heading = kind === "update" ? "Update all tools" : "Install all tools";
  const done = Object.keys(outcomes).length;
  const summary = running ? `Running · ${done} of ${tools.length} done` : phase === "finished" ? `Finished · ${done} of ${tools.length} done` : `${tools.length} saved commands`;

  const start = async () => {
    setPhase("running");
    const alreadyRunning = new Set(Object.entries(state.data?.runs ?? {}).filter(([, run]) => run.pending).map(([id]) => Number(id)));
    const results: Record<number, Outcome> = {};
    for (const tool of tools) {
      if (alreadyRunning.has(tool.id)) {
        results[tool.id] = { code: 1, output: "", skipped: true };
        setOutcomes({ ...results });
        continue;
      }
      setCurrent(tool.id);
      const result = await runTool({ id: tool.id, update: kind === "update" });
      results[tool.id] = result.ok ? { code: result.value.code, output: result.value.output } : { code: 1, output: result.error.message };
      setOutcomes({ ...results });
    }
    setCurrent(null);
    setPhase("finished");
    await state.reload();
    const failed = Object.values(results).filter(outcome => outcome.code !== 0).length;
    toast.show(failed ? `Finished. ${failed} of ${tools.length} failed or were skipped.` : "All tool commands finished.");
  };

  const statusOf = (tool: ToolEntry): string => {
    const outcome = outcomes[tool.id];
    if (outcome?.skipped) return "Skipped · already running";
    if (outcome) return outcome.code === 0 ? "Complete" : `Failed · exit ${outcome.code}`;
    return current === tool.id ? "Running…" : "Waiting";
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="wide"
      title={heading}
      description="Runs each saved command one at a time, from the folder below. A failed command does not stop the rest."
      canClose={!running}
      onCloseBlocked={() => toast.show("The commands are still running. Close opens again when they finish.")}
      footer={
        <>
          <button type="button" className="text" disabled={running} onClick={onClose}>Close</button>
          <button type="button" className="primary" disabled={running || phase === "finished"} onClick={() => void start()}>{running ? "Running…" : phase === "finished" ? "Finished" : "Run all commands"}</button>
        </>
      }
    >
      <div className="tool-run-command">
        <span className="k">Runs in</span>
        <code className="tool-home">{home}</code>
      </div>
      <p className="tool-state" role="status">{summary}</p>
      <ul className="tool-batch">
        {tools.map(tool => {
          const outcome = outcomes[tool.id];
          const live = current === tool.id ? state.data?.runs[tool.id] : undefined;
          const output = outcome?.output || (live?.pending ? live.output : "");
          return (
            <li key={tool.id}>
              <div className="tool-batch-head">
                <h3>{tool.name}</h3>
                <span className={outcome && outcome.code !== 0 ? "tool-batch-status failed" : "tool-batch-status"}>{statusOf(tool)}</span>
              </div>
              <code className="tool-cmd">{commandFor(tool, kind)}</code>
              {output ? <RunOutput output={output} label={`Output of ${tool.name}`} /> : null}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
