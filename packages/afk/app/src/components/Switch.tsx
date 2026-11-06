import "@/components/Switch.css";

export interface SwitchProps {
  /** Accessible name, usually the thing being turned on, e.g. the skill name. */
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Visible state words; defaults to On / Off. */
  stateText?: { on: string; off: string };
  describedBy?: string;
}

export function Switch({ label, checked, onChange, disabled = false, stateText = { on: "On", off: "Off" }, describedBy }: SwitchProps) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="track" />
      <span className="st" aria-hidden="true">{checked ? stateText.on : stateText.off}</span>
    </button>
  );
}
