import { useId } from "react";
import { Icon } from "@/components/Icon";
import "@/components/Segmented.css";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps<V extends string> {
  /** Names the group; hidden unless `showLegend`. */
  legend: string;
  showLegend?: boolean;
  options: readonly SegmentedOption<V>[];
  /** null when nothing is chosen yet. */
  value: V | null;
  onChange: (value: V) => void;
  disabled?: boolean;
}

/** A two-way (or few-way) choice built on native radios: arrow keys move, the group has a name. */
export function Segmented<V extends string>({ legend, showLegend = false, options, value, onChange, disabled = false }: SegmentedProps<V>) {
  const name = useId();
  return (
    <fieldset className="seg-field" disabled={disabled}>
      <legend className={showLegend ? undefined : "vh"}>{legend}</legend>
      <div className="seg">
        {options.map(option => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span><Icon name="check" size="sm" />{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
