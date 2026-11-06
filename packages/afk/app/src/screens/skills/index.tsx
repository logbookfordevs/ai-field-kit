import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Page } from "@/shell/Page";
import type { Attention, ScreenDefinition, ScreenProps } from "@/screens/types";
import { useSkillsState } from "@/screens/skills/api";
import { GlobalSkills } from "@/screens/skills/GlobalSkills";
import { reviewCount, skillsDescription } from "@/screens/skills/model";
import { ProjectSkills } from "@/screens/skills/ProjectSkills";
import "@/screens/skills/skills.css";

function SkillsScreen({ params }: ScreenProps) {
  const state = useSkillsState();
  const [scope, setScope] = useState(params.get("scope") ?? "Global");
  const projects = state.data?.settings.projects ?? [];
  const knownScope = scope === "Global" || projects.some(project => project.name === scope);
  const shownScope = knownScope ? scope : "Global";
  const hasProjects = projects.length > 0;

  const scopePicker = hasProjects ? (
    <label className="skills-scope">
      <span>Scope</span>
      <select value={shownScope} onChange={event => setScope(event.target.value)}>
        <option value="Global">Global</option>
        {projects.map(project => <option key={project.name} value={project.name}>{project.name}</option>)}
      </select>
    </label>
  ) : null;

  if (state.data && shownScope === "Global") return <GlobalSkills state={state.data} params={params} scopePicker={scopePicker} />;
  if (state.data) return <ProjectSkills key={shownScope} state={state.data} scope={shownScope} scopePicker={scopePicker} />;

  return (
    <Page title="Skills" description={skillsDescription}>
      {state.error
        ? <EmptyState title="Couldn’t read your skills" actions={<button type="button" onClick={() => void state.reload()}>Try again</button>}>{state.error.message}</EmptyState>
        : <p className="meta" role="status">Reading your skills…</p>}
    </Page>
  );
}

function useSkillsAttention(): Attention | null {
  const { data } = useSkillsState();
  const count = data ? reviewCount(data) : 0;
  return count ? { text: `${count} to review`, tone: "attention" } : null;
}

export const screen: ScreenDefinition = {
  id: "skills",
  label: "Skills",
  Screen: SkillsScreen,
  useAttention: useSkillsAttention,
};
