import type { KitStatus } from "../../../../src/fieldwork/kit.js";
import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";
import type { AttentionItem } from "../../../../src/fieldwork/library-checks.js";

export const emptyKit: KitStatus = { core: [], sources: [], tools: [], undecided: [], machineOnly: [] };

export const savedBackup: BackupStatus = { library: true, state: "saved", remote: "git@github.com:leo/afk-library.git", waiting: 0, attention: 0, held: false, pushing: false, lastSavedAt: Date.now() - 2 * 60_000 };

export function backupState(status: Partial<BackupStatus> = {}, attention: AttentionItem[] = []) {
  return { status: { ...savedBackup, ...status }, attention, unpushed: [] };
}

export const reviewKit: KitStatus = {
  ...emptyKit,
  undecided: [
    { name: "kami", source: "owner/kami", description: "Draft documents with a steady hand.", installable: true },
    { name: "local-notes", description: "Notes only on this machine.", installable: false },
  ],
};

export function offBackup(status: Partial<BackupStatus> = {}) {
  const base: BackupStatus = { library: true, state: "off", waiting: 0, attention: 0, held: false, pushing: false };
  return { status: { ...base, ...status }, attention: [], unpushed: [] };
}
