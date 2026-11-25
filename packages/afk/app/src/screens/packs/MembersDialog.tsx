import { useId, useRef, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useMutation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { candidatesFor, groupsFor, type FoundRepository, type PackView } from "@/screens/packs/model";
import { defaultBookmarkName, isValidSource } from "@/screens/sources/format";
import { plural, shortSource } from "@/text/format";
import type { FavoriteSource, SkillEntry } from "@/screens/packs/types";

export interface MembersDialogProps {
  /** The pack being edited, or null to create one. */
  pack: PackView | null;
  inventory: readonly SkillEntry[];
  /** Bookmarked repositories, offered as shortcuts for finding skills that aren't on this machine. */
  bookmarks?: readonly FavoriteSource[];
  existingNames: readonly string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Problem = { field: "name" | "members"; message: string };

export function MembersDialog({ pack, inventory, bookmarks = [], existingNames, onClose, onSaved }: MembersDialogProps) {
  const client = useClient();
  const save = useMutation("pack/save");
  const nameId = useId();
  const repositoryId = useId();
  const [repository, setRepository] = useState("");
  const [finding, setFinding] = useState(false);
  const [findProblem, setFindProblem] = useState<string | null>(null);
  const [found, setFound] = useState<FoundRepository[]>([]);
  const findVersion = useRef(0);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(pack?.members.map(member => member.name)));
  const [problem, setProblem] = useState<Problem | null>(null);
  const creating = pack === null;

  const candidates = candidatesFor(inventory, pack?.members ?? [], found);
  const repositoryNames = new Map(found.map(item => [item.source, item.name]));
  const lastFound = found.at(-1) ?? null;
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

  function bookmarkName(source: string): string {
    return bookmarks.find(bookmark => bookmark.source === source)?.name ?? defaultBookmarkName(source);
  }

  async function find(reference: string) {
    const source = reference.trim();
    if (!isValidSource(source)) return setFindProblem("Enter a repository, like owner/repository.");
    const mine = ++findVersion.current;
    setRepository(source);
    setFindProblem(null);
    setFinding(true);
    const result = await client.run("discover", { source });
    if (mine !== findVersion.current) return;
    setFinding(false);
    if (!result.ok) return setFindProblem(result.error.message);
    const { names, descriptions = {} } = result.value;
    if (!names.length) return setFindProblem(`No skills were found in ${shortSource(source)}.`);
    const skills = names.map(name => ({ name, description: descriptions[name] ?? "" }));
    setFound(current => [...current.filter(item => item.source !== source), { source, name: bookmarkName(source), skills }]);
    setQuery("");
    setSelectedOnly(false);
  }

  function noteFor(candidate: { here: boolean; source: string; description: string }): string {
    if (candidate.here) return candidate.description;
    const from = repositoryNames.get(candidate.source);
    if (!from) return "Not on this machine. Downloads when the pack turns on.";
    const note = `From ${from}. Downloads when the pack turns on.`;
    return candidate.description ? `${candidate.description} · ${note}` : note;
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
    const namedSources = Object.fromEntries(groups.filter(group => repositoryNames.has(group.source)).map(group => [group.source, repositoryNames.get(group.source)!]));
    const sourceNames = Object.keys(namedSources).length ? { sourceNames: { ...pack?.profile.sourceNames, ...namedSources } } : {};
    const result = await save.run({ ...(pack ? { id: pack.profile.id } : {}), name: packName, groups, ...sourceNames });
    if (!result.ok) return;
    onSaved(creating ? `Created ${packName} · ${plural(selected.size, "skill")}` : `${packName} · ${plural(selected.size, "skill")}`);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      canClose={!save.pending}
      title={creating ? "Create a pack" : `Edit ${pack.profile.name}`}
      description={creating ? "Name it, then choose the skills it holds, from this machine or from a repository. Nothing downloads until you turn it on." : "Changes apply right away. If the pack is on, it stays on and picks them up."}
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
      <div className="field">
        <label htmlFor={repositoryId}>Find skills in a repository</label>
        <div className="repo-find">
          <input
            id={repositoryId}
            value={repository}
            placeholder="owner/repository or URL"
            autoComplete="off"
            aria-invalid={findProblem ? true : undefined}
            aria-describedby={`${repositoryId}-hint`}
            onChange={event => { setRepository(event.target.value); setFindProblem(null); }}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void find(repository);
            }}
          />
          <button type="button" disabled={finding} onClick={() => void find(repository)}>{finding ? "Finding…" : "Find skills"}</button>
        </div>
        {bookmarks.length ? (
          <div className="bookmark-picks" role="group" aria-label="Bookmarked repositories">
            {bookmarks.map(bookmark => (
              <button key={bookmark.source} type="button" className="toggle-pill" disabled={finding} onClick={() => void find(bookmark.source)}>{bookmark.name}</button>
            ))}
          </div>
        ) : null}
        <p className="hint" id={`${repositoryId}-hint`}>Add skills you don’t have yet. Nothing downloads until the pack turns on.</p>
        {finding ? <p className="meta" role="status">Looking for skills in {shortSource(repository)}…</p> : null}
        {!finding && lastFound ? <p className="meta" role="status">Found {plural(lastFound.skills.length, "skill")} in {lastFound.name}. They’re in the list below.</p> : null}
        {findProblem ? <p className="field-error" role="alert">{findProblem}</p> : null}
      </div>
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
                <span className="meta clamp2">{noteFor(candidate)}</span>
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
