import type { ReactNode } from "react";
import "@/components/Row.css";

/** A ruled list: Ink top rule, quiet dividers. */
export function Ledger({ label, labelledBy, children, className = "" }: { label?: string; labelledBy?: string; children: ReactNode; className?: string }) {
  return <ul className={`ledger ${className}`.trim()} aria-label={label} aria-labelledby={labelledBy}>{children}</ul>;
}

export interface RowProps {
  /** Name of the thing; pass a button to make it open details. */
  title: ReactNode;
  /** One line, clamped. */
  description?: ReactNode;
  /** Where it comes from, a path or a status, in muted text. */
  meta?: ReactNode;
  /** Middle column for state controls such as a Switch or Segmented. */
  aside?: ReactNode;
  /** Trailing actions; rare ones go in a Menu. */
  actions?: ReactNode;
  className?: string;
}

/** A ledger row: name, one-line description and context on the left; state and actions to the right, stacking on phones. */
export function Row({ title, description, meta, aside, actions, className = "" }: RowProps) {
  return (
    <li className={`row ${className}`.trim()}>
      <div className="row-main">
        <div className="row-title">{title}</div>
        {description ? <p className="row-desc clamp1">{description}</p> : null}
        {meta ? <div className="row-meta">{meta}</div> : null}
      </div>
      {aside ? <div className="row-aside">{aside}</div> : null}
      {actions ? <div className="row-actions">{actions}</div> : null}
    </li>
  );
}
