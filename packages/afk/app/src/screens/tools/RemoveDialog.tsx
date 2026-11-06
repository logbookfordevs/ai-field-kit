import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import type { ToolEntry } from "@/screens/tools/types";
import { useSaveTools } from "@/screens/tools/useTools";

export function RemoveDialog({ tool, onClose }: { tool: ToolEntry; onClose: () => void }) {
  const toast = useToast();
  const { save, pending } = useSaveTools();
  const [failure, setFailure] = useState<string | null>(null);

  const remove = async () => {
    setFailure(null);
    const error = await save(tools => tools.filter(existing => existing.id !== tool.id));
    if (error) {
      setFailure(error.message);
      return;
    }
    toast.show("Entry removed. The installed tool is unchanged.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={`Remove ${tool.name}?`}
      description="This removes the saved entry. It does not uninstall the tool or the skills it installed."
      canClose={!pending}
      footer={
        <>
          <button type="button" className="text" disabled={pending} onClick={onClose}>Cancel</button>
          <button type="button" className="danger-outline" disabled={pending} onClick={() => void remove()}>{pending ? "Removing…" : "Remove entry"}</button>
        </>
      }
    >
      {failure ? <p className="field-error" role="alert">{failure}</p> : <p className="sub">Its commands are no longer saved here.</p>}
    </Dialog>
  );
}
