import type { ReactNode } from "react";
import "@/components/EmptyState.css";

/** Dashed panel stating what is missing (`title`), why (`children`) and the next step (`actions`). */
export function EmptyState({ title, children, actions, level = 3 }: { title: string; children?: ReactNode; actions?: ReactNode; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      {children ? <p className="sub">{children}</p> : null}
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}
