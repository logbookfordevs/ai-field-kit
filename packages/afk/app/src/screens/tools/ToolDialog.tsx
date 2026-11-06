import { useId, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import type { ToolEntry } from "@/screens/tools/types";
import { useSaveTools } from "@/screens/tools/useTools";

function skillNames(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))];
}

export interface ToolDialogProps {
  /** The tool being edited; omit to add one. */
  tool?: ToolEntry;
  onClose: () => void;
}

/** Add or edit a tool entry. Saving stores the commands; it never runs them. */
export function ToolDialog({ tool, onClose }: ToolDialogProps) {
  const toast = useToast();
  const { save, pending } = useSaveTools();
  const ids = { name: useId(), install: useId(), update: useId(), provides: useId(), nameError: useId(), installError: useId(), providesHint: useId() };
  const nameField = useRef<HTMLInputElement>(null);
  const installField = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(tool?.name ?? "");
  const [install, setInstall] = useState(tool?.install ?? "");
  const [update, setUpdate] = useState(tool?.update ?? "");
  const [provides, setProvides] = useState(tool?.provides?.join(", ") ?? "");
  const [problem, setProblem] = useState<"name" | "install" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const missing = !name.trim() ? "name" : !install.trim() ? "install" : null;
    setProblem(missing);
    if (missing) {
      (missing === "name" ? nameField : installField).current?.focus();
      return;
    }
    const brings = skillNames(provides);
    const entry: ToolEntry = { id: tool?.id ?? Date.now(), name: name.trim(), install: install.trim(), update: update.trim(), ...(brings.length ? { provides: brings } : {}) };
    const error = await save(tools => tool ? tools.map(existing => existing.id === tool.id ? entry : existing) : [...tools, entry]);
    if (error) {
      setFailure(error.message);
      return;
    }
    toast.show("Tool saved. No command was run.");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="wide"
      title={tool ? "Edit tool" : "Add a tool"}
      description="Commands are saved as text. They run only when you press Run."
      canClose={!pending}
      initialFocus={nameField}
      footer={
        <>
          <button type="button" className="text" disabled={pending} onClick={onClose}>Cancel</button>
          <button type="submit" form={ids.name + "-form"} className="primary" disabled={pending}>{pending ? "Saving…" : "Save tool"}</button>
        </>
      }
    >
      <form id={ids.name + "-form"} className="tool-form" noValidate onSubmit={event => void submit(event)}>
        <div className="field">
          <label htmlFor={ids.name}>Name</label>
          <input id={ids.name} ref={nameField} value={name} placeholder="e.g. Skills CLI" aria-invalid={problem === "name" || undefined} aria-describedby={problem === "name" ? ids.nameError : undefined} onChange={event => setName(event.target.value)} />
          {problem === "name" ? <p className="field-error" id={ids.nameError}>Name the tool.</p> : null}
        </div>
        <div className="field">
          <label htmlFor={ids.install}>Install command</label>
          <textarea id={ids.install} ref={installField} value={install} placeholder="npm install -g …" spellCheck={false} aria-invalid={problem === "install" || undefined} aria-describedby={problem === "install" ? ids.installError : undefined} onChange={event => setInstall(event.target.value)} />
          {problem === "install" ? <p className="field-error" id={ids.installError}>Add an install command.</p> : null}
        </div>
        <div className="field">
          <label htmlFor={ids.update}>Update command (optional)</label>
          <textarea id={ids.update} value={update} placeholder="Leave empty to reuse the install command" spellCheck={false} onChange={event => setUpdate(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={ids.provides}>Skills it brings (optional)</label>
          <input id={ids.provides} value={provides} placeholder="skill-one, skill-two" spellCheck={false} aria-describedby={ids.providesHint} onChange={event => setProvides(event.target.value)} />
          <p className="hint" id={ids.providesHint}>Your kit tracks this tool instead of those skills, and updates them with its command.</p>
        </div>
        {failure ? <p className="field-error" role="alert">{failure}</p> : null}
      </form>
    </Dialog>
  );
}
