import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import type { Filters, StartsFilter, StateFilter } from "@/screens/skills/model";

const stateOptions: { value: StateFilter; label: string }[] = [
  { value: "on", label: "On" },
  { value: "all", label: "On and off" },
  { value: "off", label: "Off only" },
];

const startsOptions: { value: StartsFilter; label: string }[] = [
  { value: "any", label: "Either way" },
  { value: "manual", label: "Manual only" },
  { value: "auto", label: "Automatic allowed" },
];

/** Search plus the filters. `/` focuses the search from anywhere on the page. */
export function Toolbar({ filters, fromOptions, onChange }: { filters: Filters; fromOptions?: { value: string; label: string }[]; onChange: (next: Filters) => void }) {
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]");
      if (event.key !== "/" || typing || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      search.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={fromOptions ? "skills-toolbar" : "skills-toolbar no-from"} role="search">
      <label>
        <span>Find a skill</span>
        <span className="skills-search">
          <Icon name="search" />
          <input ref={search} type="search" placeholder="Name or what it does" autoComplete="off" value={filters.query} onChange={event => onChange({ ...filters, query: event.target.value })} />
          <kbd aria-hidden="true">/</kbd>
        </span>
      </label>
      {fromOptions ? (
        <label>
          <span>Comes from</span>
          <select value={filters.from} onChange={event => onChange({ ...filters, from: event.target.value })}>
            {fromOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ) : null}
      <label>
        <span>State</span>
        <select value={filters.state} onChange={event => onChange({ ...filters, state: event.target.value as StateFilter })}>
          {stateOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>How it starts</span>
        <select value={filters.starts} onChange={event => onChange({ ...filters, starts: event.target.value as StartsFilter })}>
          {startsOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
