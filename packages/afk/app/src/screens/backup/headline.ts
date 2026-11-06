import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";
import { ago, changesWaiting, repositoryName } from "@/screens/backup/format";

export type Headline = {
  kind: "off" | "saved" | "waiting" | "failed" | "paused";
  title: string;
  detail: string;
};

/** The one sentence pair that names the backup's state; every state has its own words. */
export function headline(status: BackupStatus, now: number = Date.now()): Headline {
  const repository = repositoryName(status.remote);
  const lastSaved = status.lastSavedAt ? ` Last saved ${ago(status.lastSavedAt, now)}.` : "";
  if (status.state === "off") return { kind: "off", title: "Off", detail: "Your library is only on this machine." };
  if (status.held && status.waiting > 0) {
    return { kind: "paused", title: "Paused", detail: `${changesWaiting(status.waiting)} on this machine. Saving resumes when the edits made outside AFK are kept or discarded.` };
  }
  if (status.state === "failed") return { kind: "failed", title: "Can't save", detail: `${changesWaiting(status.waiting)} on this machine; nothing is lost.${lastSaved}` };
  if (status.state === "waiting") return { kind: "waiting", title: "Saving soon", detail: `${changesWaiting(status.waiting)}. AFK saves 2 minutes after the last change.` };
  return {
    kind: "saved",
    title: status.lastSavedAt ? `Saved ${ago(status.lastSavedAt, now)}` : "Saved",
    detail: `${repository ? `${repository} · private. ` : ""}AFK saves 2 minutes after each change.`,
  };
}
