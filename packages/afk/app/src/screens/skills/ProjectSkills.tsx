import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { Page } from "@/shell/Page";
import { navigate } from "@/shell/router";
import type { AppState } from "@/screens/skills/api";
import { BulkBar, SelectShown } from "@/screens/skills/BulkBar";
import { InvocationInfo } from "@/screens/skills/InvocationInfo";
import { filterSkills, isFiltered, noFilters, projectSkills, skillsDescription, type Skill } from "@/screens/skills/model";
import { plural, shortSource } from "@/text/format";
import { SharingDialog } from "@/screens/skills/SharingDialog";
import { SkillDialogs, type DialogRequest } from "@/screens/skills/SkillDialogs";
import { SkillPanel } from "@/screens/skills/SkillPanel";
import { modeOptions, unavailable, updateBlocked, type RowActions } from "@/screens/skills/SkillRow";
import { Toolbar } from "@/screens/skills/Toolbar";
import { useRun } from "@/screens/skills/useRun";
import { useSelection, type Selection } from "@/screens/skills/useSelection";

function ProjectRow({ skill, selection, actions }: { skill: Skill; selection: Selection; actions: RowActions }) {
  const nested = Boolean(skill.folder);
  const blocked = updateBlocked(skill);
  const hasDuplicate = Boolean(skill.entry?.duplicate);
  const hasDrift = Boolean(skill.drift);
  const where = nested ? `${skill.folder}/` : skill.source ? shortSource(skill.source) : "No repository";
  return (
    <li className="srow project">
      <div className="s-pick">
        {nested ? null : <input type="checkbox" aria-label={`Select ${skill.name}`} checked={selection.has(skill.name)} disabled={selection.busy} onChange={event => selection.toggle(skill.name, event.target.checked)} />}
      </div>
      <div className="s-main">
        <button type="button" className="s-name" onClick={() => actions.open(skill.name, "details")}>{skill.name}</button>
        {skill.description ? <p className="s-desc clamp1">{skill.description}</p> : null}
        {hasDuplicate ? <p className="s-note warn">Two copies in this project. <button type="button" className="text" onClick={() => actions.resolveDuplicate(skill)}>Resolve…</button></p> : null}
        {hasDrift ? <p className="s-note warn">Files differ from your choice. <button type="button" className="text" onClick={() => actions.setMode(skill, skill.drift ?? "")}>Reapply</button></p> : null}
      </div>
      <div className="s-from"><span className="src" title={where}>{where}</span></div>
      <div className="s-inv">
        {nested
          ? <span className="meta">{skill.mode ?? "Varies"} · managed outside AFK</span>
          : <Segmented legend={`How ${skill.name} starts`} options={modeOptions} value={skill.mode} disabled={selection.busy} onChange={mode => actions.setMode(skill, mode)} />}
      </div>
      <div className="s-more">
        <Menu label={`More for ${skill.name}`}>
          <MenuItem onSelect={() => actions.open(skill.name, "details")}>Inspect</MenuItem>
          {nested ? null : <MenuItem onSelect={() => actions.update(skill)} {...unavailable(blocked)}>Update</MenuItem>}
          {nested ? null : <MenuSeparator />}
          {nested ? null : <MenuItem danger onSelect={() => actions.remove(skill)}>Delete…</MenuItem>}
        </Menu>
      </div>
    </li>
  );
}

