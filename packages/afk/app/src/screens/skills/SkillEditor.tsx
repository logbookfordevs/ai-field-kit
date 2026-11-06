import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useClient } from "@/api/ClientProvider";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import type { SkillEditorView } from "@/screens/skills/api";
import { Markdown } from "@/screens/skills/Markdown";
import { shortSource } from "@/text/format";
import { useRun } from "@/screens/skills/useRun";

type Pane = "edit" | "preview";

const paneOptions = [{ value: "edit", label: "Plain text" }, { value: "preview", label: "Preview" }] as const;

function updatesNote(view: SkillEditorView): string {
  const from = view.source ? ` from ${shortSource(view.source)}` : "";
  if (view.updates === "ask") return `This skill updates${from}. Saving asks whether to keep your version or let updates replace your edits.`;
  if (view.updates === "replace") return `This skill updates${from}. Updates will replace your edits.`;
  if (view.updates === "stopped") return `You kept your own version. Updates${from} are stopped for this skill.`;
  return "";
}

export interface EditorProps {
  name: string;
  /** Called whenever there are (or stop being) unsaved edits. */
  onDirtyChange: (dirty: boolean) => void;
  /** Shown when the panel refused to close because of unsaved edits. */
  blocked: string;
  textRef: RefObject<HTMLTextAreaElement | null>;
  /** Move focus into the text once SKILL.md has loaded ("Edit files"). */
  focusText?: boolean;
}

/**
 * A stored Global skill's files through `skill/editor`: plain text with a preview, saved one file at a time with `skill/edit`.
 * Read-only files (tool, pack and unmanaged skills) say why. A skill that updates from a repository asks before its first saved edit.
 */
export function SkillEditor({ name, onDirtyChange, blocked, textRef, focusText = false }: EditorProps) {
  const client = useClient();
  const run = useRun();
  const toast = useToast();
  const headingId = useId();
  const hintId = useId();
  const [view, setView] = useState<SkillEditorView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [pane, setPane] = useState<Pane>("edit");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const askRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState("SKILL.md");

  useEffect(() => {
    let live = true;
    void client.run("skill/editor", { name, file }).then(result => {
      if (!live) return;
      if (!result.ok) { setLoadError(result.error.message); return; }
      setLoadError("");
      setView(result.value);
      setSaved(result.value.content ?? "");
      setDraft(result.value.content ?? "");
      setAsking(false);
      setError("");
    });
    return () => { live = false; };
  }, [client, name, file]);

  const loaded = view !== null;
  useEffect(() => {
    if (!loaded || !focusText) return;
    textRef.current?.focus();
    textRef.current?.scrollIntoView?.({ block: "center" });
  }, [loaded, focusText, textRef]);

  useEffect(() => {
    if (asking) askRef.current?.querySelector("button")?.focus();
  }, [asking]);

  const dirty = draft !== saved;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  if (loadError) return <p className="field-error" role="alert">{loadError}</p>;
  if (!view) return <p className="meta" role="status">Opening {name}’s files…</p>;

  const readOnly = view.readOnly !== undefined || view.content === null;
  const markdown = /\.md$/i.test(view.file);
  const showPreview = markdown && pane === "preview";
  const note = readOnly ? "" : updatesNote(view);
  const hasFiles = view.files.length > 1;
  const message = error || blocked;

  const openFile = (next: string) => {
    if (dirty) { setError("Save or revert your edit before opening another file."); return; }
    setFile(next);
  };

  const commit = async (updates?: "keep" | "replace") => {
    setPending(true);
    setAsking(false);
    const result = await run("skill/edit", { name, file: view.file, content: draft, ...(updates ? { updates } : {}) }, { quiet: true });
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    setSaved(draft);
    setError("");
    const next = await client.run("skill/editor", { name, file: view.file });
    if (next.ok) setView(next.value);
    toast.show(`Saved ${name} as one change.`);
  };

  const save = () => {
    if (!dirty || pending) return;
    if (view.updates === "ask") { setAsking(true); return; }
    void commit();
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <h3 id={headingId}>{view.file}</h3>
        {hasFiles ? (
          <label className="editor-file">
            <span className="vh">File</span>
            <select value={view.file} onChange={event => openFile(event.target.value)}>
              {view.files.map(file => <option key={file} value={file}>{file}</option>)}
            </select>
          </label>
        ) : null}
        {markdown ? <Segmented legend="Show the file as" options={paneOptions} value={pane} onChange={setPane} /> : null}
      </div>
      {readOnly ? <p className="note" role="note"><b>Read-only.</b> {view.readOnly ?? "This file isn’t plain text, so it can’t be edited here."}</p> : null}
      {note ? <p className="note" role="note">{note}</p> : null}
      {showPreview ? <Markdown text={draft} /> : (
        <textarea
          ref={textRef}
          aria-labelledby={headingId}
          aria-describedby={hintId}
          rows={14}
          spellCheck={false}
          readOnly={readOnly}
          value={draft}
          onChange={event => { setDraft(event.target.value); setError(""); setAsking(false); }}
        />
      )}
      <p className="hint" id={hintId}>The disable-model-invocation line follows How it starts; saving puts your choice back.</p>
      {readOnly ? null : (
        <div className="editor-acts">
          <button type="button" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save edit"}</button>
          <button type="button" className="text" disabled={!dirty || pending} onClick={() => { setDraft(saved); setError(""); setAsking(false); }}>Revert</button>
          <span className="meta" aria-live="polite">{dirty ? "Unsaved edit" : "Saved"}</span>
        </div>
      )}
      {asking ? (
        <div className="ask" role="group" aria-label="Updates" ref={askRef}>
          <p><b>This skill updates from {view.source ? shortSource(view.source) : "its repository"}.</b> An update would overwrite what you just changed.</p>
          <div className="editor-acts">
            <button type="button" onClick={() => void commit("keep")}>Keep my version</button>
            <button type="button" onClick={() => void commit("replace")}>Let updates replace my edits</button>
            <button type="button" className="text" onClick={() => setAsking(false)}>Cancel</button>
          </div>
          <p className="meta">Keeping your version stops this skill’s updates.</p>
        </div>
      ) : null}
      <p className="field-error" role="alert">{message}</p>
      {readOnly ? null : <p className="meta">Saving makes one library commit, “Edit {name}”, backed up with the next push.</p>}
    </div>
  );
}
