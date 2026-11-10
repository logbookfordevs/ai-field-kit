import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";
import { changesWaiting, dailyBackupTime } from "@/screens/backup/format";
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
    return { kind: "paused", title: "Paused", detail: `${waiting}The ${dailyBackupTime} backup is skipped until the edits made outside AFK are kept or discarded.${status.waiting > 0 ? "" : lastSaved}` };
  }
  if (status.state === "failed") return { kind: "failed", title: "Can't save", detail: `${changesWaiting(status.waiting)} on this machine; nothing is lost.${lastSaved}` };
  if (status.state === "waiting") return { kind: "waiting", title: `Backs up at ${dailyBackupTime}`, detail: `${changesWaiting(status.waiting)} on this machine. Back up now to send them sooner.` };
  return {
    kind: "saved",
    title: status.lastSavedAt ? `Saved ${ago(status.lastSavedAt, now)}` : "Saved",
    detail: `AFK backs up once a day at ${dailyBackupTime}. A day it can’t is skipped.`,
  };
}
