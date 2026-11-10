import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { Ledger, Row } from "@/components/Row";
import { useToast } from "@/components/Toast";
import { FolderBrowser } from "@/screens/settings/FolderBrowser";
import { useSettingsSnapshot } from "@/screens/settings/state";
import type { ProjectStatus } from "@/screens/settings/types";

type Project = { name: string; path: string };

const problems: Record<Exclude<ProjectStatus, "present">, string> = {
  missing: "Project folder not found",
  "not-folder": "This path is not a folder",
  unreadable: "Project folder cannot be read",
};

type Step =
  | { kind: "idle" }
  | { kind: "browse-new" }
  | { kind: "name-new"; path: string }
  | { kind: "browse-existing"; project: Project }
  | { kind: "edit"; project: Project }
  | { kind: "remove"; project: Project };

const basename = (path: string): string => path.split("/").filter(Boolean).pop() ?? "";

export function Projects() {
  const snapshot = useSettingsSnapshot();
  const save = useMutation("project/save");
  const toast = useToast();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const close = () => setStep({ kind: "idle" });

  if (snapshot.error) return <p className="field-error" role="alert">{snapshot.error.message}</p>;
  if (!snapshot.data) return <p className="meta" role="status">Loading projects…</p>;

  const { projects } = snapshot.data.settings;
  const { home, projectStatuses } = snapshot.data;

  const moveFolder = async (project: Project, path: string) => {
    const result = await save.run({ previous: project.name, name: project.name, path });
    close();
    if (result.ok) toast.show("Project folder updated."); else toast.fail(result.error.message);
  };

  return (
    <div className="form-grid">
      {projects.length ? (
        <Ledger label="Projects">
          {projects.map(project => {
            const status = projectStatuses[project.name];
            const problem = status && status !== "present" ? problems[status] : null;
            return (
              <Row
                key={project.name}
                className="project-row"
                title={project.name}
                meta={project.path}
                description={problem ? <span className="field-error" role="status">{problem}</span> : undefined}
                actions={(
                  <>
                    {problem ? <button type="button" aria-label={`Choose folder for ${project.name}`} onClick={() => setStep({ kind: "browse-existing", project })}>Choose folder</button> : null}
                    <button type="button" className="text" aria-label={`Edit ${project.name}`} onClick={() => setStep({ kind: "edit", project })}>Edit</button>
                    <button type="button" className="text" aria-label={`Remove ${project.name}`} onClick={() => setStep({ kind: "remove", project })}>Remove</button>
                  </>
                )}
              />
            );
          })}
        </Ledger>
      ) : <p className="sub">No projects yet.</p>}
      <div className="set-actions"><button type="button" onClick={() => setStep({ kind: "browse-new" })}>Add project</button></div>

      <FolderBrowser open={step.kind === "browse-new"} start={home} onClose={close} onChoose={path => setStep({ kind: "name-new", path })} />
      <FolderBrowser open={step.kind === "browse-existing"} start={home} onClose={close} onChoose={path => step.kind === "browse-existing" && void moveFolder(step.project, path)} />
      {step.kind === "name-new" ? <NameProject path={step.path} taken={projects.map(project => project.name)} onClose={close} /> : null}
      {step.kind === "edit" ? <EditProject project={step.project} onClose={close} /> : null}
      {step.kind === "remove" ? <RemoveProject project={step.project} onClose={close} /> : null}
    </div>
  );
}

function NameProject({ path, taken, onClose }: { path: string; taken: string[]; onClose: () => void }) {
  const save = useMutation("project/save");
  const toast = useToast();
  const [name, setName] = useState(basename(path));
  const [error, setError] = useState("");
  const field = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || taken.includes(trimmed)) {
      setError("Choose a unique project name.");
      field.current?.focus();
      return;
    }
    const result = await save.run({ name: trimmed, path });
    if (!result.ok) { setError(result.error.message); return; }
    onClose();
    toast.show("Project saved. Packs unchanged.");
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title="Name this project"
      description="AFK will manage the skills in this project's repository; changes show up in its Git status."
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="submit" form="name-project" className="primary" disabled={save.pending}>Save project</button></>}
    >
      <form id="name-project" className="form-grid" onSubmit={event => void submit(event)} noValidate>
        <Field label="Project name" error={error}>
          <input ref={field} value={name} onChange={event => setName(event.target.value)} autoComplete="off" />
        </Field>
        <PathLine path={path} />
      </form>
    </Dialog>
  );
}

function PathLine({ path }: { path: string }) {
  return <code className="meta" style={{ overflowWrap: "anywhere" }}>{path}</code>;
}

function EditProject({ project, onClose }: { project: Project; onClose: () => void }) {
  const save = useMutation("project/save");
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await save.run({ previous: project.name, name: name.trim(), path: path.trim() });
    if (!result.ok) { setError(result.error.message); return; }
    onClose();
    toast.show("Project saved. Packs unchanged.");
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title="Edit project"
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="submit" form="edit-project" className="primary" disabled={save.pending}>Save project</button></>}
    >
      <form id="edit-project" className="form-grid" onSubmit={event => void submit(event)} noValidate>
        <Field label="Name"><input value={name} onChange={event => setName(event.target.value)} autoComplete="off" /></Field>
        <Field label="Folder" hint="Turn this project's packs off before changing its folder."><input value={path} onChange={event => setPath(event.target.value)} autoComplete="off" /></Field>
        <p className="field-error" role="alert">{error}</p>
      </form>
    </Dialog>
  );
}

function RemoveProject({ project, onClose }: { project: Project; onClose: () => void }) {
  const remove = useMutation("project/remove");
  const toast = useToast();
  const [error, setError] = useState("");

  const confirm = async () => {
    const result = await remove.run({ name: project.name });
    if (!result.ok) { setError(result.error.message); return; }
    onClose();
    toast.show(`${project.name} removed. Its files were not touched.`);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={`Remove ${project.name}?`}
      description="Removes the project definition from AFK. Project files are never deleted."
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={remove.pending} onClick={() => void confirm()}>Remove project</button></>}
    >
      <p className="field-error" role="alert">{error}</p>
    </Dialog>
  );
}
