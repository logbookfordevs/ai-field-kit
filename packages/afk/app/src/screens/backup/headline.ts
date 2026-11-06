import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";
import { changesWaiting } from "@/screens/backup/format";
import { ago } from "@/text/format";

export type Headline = {
  kind: "off" | "saved" | "waiting" | "failed" | "paused";
  title: string;
  detail: string;
};

/** The one sentence pair that names the backup's state; every state has its own words. */
export function headline(status: BackupStatus, now: number = Date.now()): Headline {
  const lastSaved = status.lastSavedAt ? ` Last saved ${ago(status.lastSavedAt, now)}.` : "";
  if (status.state === "off") return { kind: "off", title: "Off", detail: "Your library is only on this machine." };
  if (status.held) {
    const waiting = status.waiting > 0 ? `${changesWaiting(status.waiting)} on this machine. ` : "";
    return { kind: "paused", title: "Paused", detail: `${waiting}Saving resumes when the edits made outside AFK are kept or discarded.${status.waiting > 0 ? "" : lastSaved}` };
  }
  if (status.state === "failed") return { kind: "failed", title: "Can't save", detail: `${changesWaiting(status.waiting)} on this machine; nothing is lost.${lastSaved}` };
  if (status.state === "waiting") return { kind: "waiting", title: "Saving soon", detail: `${changesWaiting(status.waiting)}. AFK saves 2 minutes after the last change.` };
  return {
    kind: "saved",
    title: status.lastSavedAt ? `Saved ${ago(status.lastSavedAt, now)}` : "Saved",
    detail: "AFK saves 2 minutes after each change.",
  };
}
