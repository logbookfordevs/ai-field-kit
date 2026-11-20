import { useId, useState } from "react";
import { useMutation } from "@/api/hooks";
import { Segmented } from "@/components/Segmented";
import { DEFAULT_DISCOVERY_WINDOW, discoveryCap, discoveryEstimate, type Skill } from "@/screens/skills/model";
import { plural } from "@/text/format";
import type { DiscoveryAgent, DiscoveryWindow, DiscoveryWindows } from "../../../../src/fieldwork/settings.js";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const AGENTS = [
  { key: "claude", label: "Claude", overCap: "Claude Code shortens descriptions." },
  { key: "codex", label: "Codex", overCap: "Codex shortens descriptions, then drops them, then leaves skills out." },
] as const;

const WINDOW_OPTIONS = [
  { value: "200k", label: "200k" },
  { value: "400k", label: "400k" },
  { value: "1M", label: "1M" },
] as const;

/** Tokens Claude and Codex spend up front on the skills that may start automatically, and how much of each skill list's cap that uses. */
export function DiscoveryEstimate({ skills, windows = {} }: { skills: Skill[]; windows?: DiscoveryWindows | undefined }) {
  const id = useId();
  const save = useMutation("discovery-window");
  const [chosen, setChosen] = useState<DiscoveryWindows>(windows);

  const estimates = AGENTS.map(agent => {
    const window = chosen[agent.key] ?? windows[agent.key] ?? DEFAULT_DISCOVERY_WINDOW[agent.key];
    const estimate = discoveryEstimate(skills, agent.key);
    const cap = discoveryCap(agent.key, window);
    return { ...agent, ...estimate, window, cap, isOverCap: estimate.chars > cap };
  });
  const summary = estimates.map(({ label, tokens, isOverCap }) => `${label} ~${compact.format(tokens)}${isOverCap ? " (over cap)" : ""}`).join(" · ");

  async function choose(agent: DiscoveryAgent, window: DiscoveryWindow) {
    const previous = chosen;
    setChosen({ ...chosen, [agent]: window });
    const result = await save.run({ agent, window });
    if (!result.ok) setChosen(previous);
  }

  return (
    <span className="inv-info">
      <button type="button" className="text" popoverTarget={id}>
        Discovery: {summary} tokens
      </button>
      <div id={id} className="inv-pop" popover="auto" role="group" aria-label="Discovery estimate">
        {estimates.map(({ key, label, overCap, count, chars, tokens, window, cap, isOverCap }) => (
          <div key={key} className="discovery-agent">
            <p><b>{label}</b>: about {tokens.toLocaleString()} tokens, {chars.toLocaleString()} characters, from {plural(count, "automatic skill")}.</p>
            <div className="discovery-window">
              <span className="meta">Context window</span>
              <Segmented legend={`${label} context window`} options={WINDOW_OPTIONS} value={window} onChange={next => void choose(key, next)} />
            </div>
            <meter min={0} max={cap} value={chars} aria-label={`${label} skill list`} />
            <p className="meta">{chars.toLocaleString()} of {cap.toLocaleString()} characters ({Math.round((chars / cap) * 100)}%).</p>
            {isOverCap ? <p className="s-note warn">Over the cap. {overCap}</p> : null}
          </div>
        ))}
        {save.error ? <p className="s-note warn">{save.error.message}</p> : null}
        <p className="meta">Agents read the name and description of every skill that is on and may start automatically. Manual only skills, full instructions and supporting files are left out. Claude’s skill list fits 1% of the context window and Codex’s 2%, up to 40,000 characters. Pick the window of the model you use; AFK remembers it. Filters don’t change it.</p>
      </div>
    </span>
  );
}
