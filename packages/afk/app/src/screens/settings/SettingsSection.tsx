import { useId, type ReactNode } from "react";
import "@/screens/settings/Settings.css";

/** A ruled settings block: heading and explanation on the left, the controls beside them (stacked on phones). */
export function SettingsSection({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="set-grid" aria-labelledby={id}>
      <div>
        <h2 id={id}>{title}</h2>
        <p className="sub">{description}</p>
      </div>
      <div className="set-body">{children}</div>
    </section>
  );
}
