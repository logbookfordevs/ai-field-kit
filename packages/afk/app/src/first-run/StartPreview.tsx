import type { LibraryInitPlan } from "../../../src/fieldwork/library-init.js";
import { useOperation } from "@/api/hooks";
import { Icon } from "@/components/Icon";
import { PathCard } from "@/components/PathCard";
import { Progress } from "@/components/Progress";
import { NameGroups, type NameGroupData } from "@/first-run/NameGroups";
import { placeDefinitions } from "@/text/places";

const named = (entries: readonly { name: string }[]): string[] => entries.map(entry => entry.name);

function groupsOf(plan: LibraryInitPlan): NameGroupData[] {
  return [
    { key: "core", title: "Core skills", description: placeDefinitions.core, names: named(plan.skills) },
    { key: "pack", title: "Pack skills", description: placeDefinitions.pack, names: named(plan.packSkills) },
    { key: "machine", title: "This machine only", description: placeDefinitions.machine, names: named([...plan.machineSkills, ...plan.offToolSkills]) },
    { key: "tool", title: "Tool skills", description: "Stay with the tools that install them. AFK keeps your Manual/Automatic choices.", names: plan.toolSkills },
    { key: "missing", title: "Missing from this machine", description: "In Core but not installed here, so they are skipped.", names: plan.missing },
    { key: "rules", title: "Agent rules", description: "Copied into the library.", names: plan.rules },
  ];
}

export function skillsMoving(plan: LibraryInitPlan): number {
  return plan.skills.length + plan.packSkills.length + plan.machineSkills.length + plan.offToolSkills.length;
}

function Summary({ plan }: { plan: LibraryInitPlan }) {
  const moving = skillsMoving(plan);
  if (moving === 0) return <p className="summary">No skills to move yet. The library starts empty.</p>;
  const staying = plan.toolSkills.length;
  return (
    <p className="summary">
      <b>{moving} skills</b> move into your library and stay linked where your agents look.
      {staying > 0 ? <> <b>{staying}</b> stay with their tools.</> : null} Nothing is deleted.
    </p>
  );
}

/** What starting a library would do, read-only until the person confirms. */
export function StartPreview({ problem, onBack, onStart }: { problem: string; onBack: () => void; onStart: (plan: LibraryInitPlan) => void }) {
  const preview = useOperation("library/init-preview");
  const plan = preview.data;

  return (
    <>
      <button type="button" className="text back" onClick={onBack}><Icon name="back" size="sm" />Back</button>
      <div><h1 tabIndex={-1}>Start your library</h1></div>
      {preview.loading ? <div role="status"><Progress label="Checking this machine’s skills. Nothing changes yet." /></div> : null}
      {preview.error && !plan ? (
        <>
          <p className="field-error" role="alert">{preview.error.message}</p>
          <div className="fr-acts"><button type="button" onClick={() => void preview.reload()}>Try again</button></div>
        </>
      ) : null}
      {plan ? (
        <>
          <Summary plan={plan} />
          <NameGroups groups={groupsOf(plan)} />
          <div className="paths">
            <PathCard label="Library" path={plan.library} />
            {skillsMoving(plan) > 0 ? <PathCard label="Originals kept in" path={plan.backup} /> : null}
          </div>
          <p className="sub">Backup stays off until you connect a repository on the Backup page.</p>
          {problem ? <p className="field-error" role="alert">{problem}</p> : null}
          <div className="fr-acts">
            <button type="button" className="primary" onClick={() => onStart(plan)}>Start the library</button>
            <button type="button" className="text" onClick={onBack}>Back</button>
          </div>
        </>
      ) : null}
    </>
  );
}

export function Starting() {
  return (
    <>
      <div><h1 tabIndex={-1}>Starting your library</h1></div>
      <div role="status"><Progress label="Moving skills into the library and linking them back…" /></div>
      <p className="sub">Nothing is lost if this stops. The original folders are kept until you delete them.</p>
    </>
  );
}
