import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useOperation } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { Page } from "@/shell/Page";
import { navigate } from "@/shell/router";
import type { AppState, InvocationMode } from "@/screens/skills/api";
import { BulkBar, SelectShown } from "@/screens/skills/BulkBar";
import { SkillDialogs, type DialogRequest } from "@/screens/skills/SkillDialogs";
import { InvocationInfo } from "@/screens/skills/InvocationInfo";
import { filterSkills, fromOptions, globalSkills, isFiltered, noFilters, plural, skillsDescription, type Filters, type Skill } from "@/screens/skills/model";
import { SkillPanel } from "@/screens/skills/SkillPanel";
import { SkillRow, type RowActions } from "@/screens/skills/SkillRow";
import { Toolbar } from "@/screens/skills/Toolbar";
import { useRun } from "@/screens/skills/useRun";
import { useSelection } from "@/screens/skills/useSelection";

function initialFilters(params: URLSearchParams): Filters {
  return { ...noFilters, query: params.get("q") ?? "", from: params.get("from") ?? "all" };
}

function useBackupNotes(): (skill: Skill) => string | undefined {
  const { data } = useOperation("backup/state", { brief: false });
  return (skill: Skill) => {
    if (!data || !skill.entry) return undefined;
    if (data.attention.some(item => item.name === skill.name)) return "Changed outside AFK. Review it in Backup.";
    const backupOn = data.status.state !== "off";
    const unpushed = skill.place === "core" && backupOn && data.unpushed.includes(skill.name);
    return unpushed ? "Saved · not pushed yet" : undefined;
  };
}

