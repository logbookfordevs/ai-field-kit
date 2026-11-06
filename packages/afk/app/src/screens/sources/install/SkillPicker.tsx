import { useId, useState } from "react";
import { plural } from "@/screens/sources/format";

export interface PickerItem {
  name: string;
  description: string;
  /** Short lines under the description: size, "Already installed", a replacement warning. */
  notes: { text: string; warning?: boolean }[];
}

export interface SkillPickerProps {
  legend: string;
  items: readonly PickerItem[];
  picked: ReadonlySet<string>;
  onToggle: (name: string) => void;
  onToggleAll: () => void;
  error?: string;
  /** Loads a skill's SKILL.md before it is installed; omit when there is nothing to read. */
  readSkill?: (name: string) => Promise<string>;
}

export function SkillPicker({ legend, items, picked, onToggle, onToggleAll, error, readSkill }: SkillPickerProps) {
  const errorId = useId();
  const allPicked = items.length > 0 && items.every(item => picked.has(item.name));
  return (
    <fieldset className="picker" aria-describedby={error ? errorId : undefined}>
      <legend>{legend}</legend>
      <div className="picker-head">
        <span className="meta num">{plural(items.length, "skill")} found · {picked.size} selected</span>
        <button type="button" className="text" onClick={onToggleAll}>{allPicked ? "Select none" : "Select all"}</button>
      </div>
      <ul className="picker-list">
        {items.map(item => (
          <li key={item.name}>
            <label className="picker-item">
              <input type="checkbox" checked={picked.has(item.name)} onChange={() => onToggle(item.name)} />
              <span className="sname">{item.name}</span>
              <span className="picker-desc clamp2">{item.description}</span>
              {item.notes.map(note => <span key={note.text} className={note.warning ? "picker-note warning" : "picker-note"}>{note.text}</span>)}
            </label>
            {readSkill ? <SkillText name={item.name} read={readSkill} /> : null}
          </li>
        ))}
      </ul>
      <p className="field-error" id={errorId} role="alert">{error}</p>
    </fieldset>
  );
}

function SkillText({ name, read }: { name: string; read: (name: string) => Promise<string> }) {
  const [text, setText] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const load = async (open: boolean) => {
    if (!open || text !== null) return;
    setFailure(null);
    try { setText(await read(name)); } catch (error) { setFailure(error instanceof Error ? error.message : "Could not read it."); }
  };
  return (
    <details className="picker-read" onToggle={event => { void load(event.currentTarget.open); }}>
      <summary>Read SKILL.md<span className="vh"> of {name}</span></summary>
      <pre>{failure ?? text ?? "Loading…"}</pre>
    </details>
  );
}
