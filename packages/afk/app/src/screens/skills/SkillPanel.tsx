import { useCallback, useRef, useState } from "react";
import { useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { PathCard } from "@/components/PathCard";
import { Segmented } from "@/components/Segmented";
import { Switch } from "@/components/Switch";
import { FileViewer } from "@/screens/skills/FileViewer";
import { useMechanismText } from "@/screens/skills/InvocationInfo";
import { fromLabel, type Skill } from "@/screens/skills/model";
import { shortSource } from "@/text/format";
import { SkillEditor } from "@/screens/skills/SkillEditor";
import { modeOptions, updateBlocked, type RowActions } from "@/screens/skills/SkillRow";

const definitions: Record<Skill["place"], string> = {
  core: "On every machine, always on, backed up.",
  pack: "Turns on with its pack. The pack is backed up; its files download again.",
  machine: "Installed here, never backed up.",
  tool: "Its tool installs and updates it. The tool and your choice are backed up.",
  review: "Installed outside AFK. Decide where it belongs.",
  project: "Kept in the project’s own repository.",
};

function backupLine(skill: Skill, backupOn: boolean): string {
  if (skill.place === "core") return backupOn ? "In your library and your backup." : "In your library. Saved to your backup once backup is on.";
  if (skill.place === "pack") return "The pack definition is backed up; the files download again.";
  if (skill.place === "tool") return "The tool and your Manual/Automatic choice are backed up; the files come from the tool.";
  if (skill.place === "project") return "Travels with the project’s repository.";
  return "Not in your library, so it isn’t backed up.";
}

function discoveryTokens(skill: Skill): number {
  return Math.ceil(Array.from(`${skill.name}\n${skill.description}`).length / 4);
}

/** Side panel for one skill: on/off, how it starts, where it lives, and its files. */
export function SkillPanel({ skill, scope, focus, actions, onClose }: { skill: Skill; scope: string; focus: "details" | "editor"; actions: RowActions; onClose: () => void }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [dirty, setDirty] = useState(false);
  const [blocked, setBlocked] = useState("");
  const backup = useOperation("backup/state", { brief: false });
  const mechanism = useMechanismText();
  const onDirtyChange = useCallback((next: boolean) => { setDirty(next); if (!next) setBlocked(""); }, []);

  const global = scope === "Global";
  const present = skill.entry !== undefined;
  const tool = skill.place === "tool";
  const editable = global && present;
  const heldBy = skill.entry?.owners ?? [];
  const heldByPack = heldBy.length > 0;
  const backupOn = backup.data ? backup.data.status.state !== "off" : false;
  const canDelete = present && !tool;
  const blockedUpdate = updateBlocked(skill);
  const hasFiles = present || Boolean(skill.folder);
  const canMove = global && present && !tool;
  const savedChoice = skill.entry && !skill.entry.invocationInherited && skill.mode !== null;

  const onCloseBlocked = () => {
    setBlocked("Save or revert your edit before closing.");
    textRef.current?.focus();
  };

  const renderFiles = () => {
    if (editable) return <SkillEditor name={skill.name} onDirtyChange={onDirtyChange} blocked={blocked} textRef={textRef} focusText={focus === "editor"} />;
    return <FileViewer name={skill.name} scope={scope} {...(skill.folder ? { folder: skill.folder } : {})} />;
  };

  return (
    <Dialog
      open
      variant="sheet"
      onClose={onClose}
      canClose={!dirty}
      onCloseBlocked={onCloseBlocked}
      title={<span className="mono">{skill.name}</span>}
      description={global ? fromLabel(skill) : scope}
      footer={(
        <>
          {canDelete ? <button type="button" className="text danger-text" onClick={() => actions.remove(skill)}>Delete…</button> : null}
          <span className="spacer" />
          {present ? <button type="button" disabled={blockedUpdate !== undefined} title={blockedUpdate} onClick={() => actions.update(skill)}>Update</button> : null}
          <button type="button" onClick={() => (dirty ? onCloseBlocked() : onClose())}>Close</button>
        </>
      )}
    >
      {skill.description ? <p className="panel-desc">{skill.description}</p> : null}

      {global ? (
        <section className="blk" aria-labelledby="panel-on">
          <h3 id="panel-on">On or off</h3>
          {present ? (
            <div className="blk-row">
              <Switch label={skill.name} checked={skill.on} disabled={heldByPack} onChange={next => actions.setOn(skill, next)} />
              <span className="meta">{heldByPack ? `On through ${heldBy.join(", ")}. Turn the pack on or off in Packs.` : skill.on ? "Agents can see it." : "Hidden from every agent."}</span>
            </div>
          ) : (
            <div className="blk-row">
              <span className="meta">In Core, but not on this machine yet.</span>
              {skill.installable ? <button type="button" onClick={() => actions.install(skill)}>Install</button> : null}
            </div>
          )}
        </section>
      ) : null}

      {present ? (
        <section className="blk" aria-labelledby="panel-inv">
          <h3 id="panel-inv">How it starts</h3>
          {skill.folder ? <p className="meta">Whatever manages this folder decides. AFK only shows it.</p> : (
            <>
              <Segmented legend={`How ${skill.name} starts`} options={modeOptions} value={skill.mode} onChange={mode => actions.setMode(skill, mode)} />
              <p className="hint">{mechanism}</p>
              {savedChoice ? <button type="button" className="text" onClick={() => actions.setMode(skill, "")}>Use the skill’s own default</button> : null}
            </>
          )}
        </section>
      ) : null}

      <section className="blk" aria-labelledby="panel-where">
        <h3 id="panel-where">Where it lives</h3>
        <dl className="kv">
          <dt>Comes from</dt><dd>{global ? `${fromLabel(skill)}. ${definitions[skill.place]}` : definitions.project}</dd>
          <dt>Repository</dt><dd>{skill.source ? <code>{shortSource(skill.source)}</code> : "None, so it can’t update on its own."}</dd>
          <dt>Backup</dt><dd>{backupLine(skill, backupOn)}</dd>
          {present ? <><dt>Discovery</dt><dd>About {discoveryTokens(skill).toLocaleString()} tokens for its name and description.</dd></> : null}
        </dl>
        {skill.entry ? <PathCard label="Folder" path={skill.entry.path} /> : null}
        {canMove ? <div><button type="button" onClick={() => actions.move(skill)}>{skill.place === "review" ? "Decide where it belongs…" : "Move to…"}</button></div> : null}
      </section>

      {hasFiles ? <section className="blk" aria-label="Files">{renderFiles()}</section> : null}
    </Dialog>
  );
}
