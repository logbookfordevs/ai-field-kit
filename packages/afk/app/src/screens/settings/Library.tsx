import { useOperation } from "@/api/hooks";
import { PathCard } from "@/components/PathCard";
import { hrefFor } from "@/shell/router";
import { useSettingsSnapshot } from "@/screens/settings/state";

export function Library() {
  const snapshot = useSettingsSnapshot();
  const backup = useOperation("backup/state", { brief: true });

  if (snapshot.error) return <p className="field-error" role="alert">{snapshot.error.message}</p>;
  if (!snapshot.data || !backup.data) return <p className="meta" role="status">Loading your library…</p>;

  const { status } = backup.data;
  if (!status.library) {
    return (
      <div className="form-grid">
        <p className="sub">This machine has no library yet. Starting one moves your skills into AFK&rsquo;s storage and links them back. Then Backup can save them to a private Git repository.</p>
        <div className="set-actions">
          <a className="button-link primary" href={hrefFor("overview", { start: "library" })}>Start a new library</a>
          <a className="button-link" href={hrefFor("overview", { start: "restore" })}>Restore my library</a>
        </div>
      </div>
    );
  }

  return (
    <div className="form-grid">
      <div className="paths">
        <PathCard label="Library" path={`${snapshot.data.home}/.afk/library`} />
        <PathCard label="Backup" path={status.remote ?? "Off"} />
      </div>
      <p className="hint">Core skills, packs, tools, Try later, invocation choices, agent folders and agent rules are saved here. Every change is one save; Backup sends it to a private Git repository.</p>
      <div className="set-actions"><a className="button-link" href={hrefFor("backup")}>Open Backup</a></div>
    </div>
  );
}
