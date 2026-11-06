import { useOperation, type Read } from "@/api/hooks";
import type { OperationResult } from "@/api/operations";
import type { Attention } from "@/screens/types";
import "@/screens/overview/operations";

type Kit = OperationResult<"kit/state">;
type Backup = OperationResult<"backup/state">;
export type UndecidedSkill = Kit["undecided"][number];
export type CheckItem = Backup["attention"][number];

export type Need =
  | { kind: "backup-failed"; waiting: number; reason?: string }
  | { kind: "review"; skills: UndecidedSkill[] }
  | { kind: "edited"; item: CheckItem }
  | { kind: "replaced"; item: CheckItem }
  | { kind: "backup-off" };

/** Everything that needs the user, most urgent first. Skills to review are one item however many there are. */
export function needsFrom(kit: Kit, backup: Backup): Need[] {
  const needs: Need[] = [];
  const { undecided } = kit;
  const { status } = backup;
  if (status.state === "failed") needs.push({ kind: "backup-failed", waiting: status.waiting, ...(status.error ? { reason: status.error } : {}) });
  if (undecided.length > 0) needs.push({ kind: "review", skills: undecided });
  for (const item of backup.attention) needs.push({ kind: item.kind === "edited" ? "edited" : "replaced", item });
  if (status.state === "off") needs.push({ kind: "backup-off" });
  return needs;
}

export function attentionFor(needs: Need[]): Attention | null {
  if (needs.length === 0) return null;
  const problem = needs.some(need => need.kind === "backup-failed");
  return { text: needs.length === 1 ? "1 needs you" : `${needs.length} need you`, tone: problem ? "problem" : "attention" };
}

export interface Overview {
  kit: Read<Kit>;
  backup: Read<Backup>;
  setup: Read<OperationResult<"state">>;
  /** null until both reads have succeeded. */
  needs: Need[] | null;
}

export function useOverview(): Overview {
  const kit = useOperation("kit/state");
  const backup = useOperation("backup/state", { brief: true });
  const setup = useOperation("state");
  const needs = kit.data && backup.data ? needsFrom(kit.data, backup.data) : null;
  return { kit, backup, setup, needs };
}

export function useAttention(): Attention | null {
  const { needs } = useOverview();
  return needs ? attentionFor(needs) : null;
}
