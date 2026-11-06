import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Menu, MenuItem } from "@/components/Menu";
import {
  CANONICAL, currentFile, dirtyFiles, lineCount, missingReferences, newRefName, plural, refKey,
  type Drafts, type RuleFile,
} from "@/screens/rules/model";
import "@/screens/rules/Rules.css";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

export interface WorkbenchProps {
  drafts: Drafts;
  busy: boolean;
  onOpen: (path: string) => void;
  onEdit: (text: string) => void;
  onRevert: () => void;
  onSave: () => void;
  onAddReference: (path?: string) => void;
  onRenameReference: () => void;
  onRemoveReference: () => void;
  onRestoreStash: () => void;
  onDiscardStash: () => void;
}

export function Workbench(props: WorkbenchProps) {
  const { drafts, onOpen, onAddReference } = props;
  const references = drafts.files.filter(file => file.path !== CANONICAL);
  const canonical = drafts.files.find(file => file.path === CANONICAL);
  const folderName = drafts.folder.replace(/\/$/, "").split("/").pop() ?? "";

  const fileButton = (file: RuleFile) => {
    const reference = file.path !== CANONICAL;
    const edited = file.draft !== file.saved;
    return (
      <button key={file.path} type="button" className={reference ? "file-btn ref" : "file-btn"} aria-current={file.path === drafts.current} onClick={() => onOpen(file.path)}>
        <span>{reference ? refKey(file.path) : file.path}</span>
        {edited ? <span className="edited">{file.saved === null ? "new" : "edited"}</span> : null}
      </button>
    );
  };

  return (
    <section className="workbench" aria-label="Rule files">
      <nav className="files" aria-label="Files in the AFK folder">
        <span className="files-label">{folderName}/</span>
        {canonical ? fileButton(canonical) : null}
        <span className="files-label">references/</span>
        {references.map(fileButton)}
        {references.length === 0 ? <p className="hint">No supporting files yet.</p> : null}
        <button type="button" className="text" onClick={() => onAddReference()}>Add reference</button>
      </nav>
      <Editor {...props} />
    </section>
  );
}

interface Suggestion { key?: string; note?: string; add?: true }
interface SuggestState { items: Suggestion[]; index: number; from: number; query: string; total: number }

