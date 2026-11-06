import { useRef, useState, type FormEvent } from "react";
import type { AgentFolder } from "../../../../src/fieldwork/agent-folders.js";
import { useMutation, useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { Ledger, Row } from "@/components/Row";
import { Switch } from "@/components/Switch";
import { useToast } from "@/components/Toast";
import "@/screens/settings/Settings.css";

const sharedReadersShown = 6;

function AgentIcon({ folder }: { folder: AgentFolder }) {
  if (folder.icon) return <img className="agent-icon" src={`/assets/agent-icons/${folder.icon}`} alt="" width={28} height={28} loading="lazy" />;
  return <span className="agent-icon agent-icon-letter" aria-hidden="true">{(folder.names[0] ?? "?").trim().charAt(0).toUpperCase()}</span>;
}

function readers(names: string[]): string {
  const extra = names.length - sharedReadersShown;
  return `Read by ${names.slice(0, sharedReadersShown).join(", ")}${extra > 0 ? ` and ${extra} more` : ""}`;
}

function AgentGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <h3 className="group-title">{title}</h3>
      <Ledger label={title}>{children}</Ledger>
    </div>
  );
}

export function AgentFolders() {
  const state = useOperation("agent-folders/state");
  const enable = useMutation("agent-folders/enable");
  const disable = useMutation("agent-folders/disable");
  const remove = useMutation("agent-folders/remove");
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const busy = enable.pending || disable.pending || remove.pending;

  if (state.error) return <p className="field-error" role="alert">{state.error.message}</p>;
  if (!state.data) return <p className="meta" role="status">Loading agent folders…</p>;
  if (!state.data.library) return <p className="meta">Start a library first to choose where skills are linked.</p>;

  const folders = state.data.folders;
  const shared = folders.filter(folder => folder.shared);
  const custom = folders.filter(folder => folder.custom);
  const known = folders.filter(folder => !folder.shared && !folder.custom);
  const detected = known.filter(folder => folder.detected);
  const others = known.filter(folder => !folder.detected);
  const hasOthers = others.length > 0;
  const showOthers = showAll && hasOthers;

  const toggle = async (folder: AgentFolder, on: boolean) => {
    const name = folder.names.join(", ");
    const result = on ? await enable.run({ path: folder.path }) : await disable.run({ path: folder.path });
    if (result.ok) toast.show((on ? `Linked skills into ${name}.` : `Removed AFK's links from ${name}.`)); else toast.fail(result.error.message);
  };
  const removeFolder = async (folder: AgentFolder) => {
    const result = await remove.run({ path: folder.path });
    if (result.ok) toast.show(`Removed ${folder.names.join(", ")}.`); else toast.fail(result.error.message);
  };

  const folderRow = (folder: AgentFolder) => {
    const name = folder.names.join(", ");
    return (
      <Row
        key={folder.path}
        title={<span className="agent-title"><AgentIcon folder={folder} /><span className="name">{name}</span></span>}
        meta={<>{folder.path}{folder.project ? ` · projects: ${folder.project}` : ""}{folder.custom ? " · added by you" : ""}</>}
        aside={<Switch label={`Link skills into ${name}`} checked={folder.enabled} disabled={busy} onChange={next => void toggle(folder, next)} />}
        actions={folder.custom ? <button type="button" className="text" disabled={busy} aria-label={`Remove ${name}`} onClick={() => void removeFolder(folder)}>Remove</button> : undefined}
      />
    );
  };

  return (
    <div className="form-grid">
      {shared.length ? (
        <AgentGroup title="Shared folder">
          {shared.map(folder => (
            <Row
              key={folder.path}
              title={<span className="agent-title"><AgentIcon folder={folder} /><span className="name sname">{folder.path}</span></span>}
              description={readers(folder.names)}
              aside={<span className="always-on">Always on</span>}
            />
          ))}
        </AgentGroup>
      ) : null}
      {detected.length ? <AgentGroup title="Detected on this machine">{detected.map(folderRow)}</AgentGroup> : null}
      {custom.length ? <AgentGroup title="Your folders">{custom.map(folderRow)}</AgentGroup> : null}
      {showOthers ? <AgentGroup title="Other known agents">{others.map(folderRow)}</AgentGroup> : null}
      <div className="set-actions">
        {hasOthers ? (
          <button type="button" aria-expanded={showOthers} onClick={() => setShowAll(value => !value)}>
            {showOthers ? "Hide other agents" : `Show all (${others.length} more)`}
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => setAdding(true)}>Add a folder</button>
      </div>
      <p className="hint">Turning a folder off removes only AFK&rsquo;s links there; other files in it stay. Paths come from AFK&rsquo;s agent table, based on Skills CLI&rsquo;s. Saved in your library.</p>
      <AddFolderDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

interface FieldProblem { field: "name" | "global"; message: string }

/** The checks AFK itself would make that need no disk: a name, and a path from the root or from ~/. */
function checkFolder(name: string, global: string): FieldProblem | null {
  if (!name.trim()) return { field: "name", message: "Give the folder a name." };
  const path = global.trim();
  if (!path) return { field: "global", message: "Enter the agent's global skills folder." };
  if (!path.startsWith("/") && !path.startsWith("~/")) return { field: "global", message: "Use an absolute path or one starting with ~/." };
  return null;
}

function AddFolderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useMutation("agent-folders/add");
  const toast = useToast();
  const [name, setName] = useState("");
  const [global, setGlobal] = useState("");
  const [project, setProject] = useState("");
  const [problem, setProblem] = useState<FieldProblem | null>(null);
  const [serverError, setServerError] = useState("");
  const nameField = useRef<HTMLInputElement>(null);
  const globalField = useRef<HTMLInputElement>(null);

  const close = () => {
    setName(""); setGlobal(""); setProject(""); setProblem(null); setServerError("");
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = checkFolder(name, global);
    setProblem(found);
    setServerError("");
    if (found) {
      (found.field === "name" ? nameField : globalField).current?.focus();
      return;
    }
    const trimmedProject = project.trim();
    const result = await add.run({ name, global, ...(trimmedProject ? { project: trimmedProject } : {}) });
    if (!result.ok) { setServerError(result.error.message); return; }
    close();
    toast.show("Folder added and linked.");
  };

  const nameError = problem?.field === "name" ? problem.message : "";
  const globalError = problem?.field === "global" ? problem.message : "";

  return (
    <Dialog
      open={open}
      onClose={close}
      variant="small"
      title="Add a folder"
      description="For an agent AFK doesn't know. It is switched on and every skill that is on is linked into it."
      footer={<><button type="button" className="text" onClick={close}>Cancel</button><button type="submit" form="add-agent-folder" className="primary" disabled={add.pending}>Add folder</button></>}
    >
      <form id="add-agent-folder" className="form-grid" onSubmit={event => void submit(event)} noValidate>
        <Field label="Name" error={nameError}>
          <input ref={nameField} value={name} onChange={event => setName(event.target.value)} autoComplete="off" placeholder="Team agent" />
        </Field>
        <Field label="Global skills folder" error={globalError}>
          <input ref={globalField} value={global} onChange={event => setGlobal(event.target.value)} autoComplete="off" placeholder="~/.team-agent/skills" />
        </Field>
        <Field label="Project skills folder (optional)">
          <input value={project} onChange={event => setProject(event.target.value)} autoComplete="off" placeholder=".team-agent/skills" />
        </Field>
        <p className="hint">Use an absolute path or one starting with ~/. It cannot be inside AFK&rsquo;s library.</p>
        <p className="field-error" role="alert">{serverError}</p>
      </form>
    </Dialog>
  );
}
