import { useId } from "react";
import { discoveryEstimate, type Skill } from "@/screens/skills/model";
import { plural } from "@/text/format";

/** Roughly how many tokens Claude and Codex spend up front on the skills that may start automatically. */
export function DiscoveryEstimate({ skills }: { skills: Skill[] }) {
  const id = useId();
  const claude = discoveryEstimate(skills, "claude");
  const codex = discoveryEstimate(skills, "codex");

  return (
    <span className="inv-info">
      <button type="button" className="text" popoverTarget={id}>
        Discovery: Claude ~{claude.tokens.toLocaleString()} · Codex ~{codex.tokens.toLocaleString()} tokens
      </button>
      <div id={id} className="inv-pop" popover="auto" role="note">
        <p><b>Claude</b>: about {claude.tokens.toLocaleString()} tokens from {plural(claude.count, "automatic skill")}.</p>
        <p><b>Codex</b>: about {codex.tokens.toLocaleString()} tokens from {plural(codex.count, "automatic skill")}.</p>
        <p className="meta">Agents read the name and description of every skill that is on and may start automatically. This counts four characters per token; Manual only skills, full instructions and supporting files are left out. Filters don’t change it.</p>
      </div>
    </span>
  );
}
