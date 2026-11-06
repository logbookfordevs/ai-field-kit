import type { AppState, BulkResult } from "@/screens/skills/api";
import { BulkDeleteDialog, DeleteDialog } from "@/screens/skills/DeleteDialog";
import { DuplicateDialog } from "@/screens/skills/DuplicateDialog";
import type { Skill } from "@/screens/skills/model";
import { MoveDialog } from "@/screens/skills/MoveDialog";
import { BulkResultDialog } from "@/screens/skills/BulkResultDialog";
import { ToolUpdateDialog, UpdateDialog } from "@/screens/skills/UpdateDialog";
import type { Selection } from "@/screens/skills/useSelection";

export type DialogRequest =
  | { kind: "move"; skill: Skill }
  | { kind: "delete"; name: string; scope: string }
  | { kind: "bulk-delete"; names: string[]; scope: string }
  | { kind: "update"; title: string; names?: string[]; scope?: string }
  | { kind: "tool-update"; skill: Skill }
  | { kind: "duplicate"; name: string; scope: string }
  | { kind: "bulk-result"; result: BulkResult; scope: string };

/** The one dialog a Skills list has open at a time. */
export function SkillDialogs({ request, onClose, state, selection }: { request: DialogRequest | null; onClose: () => void; state: AppState; selection: Selection }) {
  if (!request) return null;
  switch (request.kind) {
    case "move": return <MoveDialog skill={request.skill} state={state} onClose={onClose} />;
    case "delete": return <DeleteDialog name={request.name} scope={request.scope} onClose={onClose} />;
    case "bulk-delete": return <BulkDeleteDialog names={request.names} scope={request.scope} selection={selection} onClose={onClose} />;
    case "update": return <UpdateDialog title={request.title} scope={request.scope ?? "Global"} {...(request.names ? { names: request.names } : {})} onClose={onClose} />;
    case "tool-update": return <ToolUpdateDialog skill={request.skill} onClose={onClose} />;
    case "duplicate": return <DuplicateDialog name={request.name} scope={request.scope} onClose={onClose} />;
    case "bulk-result": return <BulkResultDialog result={request.result} scope={request.scope} onClose={onClose} />;
  }
}
