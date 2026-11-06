import type { LibraryInitPlan } from "../../../src/fieldwork/library-init.js";
import type { RestoreSummary } from "../../../src/fieldwork/library-restore.js";
import { Icon } from "@/components/Icon";
import { PathCard } from "@/components/PathCard";
import { Ledger, Row } from "@/components/Row";
import { Tags } from "@/components/Tags";
import { plural as count } from "@/text/format";
import { skillsMoving } from "@/first-run/StartPreview";
import { Count } from "@/components/Count";

function Success({ title }: { title: string }) {
  return (
    <div className="success">
      <span className="tick"><Icon name="check" /></span>
      <h1 tabIndex={-1}>{title}</h1>
    </div>
  );
}

export function Started({ plan, onOpenBackup, onOpenApp }: { plan: LibraryInitPlan; onOpenBackup: () => void; onOpenApp: () => void }) {
  const moved = skillsMoving(plan);
  return (
    <>
      <Success title="Your library is ready" />
      <p className="lede">{moved > 0 ? `${count(moved, "skill")} are in your library and linked for your agents.` : "Your library is empty and ready. Skills you add are saved in it."}</p>
      <div className="paths">
        <PathCard label="Library" path={plan.library} />
        {moved > 0 ? <PathCard label="Originals kept in" path={plan.backup} /> : null}
      </div>
      <p className="sub">Backup is off. Set it up whenever you’re ready; it takes a repository name. The repository must stay private, because skill files are not scanned for secrets.</p>
      {moved > 0 ? <p className="sub">Delete the original folders with <code>afk library confirm</code> once everything works.</p> : null}
      <div className="fr-acts">
        <button type="button" className="primary" onClick={onOpenBackup}>Set up backup</button>
        <button type="button" onClick={onOpenApp}>Open AFK</button>
      </div>
    </>
  );
}

export interface RestoredProps {
  summary: RestoreSummary;
  ran: string[];
  failed: string[];
  onOpenBackup: () => void;
  onOpenApp: () => void;
}

export function Restored({ summary, ran, failed, onOpenBackup, onOpenApp }: RestoredProps) {
  const lines = [`${count(summary.linked.length, "Core skill")} on`, `${count(summary.choices, "choice")} applied`];
  if (ran.length > 0) lines.push(`${count(ran.length, "tool")} ran`);
  const hasAdopted = summary.adopted.length > 0;
  const hasMovedAside = summary.movedAside.length > 0;
  const hasFailures = failed.length > 0;
  const hasPacks = summary.packs.length > 0;

  return (
    <>
      <Success title="Your library is back" />
      <p className="lede">{lines.join(" · ")}</p>
      {hasFailures ? <p className="field-error" role="alert">{failed.map(name => `${name} could not run`).join(", ")}. Run {failed.length === 1 ? "it" : "them"} from Tools to see why.</p> : null}
      {hasMovedAside ? (
        <section className="aside-copies" aria-labelledby="moved-aside">
          <h2 id="moved-aside">Your copy was different<Count n={summary.movedAside.length} className="n" /></h2>
          <p className="sub">The library copy is used. Yours was moved here, so nothing is lost.</p>
          <Ledger label="Moved-aside copies">
            {summary.movedAside.map(move => <Row key={move.name} title={<span className="sname">{move.name}</span>} meta={move.to} />)}
          </Ledger>
        </section>
      ) : null}
      {hasAdopted ? (
        <section className="aside-copies" aria-labelledby="adopted">
          <h2 id="adopted">Already here, now managed<Count n={summary.adopted.length} className="n" /></h2>
          <p className="sub">The files matched the library exactly, so these stay in place.</p>
          <details>
            <summary><Icon name="chev" size="sm" className="chev" />Show names</summary>
            <Tags label="Adopted skills" items={summary.adopted} />
          </details>
        </section>
      ) : null}
      {hasPacks ? <p className="sub">Packs start off. Turning one on downloads its skills.</p> : null}
      <p className="sub">Backup is on: AFK saves 2 minutes after each change.</p>
      <div className="fr-acts">
        <button type="button" className="primary" onClick={onOpenApp}>Open AFK</button>
        <button type="button" onClick={onOpenBackup}>See backup</button>
      </div>
    </>
  );
}
