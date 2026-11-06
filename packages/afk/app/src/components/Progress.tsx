import { useId } from "react";
import "@/components/Progress.css";

/**
 * Visible label above a thin bar. With `value` and `max` it is determinate;
 * without, it shows open-ended activity. Wrap in a role="status" region to announce changes.
 */
export function Progress({ label, value, max = 100 }: { label: string; value?: number; max?: number }) {
  const labelId = useId();
  const determinate = value !== undefined;
  const width = determinate ? `${Math.round((Math.min(value, max) / Math.max(max, 1)) * 100)}%` : undefined;
  return (
    <div className="progress-block">
      <p className="meta" id={labelId}>{label}</p>
      <div
        className={determinate ? "progress" : "progress indeterminate"}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? max : undefined}
        aria-valuenow={determinate ? value : undefined}
      >
        <i style={width ? { width } : undefined} />
      </div>
    </div>
  );
}
