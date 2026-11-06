import { Dialog } from "@/components/Dialog";
import type { BulkResult } from "@/screens/skills/api";

/** Partial bulk failure: completed changes stay, failed skills stay selected. */
export function BulkResultDialog({ result, scope, onClose }: { result: BulkResult; scope: string; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title="Some skills couldn’t be changed"
      description={`${result.completed} done · ${result.failed} failed · ${scope}. Completed changes are kept; failed skills stay selected.`}
      footer={<button type="button" onClick={onClose}>Close</button>}
    >
      <ul className="delete-list">
        {result.items.filter(item => !item.ok).map(item => (
          <li key={item.name}><span className="sname">{item.name}</span><p className="field-error">{item.error}</p></li>
        ))}
      </ul>
    </Dialog>
  );
}
