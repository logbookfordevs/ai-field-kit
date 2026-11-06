import type { RulesPreview, RulesState, RulesSyncResult } from "../../../../src/fieldwork/rules.js";

declare module "@/api/operations" {
  interface OperationResults {
    "rules/preview": RulesPreview;
    "rules/sync": RulesSyncResult & { state: RulesState };
    "rules/overwrite": RulesSyncResult & { state: RulesState };
    "rules/adopt": { content: string };
    "rules/existing": { text: string };
  }
}
