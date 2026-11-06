import type { AsideMove } from "../../../../src/fieldwork/aside.js";
import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";
import type { AttentionItem } from "../../../../src/fieldwork/library-checks.js";

export interface Resolved {
  status: BackupStatus;
  attention: AttentionItem[];
  movedAside?: AsideMove[];
}

declare module "@/api/operations" {
  interface OperationResults {
    "backup/save": BackupStatus;
    "backup/create": BackupStatus;
    "backup/connect": BackupStatus;
    "backup/disconnect": BackupStatus;
    "backup/restore": BackupStatus;
    "backup/keep": Resolved;
    "backup/discard": Resolved;
    "backup/take-update": Resolved;
    "backup/restore-saved": Resolved;
  }
}
