import { hrefFor } from "@/shell/router";
import { useSettingsSnapshot } from "@/screens/settings/state";

const globalPrefix = "Global|";

export function InvocationDefaults() {
  const snapshot = useSettingsSnapshot();
  if (snapshot.error) return <p className="field-error" role="alert">{snapshot.error.message}</p>;
  if (!snapshot.data) return <p className="meta" role="status">Loading…</p>;

  const overrides = Object.entries(snapshot.data.settings.preferences).filter(([key]) => key.startsWith(globalPrefix));
  const hasOverrides = overrides.length > 0;

  return (
    <div className="form-grid">
      {hasOverrides ? (
        <ul className="pref-list" aria-label="Global overrides">
          {overrides.map(([key, mode]) => <li key={key}><code>{key.slice(globalPrefix.length)}</code><span className="meta">{mode}</span></li>)}
        </ul>
      ) : <p className="sub">No Global overrides. Every skill uses the setting in its SKILL.md.</p>}
      <div className="set-actions"><a className="button-link" href={hrefFor("skills")}>Adjust in Skills</a></div>
    </div>
  );
}