/** A project's own skills, managed in its repository as before: invocation, update, delete and Claude sharing. */
export function ProjectSkills({ state, scope, scopePicker }: { state: AppState; scope: string; scopePicker: ReactNode }) {
  const run = useRun();
  const toast = useToast();
  const [filters, setFilters] = useState(noFilters);
  const [panel, setPanel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [sharing, setSharing] = useState(false);

  const { own, nested } = useMemo(() => projectSkills(state, scope), [state, scope]);
  const deferred = useDeferredValue(filters);
  const shown = useMemo(() => filterSkills(own, deferred), [own, deferred]);
  const shownNested = useMemo(() => filterSkills(nested, deferred), [nested, deferred]);
  const selection = useSelection(own.map(skill => skill.name));
  const panelSkill = panel ? [...own, ...nested].find(skill => skill.name === panel) : undefined;
  const filtered = isFiltered(filters);
  const hasOwn = own.length > 0;
  const hasNested = shownNested.length > 0;
  const nothingShown = !shown.length && !hasNested;
  const missingFolder = state.projectStatuses[scope] !== "present";
  const sharingStatus = state.skillSharing[scope]?.status;
  const sharingText = sharingStatus === "connected" ? "Claude shares this project’s skills folder." : sharingStatus === "conflict" ? "Claude’s skills folder needs attention." : "Claude doesn’t see this project’s skills folder.";

  const actions: RowActions = {
    open: name => setPanel(name),
    setOn: () => {},
    setMode: async (skill, mode) => {
      const result = await run("invocation", { name: skill.name, scope, mode });
      if (result.ok) toast.show(mode ? `${skill.name}: ${mode} in ${scope}` : `${skill.name} follows its default in ${scope}`);
    },
    update: skill => setDialog({ kind: "update", names: [skill.name], title: `Update ${skill.name}`, scope }),
    move: () => {},
    drop: () => {},
    askAgain: () => {},
    install: () => {},
    resolveDuplicate: skill => setDialog({ kind: "duplicate", name: skill.name, scope }),
    remove: skill => setDialog({ kind: "delete", name: skill.name, scope }),
  };

  const renderList = () => {
    if (missingFolder) return <EmptyState title="This project’s folder is missing">Its folder isn’t on this machine. Fix its path in Settings.</EmptyState>;
    if (!hasOwn && !nested.length) {
      return (
        <EmptyState title="This project has no skills of its own yet" actions={<button type="button" onClick={() => navigate("sources")}>Add something new</button>}>
          Install skills into this project to keep them with its repository. Global skills still reach agents working here.
        </EmptyState>
      );
    }
    if (nothingShown) return <EmptyState title="No skill matches these filters" actions={<button type="button" onClick={() => setFilters(noFilters)}>Clear filters</button>}>Search looks at names and descriptions.</EmptyState>;
    return (
      <>
        {shown.length ? (
          <ul className="slist" aria-label={`Skills in ${scope}`}>
            {shown.map(skill => <ProjectRow key={skill.name} skill={skill} selection={selection} actions={actions} />)}
          </ul>
        ) : null}
        {hasNested ? (
          <section aria-labelledby="nested-h" className="nested">
            <h2 id="nested-h">In subfolders</h2>
            <p className="sub">Kept inside folders of this project’s skills folder, usually by another app. AFK shows them; whatever manages the folder changes them.</p>
            <ul className="slist" aria-label="Skills in subfolders">
              {shownNested.map(skill => <ProjectRow key={`${skill.folder}/${skill.name}`} skill={skill} selection={selection} actions={actions} />)}
            </ul>
          </section>
        ) : null}
      </>
    );
  };

  return (
    <Page
      title="Skills"
      description={skillsDescription}
      actions={hasOwn ? <button type="button" onClick={() => setDialog({ kind: "update", title: `Update skills in ${scope}`, scope })}>Update all</button> : undefined}
    >
      {scopePicker}
      <div className="strip quiet">
        <p>{sharingText}</p>
        <button type="button" className="text" onClick={() => setSharing(true)}>Claude sharing…</button>
      </div>
      <Toolbar filters={filters} onChange={setFilters} />
      <div className="list-meta">
        <p aria-live="polite">{filtered ? `Showing ${shown.length} of ${own.length}` : plural(own.length, "skill")}</p>
        {filtered ? <button type="button" className="text" onClick={() => setFilters(noFilters)}>Clear filters</button> : null}
        <SelectShown selection={selection} shown={shown.map(skill => skill.name)} />
        <span className="spacer" />
        <InvocationInfo />
      </div>
      <BulkBar scope={scope} selection={selection} shown={shown.map(skill => skill.name)} onDialog={setDialog} />
      {renderList()}
      {panelSkill ? <SkillPanel skill={panelSkill} scope={scope} focus="details" actions={actions} onClose={() => setPanel(null)} /> : null}
      <SkillDialogs request={dialog} onClose={() => setDialog(null)} state={state} selection={selection} />
      {sharing ? <SharingDialog scope={scope} onClose={() => setSharing(false)} /> : null}
    </Page>
  );
}
