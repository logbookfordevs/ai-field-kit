import { useId, useState, type FormEvent } from "react";
import type { Tool } from "../../../src/fieldwork/settings.js";
import { Progress } from "@/components/Progress";
import { Ledger } from "@/components/Row";
import { plural as count } from "@/text/format";
import { RunOutput } from "@/screens/tools/RunOutput";
import { useLiveRun } from "@/screens/tools/useLiveRun";

/** Tools are only run when ticked here; nothing runs by default. */
export function ToolApproval({ tools, onRun, onSkip }: { tools: Tool[]; onRun: (tools: Tool[]) => void; onSkip: () => void }) {
  const errorId = useId();
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState("");

  const toggle = (id: number, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
    setError("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ticked.size === 0) {
      setError("Tick a tool to run, or skip.");
      return;
    }
    onRun(tools.filter(tool => ticked.has(tool.id)));
  };

  return (
    <>
      <div><h1 tabIndex={-1}>Run your tools?</h1></div>
      <p className="lede">These tools install their own skills. AFK runs only the ones you tick, then applies your saved Manual/Automatic choices to what they install.</p>
      <form className="fr-form" noValidate onSubmit={submit}>
        <fieldset aria-describedby={errorId}>
          <legend className="vh">Tools to run</legend>
          <Ledger label="Saved tools">
            {tools.map(tool => (
              <li key={tool.id} className="tool-row">
                <label className="tool-check">
                  <input type="checkbox" checked={ticked.has(tool.id)} onChange={event => toggle(tool.id, event.target.checked)} />
                  <span className="row-title">{tool.name}</span>
                  {tool.provides?.length ? <span className="meta">Provides {tool.provides.join(", ")}</span> : null}
                  <code className="command">{tool.install}</code>
                </label>
              </li>
            ))}
          </Ledger>
        </fieldset>
        <p className="field-error" id={errorId} role="alert">{error}</p>
        <div className="fr-acts">
          <button type="submit" className="primary">{ticked.size > 0 ? `Run ${count(ticked.size, "tool")}` : "Run tools"}</button>
          <button type="button" className="text" onClick={onSkip}>Skip, I’ll run them from Tools</button>
        </div>
      </form>
    </>
  );
}

export function RunningTools({ tool, position, total }: { tool: Tool; position: number; total: number }) {
  const live = useLiveRun(tool.id, true);
  return (
    <>
      <div><h1 tabIndex={-1}>Running {tool.name}</h1></div>
      <div role="status"><Progress label={`Running ${tool.name} (${position} of ${total})…`} /></div>
      <code className="command">{tool.install}</code>
      {live?.output ? <RunOutput output={live.output} label={`Output of ${tool.name}`} /> : null}
    </>
  );
}