export function GlobalSkills({ state, params, scopePicker }: { state: AppState; params: URLSearchParams; scopePicker: ReactNode }) {
  const run = useRun();
  const toast = useToast();
  const [filters, setFilters] = useState(() => initialFilters(params));
  const [panel, setPanel] = useState<{ name: string; focus: "details" | "editor" } | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const backupNote = useBackupNotes();

  const all = useMemo(() => globalSkills(state), [state]);
  const deferred = useDeferredValue(filters);
  const shown = useMemo(() => filterSkills(all, deferred), [all, deferred]);
  const options = useMemo(() => fromOptions(all), [all]);
  const selection = useSelection(all.filter(skill => skill.entry).map(skill => skill.name));

  const filtered = isFiltered(filters);
  const reviewing = filters.from === "review";
  const toReview = all.filter(skill => skill.place === "review").length;
  const showStrip = toReview > 0 && !reviewing;
  const fromValue = options.some(option => option.value === filters.from) ? filters.from : "all";
  const hasSkills = all.length > 0;
  const nothingShown = hasSkills && shown.length === 0;
  const selectable = shown.filter(skill => skill.entry).map(skill => skill.name);
  const panelSkill = panel ? all.find(skill => skill.name === panel.name) : undefined;

  const clear = () => setFilters(noFilters);

  const actions: RowActions = {
    open: (name, focus) => setPanel({ name, focus }),
    setOn: async (skill, on) => {
      const result = await run("skill/availability", { name: skill.name, scope: "Global", enabled: on });
      if (!result.ok) return;
      toast.show(`${skill.name} is ${on ? "on" : "off"}`, { action: { label: "Undo", onAction: () => void run("skill/availability", { name: skill.name, scope: "Global", enabled: !on }) } });
    },
    setMode: async (skill, mode: InvocationMode | "") => {
      const result = await run("invocation", { name: skill.name, scope: "Global", mode });
      if (result.ok) toast.show(mode ? `${skill.name}: ${mode}` : `${skill.name} follows its own default`);
    },
    update: skill => {
      if (skill.place === "tool" && skill.ownerId !== undefined) setDialog({ kind: "tool-update", skill });
      else setDialog({ kind: "update", names: [skill.name], title: `Update ${skill.name}` });
    },
    move: skill => setDialog({ kind: "move", skill }),
    drop: async skill => {
      const from = skill.place === "pack" ? String(skill.ownerId) : "core";
      const result = await run("kit/drop", { name: skill.name, from });
      if (result.ok) toast.show(`${skill.name} dropped from ${skill.place === "pack" ? skill.owner : "Core"}. Its files stay on this machine.`);
    },
    askAgain: async skill => {
      const result = await run("kit/machine-only", { name: skill.name, enabled: false });
      if (result.ok) toast.show(`${skill.name} is back in To review.`);
    },
    install: async skill => {
      toast.show(`Installing ${skill.name}…`, { busy: true });
      const result = await run("kit/install", { source: skill.source, names: [skill.name], to: "core" });
      if (result.ok) toast.show(`${skill.name} is ready on this machine.`);
    },
    resolveDuplicate: skill => setDialog({ kind: "duplicate", name: skill.name, scope: "Global" }),
    remove: skill => setDialog({ kind: "delete", name: skill.name, scope: "Global" }),
  };

  const renderList = () => {
    if (!hasSkills) {
      return (
        <EmptyState title="No skills on this machine yet" actions={<button type="button" className="primary" onClick={() => navigate("sources")}>Add something new</button>}>
          Install skills from a repository or a zip in Sources. They show up here to turn on and off.
        </EmptyState>
      );
    }
    if (nothingShown) {
      const query = filters.query.trim();
      return (
        <EmptyState
          title={query ? `No skill matches “${query}”` : "No skill matches these filters"}
          actions={<><button type="button" onClick={clear}>Clear filters</button><button type="button" onClick={() => navigate("sources")}>Find it in a repository</button></>}
        >
          Search looks at names and descriptions. To get a skill you don’t have yet, install it from a repository or a zip.
        </EmptyState>
      );
    }
    return (
      <>
        <div className="s-cols" aria-hidden="true"><span /><span>Skill</span><span>Comes from</span><span>On</span><span>How it starts</span><span /></div>
        <ul className="slist" aria-label="Skills">
          {shown.map(skill => (
            <SkillRow key={skill.name} skill={skill} selected={selection.has(skill.name)} onSelect={selection.toggle} actions={actions} busy={selection.busy} backupNote={backupNote(skill)} sourceLine />
          ))}
        </ul>
      </>
    );
  };

  return (
    <Page
      title="Skills"
      description={skillsDescription}
      actions={hasSkills ? <button type="button" onClick={() => setDialog({ kind: "update", title: "Update skills" })}>Update all</button> : undefined}
    >
      {scopePicker}
      {showStrip ? (
        <div className="strip">
          <Icon name="alert" />
          <p><b>{plural(toReview, "skill was", "skills were")} installed outside AFK</b> and {toReview === 1 ? "needs" : "need"} a place.</p>
          <button type="button" className="text" onClick={() => setFilters({ ...noFilters, from: "review" })}>{toReview === 1 ? "Show it" : "Show them"}</button>
        </div>
      ) : null}
      <Toolbar filters={{ ...filters, from: fromValue }} fromOptions={options} onChange={setFilters} />
      <div className="list-meta">
        <p aria-live="polite">{filtered ? `Showing ${shown.length} of ${all.length}` : plural(all.length, "skill")}</p>
        {filtered ? <button type="button" className="text" onClick={clear}>Clear filters</button> : null}
        <SelectShown selection={selection} shown={selectable} />
        <span className="spacer" />
        <InvocationInfo />
      </div>
      <BulkBar scope="Global" selection={selection} shown={selectable} onDialog={setDialog} />
      {renderList()}
      {panelSkill ? (
        <SkillPanel
          skill={panelSkill}
          scope="Global"
          focus={panel?.focus ?? "details"}
          actions={actions}
          onClose={() => setPanel(null)}
        />
      ) : null}
      <SkillDialogs request={dialog} onClose={() => setDialog(null)} state={state} selection={selection} />
    </Page>
  );
}
