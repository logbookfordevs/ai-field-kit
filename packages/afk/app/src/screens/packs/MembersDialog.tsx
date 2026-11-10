import { useId, useState } from "react";
import { useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { candidatesFor, groupsFor, type PackView } from "@/screens/packs/model";
import { plural } from "@/text/format";
import type { SkillEntry } from "@/screens/packs/types";

export interface MembersDialogProps {
  /** The pack being edited, or null to create one. */
  pack: PackView | null;
  inventory: readonly SkillEntry[];
  existingNames: readonly string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Problem = { field: "name" | "members"; message: string };

export function MembersDialog({ pack, inventory, existingNames, onClose, onSaved }: MembersDialogProps) {
  const save = useMutation("pack/save");
  const nameId = useId();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(pack?.members.map(member => member.name)));
  const [problem, setProblem] = useState<Problem | null>(null);
  const creating = pack === null;

  const candidates = candidatesFor(inventory, pack?.members ?? []);
  const needle = query.trim().toLowerCase();
  const shown = candidates.filter(candidate =>
    (!selectedOnly || selected.has(candidate.name)) && (!needle || `${candidate.name} ${candidate.description}`.toLowerCase().includes(needle)),
  );
  const nameProblem = problem?.field === "name" ? problem.message : null;
  const membersProblem = problem?.field === "members" ? problem.message : null;
  const saveProblem = save.error?.message ?? null;
  const nothingMatches = shown.length === 0;

  function toggle(skill: string, checked: boolean) {
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(skill); else next.delete(skill);
      return next;
    });
    setProblem(null);
  }

  async function submit() {
    const trimmed = name.trim();
    if (creating && !trimmed) return setProblem({ field: "name", message: "Give the pack a name." });
    if (creating && existingNames.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      return setProblem({ field: "name", message: `There's already a pack called ${trimmed}.` });
    }
    if (selected.size === 0) return setProblem({ field: "members", message: "Choose at least one skill." });
    setProblem(null);
    const groups = groupsFor(pack?.profile ?? null, selected, candidates);
    const packName = pack?.profile.name ?? trimmed;
    const result = await save.run({ ...(pack ? { id: pack.profile.id } : {}), name: packName, groups });
    if (!result.ok) return;
    onSaved(creating ? `Created ${packName} · ${plural(selected.size, "skill")}` : `${packName} · ${plural(selected.size, "skill")}`);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!save.pending}
      title={creating ? "Create a pack" : `Edit ${pack.profile.name}`}
      description={creating ? "Name it, then choose the skills it holds. Nothing downloads until you turn it on." : "Changes apply right away. If the pack is on, it stays on and picks them up."}
      footer={
        <>
          <button type="button" className="text" onClick={onClose} disabled={save.pending}>Cancel</button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={save.pending}>{creating ? "Create pack" : "Save members"}</button>
        </>
      }
    >
      {creating ? (
        <div className="field">
          <label htmlFor={nameId}>Pack name</label>
          <input id={nameId} value={name} autoComplete="off" aria-invalid={nameProblem ? true : undefined} aria-describedby={nameProblem ? `${nameId}-error` : undefined} onChange={event => { setName(event.target.value); setProblem(null); }} />
          {nameProblem ? <p className="field-error" id={`${nameId}-error`} role="alert">{nameProblem}</p> : null}
        </div>
      ) : null}
      <div className="picker-tools">
        <label className="search-wrap">
          <span className="vh">Search skills</span>
          <Icon name="search" size="sm" />
          <input type="search" placeholder="Search skills" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <button type="button" className="toggle-pill" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(only => !only)}>Selected only</button>
      </div>
      <p className="meta num" role="status">{selected.size} selected · showing {shown.length}</p>
      {nothingMatches ? (
        <p className="sub">{query ? `No skill matches “${query}”.` : "No skills to choose from yet."}{selectedOnly ? " Selected only is on." : ""}</p>
      ) : (
        <ul className="pick-list">
          {shown.map(candidate => (
            <li key={candidate.name}>
              <label className="pick">
                <input type="checkbox" checked={selected.has(candidate.name)} onChange={event => toggle(candidate.name, event.target.checked)} />
                <span className="sname">{candidate.name}</span>
                <span className="meta clamp2">{candidate.here ? candidate.description : "Not on this machine. Downloads when the pack turns on."}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {membersProblem ? <p className="field-error" role="alert">{membersProblem}</p> : null}
      {saveProblem ? <p className="field-error" role="alert">{saveProblem}</p> : null}
    </Dialog>
  );
}
