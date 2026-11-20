import { useId } from "react";
import { discoveryEstimate, type Skill } from "@/screens/skills/model";
import { plural } from "@/text/format";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const AGENTS = [
  { key: "claude", label: "Claude", overCap: "Claude Code shortens descriptions." },
  { key: "codex", label: "Codex", overCap: "Codex shortens descriptions, then drops them, then leaves skills out." },
] as const;

/** How many characters Claude and Codex spend up front on the skills that may start automatically, against each skill list's cap. */
export function DiscoveryEstimate({ skills }: { skills: Skill[] }) {
  const id = useId();
  const estimates = AGENTS.map(agent => ({ ...agent, ...discoveryEstimate(skills, agent.key) }));
  const anyOverCap = estimates.some(estimate => estimate.chars > estimate.cap);
  const summary = estimates.map(({ label, chars, cap }) => `${label} ${compact.format(chars)}/${compact.format(cap)}`).join(" · ");

  return (
    <span className="inv-info">
      <button type="button" className={anyOverCap ? "text warn" : "text"} popoverTarget={id}>
        Discovery: {summary} chars
      </button>
      <div id={id} className="inv-pop" popover="auto" role="note">
        {estimates.map(({ key, label, overCap, count, chars, cap }) => {
          const isOverCap = chars > cap;

          return (
            <div key={key} className="discovery-agent">
              <p><b>{label}</b>: {chars.toLocaleString()} of {cap.toLocaleString()} characters from {plural(count, "automatic skill")}.</p>
              <meter min={0} max={cap} low={cap * 0.9} high={cap} optimum={0} value={chars} aria-label={`${label} skill list`} />
              {isOverCap ? <p className="s-note warn">Over the cap. {overCap}</p> : null}
            </div>
          );
        })}
        <p className="meta">Agents read the name and description of every skill that is on and may start automatically. Manual only skills, full instructions and supporting files are left out. The cap is each agent’s default when the context window is unknown; larger windows fit more. Filters don’t change it.</p>
      </div>
    </span>
  );
}