/** Where the caret sits inside the textarea, measured on a hidden mirror, so the list opens beside what is typed. */
function caretPosition(area: HTMLTextAreaElement, position: number): { x: number; y: number; height: number } {
  const style = getComputedStyle(area);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  mirror.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${area.clientWidth}px;font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};padding:${style.padding}`;
  mirror.textContent = area.value.slice(0, position);
  marker.textContent = "​";
  mirror.append(marker);
  area.parentNode?.append(mirror);
  const found = { x: marker.offsetLeft + area.clientLeft, y: marker.offsetTop + area.clientTop - area.scrollTop, height: marker.offsetHeight };
  mirror.remove();
  return found;
}

function Editor({ drafts, busy, onEdit, onRevert, onSave, onAddReference, onRenameReference, onRemoveReference, onRestoreStash, onDiscardStash }: WorkbenchProps) {
  const file = currentFile(drafts);
  const area = useRef<HTMLTextAreaElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const footId = useId();
  const menuId = useId();
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const [announce, setAnnounce] = useState("");

  const menuOpen = suggest !== null;
  const place = suggest?.from;
  useEffect(() => {
    const field = area.current, list = menu.current;
    if (!field || !list || place === undefined) return;
    const caret = caretPosition(field, place);
    const below = caret.y + caret.height + 4;
    list.style.left = `${Math.max(0, Math.min(caret.x, field.clientWidth - list.offsetWidth))}px`;
    list.style.top = `${below + list.offsetHeight > field.clientHeight && caret.y - list.offsetHeight - 4 >= 0 ? caret.y - list.offsetHeight - 4 : below}px`;
  }, [menuOpen, place, suggest?.items.length]);

  if (!file) return null;
  const canonical = file.path === CANONICAL;
  const dirty = dirtyFiles(drafts);
  const fileEdited = file.draft !== file.saved && file.saved !== null;
  const { used, missing } = missingReferences(drafts, file);
  const shortcut = isMac ? "⌘S" : "Ctrl+S";

  const refresh = () => {
    const field = area.current;
    if (!field || !canonical || field.selectionStart !== field.selectionEnd) { setSuggest(null); return; }
    const hit = field.value.slice(0, field.selectionStart).match(/\{\{([\w.\-/]*)$/);
    if (!hit) { setSuggest(null); return; }
    const query = (hit[1] ?? "").toLowerCase();
    const all = drafts.files.filter(entry => entry.path !== CANONICAL).map(entry => ({ key: refKey(entry.path), note: entry.saved === null ? "New · not saved yet" : (entry.draft.match(/^#+\s*(.+)$/m)?.[1] ?? "Supporting reference") }));
    const items: Suggestion[] = all.filter(entry => entry.key.toLowerCase().includes(query)).sort((a, b) => a.key.toLowerCase().indexOf(query) - b.key.toLowerCase().indexOf(query));
    const found = items.length;
    if (!found) items.push({ add: true });
    setSuggest({ items, index: 0, from: field.selectionStart - (hit[1] ?? "").length - 2, query: hit[1] ?? "", total: all.length });
    setAnnounce(found ? `${plural(found, "reference")} available. Use arrow keys, Enter to insert.` : "No matching reference. Enter adds one.");
  };

  const pick = (index: number) => {
    const field = area.current;
    const item = suggest?.items[index];
    if (!field || !suggest || !item) return;
    const caret = field.selectionStart;
    const remaining = field.value.slice(caret).match(/^[\w.\-/]*[ \t]*\}\}/);
    const end = caret + (remaining ? remaining[0].length : 0);
    const name = item.add ? (suggest.query ? newRefName(suggest.query) : "") : item.key ?? "";
    const text = name ? `{{${name}}}` : "";
    setSuggest(null);
    field.focus();
    field.setRangeText(text, suggest.from, end, "end");
    onEdit(field.value);
    if (item.add) onAddReference(name || undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggest) return;
    const count = suggest.items.length;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setSuggest(null); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSuggest({ ...suggest, index: (suggest.index + (event.key === "ArrowDown" ? 1 : -1) + count) % count });
    } else if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) { event.preventDefault(); pick(suggest.index); }
  };

  const found = suggest?.items.filter(item => !item.add).length ?? 0;

  return (
    <div className="editor">
      {drafts.stash ? (
        <div className="stash" role="status">
          <span>Your previous draft was kept aside · {drafts.stash.when}</span>
          <span className="set-actions"><button type="button" className="text" onClick={onRestoreStash}>Restore previous draft</button><button type="button" className="text" onClick={onDiscardStash}>Discard it</button></span>
        </div>
      ) : null}
      <div className="editor-head">
        <h2>{file.path}</h2>
        <div className="editor-actions">
          {dirty.length ? <span className="status warn" role="status">Unsaved · {plural(dirty.length, "file")}</span> : <span className="status on" role="status">Saved{drafts.savedAt ? ` · ${drafts.savedAt}` : ""}</span>}
          {canonical ? null : (
            <Menu label={`More for ${file.path}`}>
              <MenuItem onSelect={onRenameReference}>Rename</MenuItem>
              <MenuItem onSelect={onRemoveReference} danger>Remove</MenuItem>
            </Menu>
          )}
          <button type="button" className="text" disabled={!fileEdited} onClick={onRevert}>Revert</button>
          <button type="button" disabled={dirty.length === 0 || busy} aria-keyshortcuts={isMac ? "Meta+S" : "Control+S"} onClick={onSave}>
            Save{dirty.length > 1 ? ` ${dirty.length} files` : ""} <kbd aria-hidden="true">{shortcut}</kbd>
          </button>
        </div>
      </div>
      <div className="editor-field">
        <textarea
          ref={area}
          value={file.draft}
          spellCheck={false}
          aria-label={`Contents of ${file.path}`}
          aria-describedby={footId}
          aria-autocomplete="list"
          aria-controls={menuId}
          aria-activedescendant={suggest ? `${menuId}-${suggest.index}` : undefined}
          onChange={event => { onEdit(event.target.value); refresh(); }}
          onKeyDown={onKeyDown}
          onKeyUp={event => { if (/^(Arrow(Left|Right)|Home|End)$/.test(event.key)) refresh(); }}
          onClick={refresh}
          onScroll={() => setSuggest(null)}
          onBlur={() => setTimeout(() => setSuggest(null), 150)}
        />
        <div ref={menu} id={menuId} className="ref-menu" role="listbox" aria-label="Insert a reference" hidden={!suggest} onMouseDown={event => event.preventDefault()}>
          {suggest ? (
            <>
              <span className="label">{found ? "Insert reference" : suggest.total ? "No match" : "No references yet"}</span>
              {found ? null : <p className="hint">{suggest.total ? `Nothing in references/ matches “${suggest.query}”.` : "Supporting files in references/ appear here."}</p>}
              {suggest.items.map((item, index) => (
                <div key={item.key ?? "add"} id={`${menuId}-${index}`} className="ref-opt" role="option" aria-selected={index === suggest.index} onClick={() => pick(index)}>
                  {item.add ? <span>Add {suggest.query ? <code>{newRefName(suggest.query)}</code> : "a reference"}…</span> : <><code>{`{{${item.key}}}`}</code><span className="meta">{item.note}</span></>}
                </div>
              ))}
              <span className="ref-keys" aria-hidden="true">↑↓ choose · Enter insert · Esc close</span>
            </>
          ) : null}
        </div>
        <span className="vh" role="status">{suggest ? announce : ""}</span>
      </div>
      <div className="editor-foot" id={footId}>
        <span className="hint">Markdown · {plural(lineCount(file.draft), "line")} · {canonical ? `${plural(used, "reference")} used` : <>Copied beside each destination · key <code>{`{{${refKey(file.path)}}}`}</code></>}</span>
        {missing.length ? <span className="link-warn" role="status">No file in references/ for {missing.join(", ")} · fix before syncing</span> : <span className="hint">{canonical ? "Type {{ to insert a reference. Each destination gets its own path on sync" : "Edits stay local until you save and sync"}</span>}
      </div>
    </div>
  );
}
