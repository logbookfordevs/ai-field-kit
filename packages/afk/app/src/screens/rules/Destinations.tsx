import { useRef, useState, type FormEvent } from "react";
import type { RulesDestinationState } from "../../../../src/fieldwork/rules.js";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { Menu, MenuItem } from "@/components/Menu";
import { plural } from "@/text/format";
import { Status } from "@/screens/rules/Status";
import "@/screens/rules/Rules.css";

type Destination = RulesDestinationState;

const dateLabel = (value: string | undefined): string => value ? new Date(value).toLocaleString() : "Never";

export interface DestinationsProps {
  destinations: Destination[];
  selected: (destination: Destination) => boolean;
  summary: string;
  lastRun: string;
  errors: string[];
  canSync: boolean;
  syncLabel: string;
  onSelect: (id: string, on: boolean) => void;
  onSync: () => void;
  onCheck: () => void;
  onPreview: (id: string) => void;
  onReview: (id: string) => void;
  onEdit: (id?: string) => void;
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
}

export function Destinations(props: DestinationsProps) {
  const { destinations } = props;
  return (
    <section className="dest-section" aria-labelledby="destinations-title">
      <div className="dest-head">
        <h2 id="destinations-title">Destinations</h2>
        <span className="meta">{plural(destinations.length, "file")} on this machine</span>
      </div>
      <div className="dest-bar">
        <div>
          <p className="sub" aria-live="polite">{props.summary}</p>
          {props.lastRun ? <p className="meta">{props.lastRun}</p> : null}
        </div>
        <button type="button" className="primary" disabled={!props.canSync} onClick={props.onSync}>{props.syncLabel}</button>
      </div>
      <p className="field-error" role="alert">{props.errors.join(" ")}</p>
      <ul className="dest-list" aria-label="Destination files">
        {destinations.map(destination => <DestinationRow key={destination.id} destination={destination} {...props} />)}
      </ul>
      <div className="dest-add">
        <button type="button" onClick={() => props.onEdit()}>Add custom destination</button>
        <button type="button" className="text" onClick={props.onCheck}>Check destinations</button>
        <span className="hint">Choose a file path, such as ~/Projects/my-project/AGENTS.md.</span>
      </div>
    </section>
  );
}

function DestinationRow({ destination: d, selected, onSelect, onPreview, onReview, onEdit, onDisconnect, onReconnect }: DestinationsProps & { destination: Destination }) {
  const managed = d.status !== "off";
  const custom = d.kind === "custom";
  const conflict = d.status === "conflict";
  const editable = d.kind !== "codex";
  return (
    <li className={managed ? "dest-row" : "dest-row off"}>
      <label className="dest-sel">
        <input type="checkbox" checked={selected(d) && managed} disabled={!managed} onChange={event => onSelect(d.id, event.target.checked)} aria-label={`Include ${d.name} in sync`} />
      </label>
      <div className="dest-name">
        <h3>{d.name}</h3>
        <code>{d.path}</code>
        <span className="meta">{custom ? "Custom rules file" : "Global agent rules"}{d.claudeMdImport ? " · Imported via CLAUDE.md" : ""}</span>
      </div>
      <div className="dest-status">
        <Status status={d.status} />
        {d.reason ? <span className="hint">{d.reason}</span> : null}
      </div>
      <div className="dest-last">
        <span className="meta">{dateLabel(d.lastSync)}</span>
        <span className="hint">{d.lastSync ? "Last successful sync" : "No sync yet"}</span>
      </div>
      <div className="dest-actions">
        {managed ? (
          <>
            {conflict ? <button type="button" aria-label={`Review conflict for ${d.name}`} onClick={() => onReview(d.id)}>Review conflict</button> : <button type="button" className="text" aria-label={`Preview ${d.name}`} onClick={() => onPreview(d.id)}>Preview</button>}
            <Menu label={`More for ${d.name}`}>
              {editable ? <MenuItem onSelect={() => onEdit(d.id)}>Edit</MenuItem> : null}
              <MenuItem onSelect={() => onDisconnect(d.id)} danger>{custom ? "Remove" : "Disconnect"}</MenuItem>
            </Menu>
          </>
        ) : <button type="button" className="text" aria-label={`Reconnect ${d.name}`} onClick={() => onReconnect(d.id)}>Reconnect</button>}
      </div>
    </li>
  );
}

export interface DestinationInput { id?: string; name: string; path: string; kind: Destination["kind"]; claudeMdImport?: true }

export function DestinationDialog({ destination, error, busy, onSave, onClose }: { destination?: Destination | undefined; error: string; busy: boolean; onSave: (input: DestinationInput) => void; onClose: () => void }) {
  const builtIn = destination !== undefined && destination.kind !== "custom";
  const locked = Boolean(destination?.lastSync);
  const offersImport = !destination || destination.kind !== "codex";
  const [name, setName] = useState(destination?.name ?? "");
  const [path, setPath] = useState(destination?.path ?? "");
  const [importOn, setImportOn] = useState(destination?.claudeMdImport === true);
  const [problem, setProblem] = useState("");
  const nameField = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = path.trim();
    if (!name.trim() || !/^(\/|~\/)/.test(trimmed) || trimmed.endsWith("/")) {
      setProblem("Enter a name and an absolute file path beginning with / or ~/.");
      nameField.current?.focus();
      return;
    }
    setProblem("");
    onSave({ ...(destination ? { id: destination.id } : {}), name: name.trim(), path: trimmed, kind: destination?.kind ?? "custom", ...(importOn ? { claudeMdImport: true as const } : {}) });
  };

  const pathHint = builtIn ? "Built-in destinations keep their name and path." : locked ? "Disconnect this file before changing its path." : "Choose a file, not a folder. Existing text stays outside the AFK region.";

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={destination ? "Edit destination" : "Add a custom destination"}
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="submit" form="destination" className="primary" disabled={busy}>Save destination</button></>}
    >
      <form id="destination" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Name"><input ref={nameField} value={name} maxLength={80} readOnly={builtIn} placeholder="My agent" onChange={event => setName(event.target.value)} /></Field>
        <Field label="Absolute file path" hint={pathHint}><input value={path} readOnly={locked || builtIn} placeholder="~/Projects/my-project/AGENTS.md" onChange={event => setPath(event.target.value)} /></Field>
        {offersImport ? (
          <label className="check-row">
            <input type="checkbox" checked={importOn} onChange={event => setImportOn(event.target.checked)} />
            <span>Import through CLAUDE.md<small>Makes Claude load these rules everywhere, including projects with their own CLAUDE.md and apps that skip AGENTS.md. Adds an @AGENTS.md import to the CLAUDE.md beside this file. Applied on the next sync.</small></span>
          </label>
        ) : null}
        <p className="field-error" role="alert">{problem || error}</p>
      </form>
    </Dialog>
  );
}

export function DisconnectDialog({ destination, error, busy, onDisconnect, onClose }: { destination: Destination; error: string; busy: boolean; onDisconnect: (clean: boolean) => void; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${destination.kind === "custom" ? "Remove" : "Disconnect"} ${destination.name}?`}
      description={<>Stop managing <code>{destination.path}</code>. Its file and text outside AFK&rsquo;s region stay in place.</>}
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="button" disabled={busy} onClick={() => onDisconnect(false)}>Stop managing only</button><button type="button" className="primary" disabled={busy} onClick={() => onDisconnect(true)}>Remove AFK content</button></>}
    >
      <p className="sub">Remove AFK content deletes only the managed region and reference copies AFK owns. Conflicting or broken regions require repair first.</p>
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}
