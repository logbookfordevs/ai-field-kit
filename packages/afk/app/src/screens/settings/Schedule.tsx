import { useState } from "react";
import { useMutation, useOperation } from "@/api/hooks";
import { Switch } from "@/components/Switch";
import { useToast } from "@/components/Toast";
import { Field } from "@/components/Field";
import type { ScheduleState } from "../../../../src/fieldwork/skill-schedule.js";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const when = (time: number): string => new Date(time).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function resultText(result: NonNullable<ScheduleState["lastResult"]>): string {
  if (result.cancelled) return "Cancelled; original skills unchanged";
  if (result.code !== 0) return "Failed; original skills unchanged";
  if (!result.updated) return "Everything was already up to date";
  return `${result.updated} ${result.updated === 1 ? "skill" : "skills"} updated`;
}

function LastRun({ state }: { state: ScheduleState }) {
  const result = state.lastResult;
  if (state.running) return <p className="meta" role="status">Updating Global skills now… Progress also appears under Skills.</p>;
  if (!result) return null;
  const failed = result.code !== 0 && !result.cancelled;
  return (
    <div className="last-run">
      <p className={failed ? "field-error" : "meta"} role="status">Last automatic run {when(result.at)} · {resultText(result)}</p>
      {result.output ? <details open={failed}><summary>Last run details</summary><pre>{result.output}</pre></details> : null}
    </div>
  );
}

export function Schedule() {
  const [poll, setPoll] = useState<number | false>(false);
  const read = useOperation("skills/schedule-state", {}, { refetchInterval: poll });
  const save = useMutation("skills/schedule");
  const toast = useToast();
  const state = read.data;
  const running = state?.running ?? false;

  const wanted = running ? 2_000 : false;
  if (poll !== wanted) setPoll(wanted);

  if (read.error) return <p className="field-error" role="alert">{read.error.message}</p>;
  if (!state) return <p className="meta" role="status">Loading schedule…</p>;

  const weekly = state.frequency === "weekly";

  const change = async (next: Partial<Pick<ScheduleState, "enabled" | "frequency" | "time" | "weekday">>) => {
    const choice = { enabled: state.enabled, frequency: state.frequency, time: state.time, weekday: state.weekday, ...next };
    if (!choice.time) { toast.show("Choose a time for automatic updates."); return; }
    const result = await save.run(choice);
    if (!result.ok) { toast.show(result.error.message); return; }
    const saved = result.value as ScheduleState;
    toast.show(saved.enabled && saved.nextRunAt ? `Schedule saved. Next run ${when(saved.nextRunAt)}.` : "Automatic skill updates turned off.");
  };

  return (
    <div className="form-grid">
      <Switch
        label="Update Global skills automatically"
        checked={state.enabled}
        disabled={save.pending}
        onChange={enabled => void change({ enabled })}
        stateText={{ on: "Updating Global skills automatically", off: "Automatic updates off" }}
      />
      <div className="schedule-fields">
        <Field label="Repeat">
          <select value={state.frequency} disabled={save.pending} onChange={event => void change({ frequency: event.target.value === "daily" ? "daily" : "weekly" })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
        {weekly ? (
          <Field label="Day">
            <select value={String(state.weekday)} disabled={save.pending} onChange={event => void change({ weekday: Number(event.target.value) })}>
              {days.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Time">
          <input type="time" required defaultValue={state.time} onChange={event => { if (event.target.value && event.target.value !== state.time) void change({ time: event.target.value }); }} />
        </Field>
      </div>
      {state.enabled && state.nextRunAt ? <p className="meta">Next run {when(state.nextRunAt)}, if AFK is running then.</p> : null}
      <LastRun state={state} />
    </div>
  );
}
