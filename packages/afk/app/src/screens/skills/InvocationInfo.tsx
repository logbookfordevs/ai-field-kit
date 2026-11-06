import { useId } from "react";
import { useOperation } from "@/api/hooks";

function names(list: string[]): string {
  if (list.length < 2) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

/** Which agents read Manual/Automatic, and how, from the folders that are switched on. */
export function useMechanismText(): string {
  const { data } = useOperation("agent-folders/state");
  const claude = data?.invocationAgents.claude ?? [];
  const codex = data?.invocationAgents.codex ?? [];
  const parts = [
    claude.length ? `${names(claude)} ${claude.length === 1 ? "reads" : "read"} the disable-model-invocation line in SKILL.md.` : "",
    codex.length ? `${names(codex)} ${codex.length === 1 ? "reads" : "read"} agents/openai.yaml, which AFK writes too.` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" ")} Other agents: unknown.` : "Turn on an agent folder in Settings to see which agents follow this choice.";
}

/** A small "?" that explains Manual and Automatic and names the agents that follow each mechanism. */
export function InvocationInfo() {
  const id = useId();
  const text = useMechanismText();
  return (
    <span className="inv-info">
      <button type="button" className="text" popoverTarget={id}>How Manual and Automatic work</button>
      <div id={id} className="inv-pop" popover="auto" role="note">
        <p><b>Manual only</b>: an agent uses the skill only when you name it.</p>
        <p><b>Automatic allowed</b>: an agent may pick it up on its own when it fits the task.</p>
        <p>{text}</p>
      </div>
    </span>
  );
}
