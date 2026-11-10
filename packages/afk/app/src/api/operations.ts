import type { operationCatalog } from "../../../src/fieldwork/operation-catalog.js";
import type { KitStatus } from "../../../src/fieldwork/kit.js";
import type { BackupContents, BackupStatus, SaveEntry } from "../../../src/fieldwork/library-backup.js";
import type { AttentionItem } from "../../../src/fieldwork/library-checks.js";
import type { ScheduleState } from "../../../src/fieldwork/skill-schedule.js";
import type { RulesState } from "../../../src/fieldwork/rules.js";
import type { InstallProgress } from "../../../src/fieldwork/skill-install.js";
import type { UpdateProgress } from "../../../src/fieldwork/skill-update.js";

type Catalog = typeof operationCatalog;

export type OperationName = keyof Catalog;

/**
 * Result types per operation. Screens add the operations they read by merging
 * into this interface from their own folder, e.g.
 * `declare module "@/api/operations" { interface OperationResults { "pack/read": PackText } }`.
 * Operations without an entry return `unknown`.
 */
export interface OperationResults {
  "kit/state": KitStatus;
  "backup/state": { status: BackupStatus; attention: AttentionItem[]; unpushed: string[]; history?: SaveEntry[]; contents?: BackupContents };
  "rules/state": RulesState;
  "skills/schedule-state": ScheduleState;
  "skills/install-state": InstallProgress | null;
  "skills/update-state": UpdateProgress | null;
}

/** Input types per operation, refined the same way. Without an entry, the keys come from the catalog. */
export interface OperationInputs {
  "backup/state": { brief?: boolean };
}

type CatalogInput<K extends OperationName> = { [P in keyof Catalog[K]["input"]]?: unknown };

export type OperationResult<K extends OperationName> = K extends keyof OperationResults ? OperationResults[K] : unknown;
export type OperationInput<K extends OperationName> = K extends keyof OperationInputs ? OperationInputs[K] : CatalogInput<K>;
