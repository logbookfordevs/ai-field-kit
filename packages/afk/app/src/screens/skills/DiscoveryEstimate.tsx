import { useId } from "react";
import { discoveryEstimate, type Skill } from "@/screens/skills/model";
import { plural } from "@/text/format";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const AGENTS = [
  { key: "claude", label: "Claude", overCap: "Claude Code may shorten descriptions." },
  { key: "codex", label: "Codex", overCap: "Codex may shorten descriptions, then drop them, then leave skills out." },
] as const;

/** How many characters Claude and Codex spend up front on the skills that may start automatically, against each skill list's cap. */
export function DiscoveryEstimate({ skills }: { skills: Skill[] }) {
  const id = useId();
  const estimates = AGENTS.map(agent => ({ ...agent, ...discoveryEstimate(skills, agent.key) }));
  const summary = estimates.map(({ label, chars, cap }) => `${label} ${compact.format(chars)}/${compact.format(cap)}`).join(" · ");

  return (
    <span className="inv-info">
      <button type="button" className="text" popoverTarget={id}>
        Discovery: {summary} chars
      </button>
      <div id={id} className="inv-pop" popover="auto" role="note">
        {estimates.map(({ key, label, overCap, count, chars, cap }) => {
          const isOverCap = chars > cap;

          return (
            <div key={key} className="discovery-agent">
              <p><b>{label}</b>: {chars.toLocaleString()} of {cap.toLocaleString()} characters (default cap) from {plural(count, "automatic skill")}.</p>
              <meter min={0} max={cap} value={chars} aria-label={`${label} skill list`} />
              {isOverCap ? <p className="meta">Over the default cap. With a small context window, {overCap}</p> : null}
            </div>
          );
        })}
        <p className="meta">Agents read the name and description of every skill that is on and may start automatically. Manual only skills, full instructions and supporting files are left out. The default cap fits Claude at a 200k-token context window and Codex when it doesn’t know the window. Claude allows 1% of the window and Codex 2%, so larger windows fit far more: about 40,000 characters for Claude at 1M tokens. Filters don’t change it.</p>
      </div>
    </span>
  );
}
