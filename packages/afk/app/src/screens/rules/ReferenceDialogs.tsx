import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { mentions, refKey, refPathError, type Drafts } from "@/screens/rules/model";
import { plural } from "@/text/format";

const stripPrefix = (path: string): string => path.trim().replace(/^references\//, "");

interface PathInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  id?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-describedby"?: string | undefined;
}

function PathInput({ value, onChange, inputRef, ...aria }: PathInputProps) {
  return (
    <div className="ref-path">
      <code className="meta" aria-hidden="true">references/</code>
      <input ref={inputRef} value={value} onChange={event => onChange(event.target.value)} placeholder="testing.md" autoComplete="off" {...aria} />
    </div>
  );
}

export function AddReferenceDialog({ drafts, initialPath = "", onAdd, onClose }: { drafts: Drafts; initialPath?: string; onAdd: (input: { path: string; body: string; link: boolean }) => void; onClose: () => void }) {
  const [path, setPath] = useState(initialPath);
  const [body, setBody] = useState("");
  const [link, setLink] = useState(initialPath === "");
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = stripPrefix(path);
    const problem = refPathError(drafts, clean);
    if (problem) { setError(problem); field.current?.focus(); return; }
    onAdd({ path: clean, body, link });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a supporting reference"
      description="AFK folder · references/"
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="submit" form="add-reference" className="primary">Add reference</button></>}
    >
      <form id="add-reference" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Path inside references/" error={error} hint="Subfolders are kept: frontend/forms.md is copied to afk-rules/<destination>/references/frontend/forms.md in each destination.">
          <PathInput value={path} onChange={setPath} inputRef={field} />
        </Field>
        <Field label="Markdown · optional">
          <textarea rows={6} value={body} onChange={event => setBody(event.target.value)} placeholder="Paste existing Markdown, or leave empty to start with a heading" />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={link} onChange={event => setLink(event.target.checked)} />
          <span>Reference it in AGENTS.md<small>Appends its key to the draft, e.g. {"{{testing.md}}"}</small></span>
        </label>
      </form>
    </Dialog>
  );
}

export function RenameReferenceDialog({ drafts, path, onRename, onClose }: { drafts: Drafts; path: string; onRename: (to: string, relink: boolean) => void; onClose: () => void }) {
  const [next, setNext] = useState(refKey(path));
  const [relink, setRelink] = useState(true);
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const count = mentions(drafts, path);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = stripPrefix(next);
    const problem = refPathError(drafts, clean, path);
    if (problem) { setError(problem); field.current?.focus(); return; }
    onRename(clean, relink && count > 0);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename reference"
      description="AFK folder · references/"
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="submit" form="rename-reference" className="primary">Rename</button></>}
    >
      <form id="rename-reference" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Path inside references/" error={error}>
          <PathInput value={next} onChange={setNext} inputRef={field} />
        </Field>
        {count ? (
          <label className="check-row">
            <input type="checkbox" checked={relink} onChange={event => setRelink(event.target.checked)} />
            <span>Update {plural(count, "mention")} in AGENTS.md<small>Changes the draft; save to keep it</small></span>
          </label>
        ) : <p className="hint">AGENTS.md does not mention this file.</p>}
        <p className="hint">On the next sync, destinations get the copy at its new path and the old AFK copy is removed.</p>
      </form>
    </Dialog>
  );
}

export function RemoveReferenceDialog({ path, onRemove, onClose }: { path: string; onRemove: () => void; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={`Remove ${path}?`}
      description="Removes this file from your AFK folder."
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="button" className="primary" onClick={onRemove}>Remove file</button></>}
    >
      <ul className="hint" style={{ margin: 0, paddingLeft: 20 }}>
        <li>Its key <code>{`{{${refKey(path)}}}`}</code> stays in AGENTS.md, is flagged in the editor and blocks sync until it is fixed or removed.</li>
        <li>On the next sync, AFK deletes only the copy it wrote: <code>afk-rules/&lt;destination&gt;/{path}</code>.</li>
        <li>Files AFK did not write are never touched.</li>
      </ul>
    </Dialog>
  );
}
