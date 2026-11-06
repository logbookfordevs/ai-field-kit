import type { ReactNode } from "react";
import "@/components/PathCard.css";

/** A labelled filesystem path or repository on a quiet panel, with an optional action. */
export function PathCard({ label, path, action }: { label: string; path: string; action?: ReactNode }) {
  return (
    <div className={action ? "path-card has-action" : "path-card"}>
      <span className="k">{label}</span>
      <code>{path}</code>
      {action ? <div className="path-action">{action}</div> : null}
    </div>
  );
}
