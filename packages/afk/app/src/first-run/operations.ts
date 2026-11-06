import type { LibraryInitPlan } from "../../../src/fieldwork/library-init.js";
import type { LibraryPreview, RepositoryChoice, RestoreSummary } from "../../../src/fieldwork/library-restore.js";
import type { ToolRunResult } from "../../../src/fieldwork/tool-run.js";

declare module "@/api/operations" {
  interface OperationResults {
    "library/init-preview": LibraryInitPlan;
    "library/init": LibraryInitPlan;
    "restore/repositories": RepositoryChoice[];
    "restore/inspect": LibraryPreview;
    "restore/start": RestoreSummary;
    "tool/run": ToolRunResult;
  }
}
