import { useId } from "react";
import { Icon } from "@/components/Icon";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";
import { Segmented } from "@/components/Segmented";
import { Switch } from "@/components/Switch";
import type { InvocationMode } from "@/screens/skills/api";
import { fromLabel, type Skill } from "@/screens/skills/model";
import { hrefFor } from "@/shell/router";
import { shortSource } from "@/text/format";

export const modeOptions = [{ value: "Manual only", label: "Manual" }, { value: "Automatic allowed", label: "Automatic" }] as const;

type Act<A extends unknown[]> = (...args: A) => void | Promise<void>;

export interface RowActions {
  open: (name: string, focus: "details" | "editor") => void;
  setOn: Act<[Skill, boolean]>;
  setMode: Act<[Skill, InvocationMode | ""]>;
  update: Act<[Skill]>;
  move: Act<[Skill]>;
  drop: Act<[Skill]>;
  askAgain: Act<[Skill]>;
  install: Act<[Skill]>;
  resolveDuplicate: Act<[Skill]>;
  remove: Act<[Skill]>;
}

/** Spreads a MenuItem's reason only when there is one. */
export function unavailable(reason: string | undefined): { disabledReason?: string } {
  return reason === undefined ? {} : { disabledReason: reason };
}

/** Why a skill can't update from here, or undefined when it can. */
export function updateBlocked(skill: Skill): string | undefined {
  if (skill.place === "tool") return undefined;
  if (skill.entry?.updatesStopped) return "You kept your own version. Let updates replace your edits from Edit files to update it again.";
  if (!skill.installable) return "No repository to update from.";
  return undefined;
}

/** Text shown under the switch when it can't be used, or a short state note. */
function availabilityNote(skill: Skill): string | undefined {
  const owners = skill.entry?.owners ?? [];
  if (owners.length) return `On through ${owners.join(", ")}. Turn the pack on or off in Packs.`;
  return undefined;
}

/** A change to this skill that AFK refused; `outsideEdit` when an edit made outside AFK is why. */
export interface RowFailure {
  message: string;
  outsideEdit: boolean;
}

export function FailureNote({ id, failure }: { id: string; failure: RowFailure }) {
  if (!failure.outsideEdit) return <p className="s-note warn" id={id} role="alert">{failure.message}</p>;
  return <p className="s-note warn" id={id} role="alert">Your library has an edit made outside AFK. <a href={hrefFor("backup")}>Review it in Backup</a></p>;
}

export function SkillRow({ skill, selected, onSelect, actions, busy, backupNote, failure, sourceLine = false }: {
  skill: Skill;
  selected: boolean;
  onSelect: (name: string, selected: boolean) => void;
  actions: RowActions;
  busy: boolean;
  backupNote?: string | undefined;
  failure?: RowFailure | undefined;
  sourceLine?: boolean;
}) {
  const noteId = useId();
  const failureId = useId();
  const missing = !skill.entry;
  const tool = skill.place === "tool";
  const review = skill.place === "review";
  const note = availabilityNote(skill);
  const heldByPack = Boolean(note);
  const source = skill.source ? shortSource(skill.source) : "";
  const showSource = Boolean(source) && sourceLine;
  const moveLabel = review ? "Decide where it belongs…" : "Move to…";
  const canAskAgain = skill.keptHere === true;
  const canDrop = skill.place === "core" || skill.place === "pack";
  const dropLabel = skill.place === "pack" ? `Drop from ${skill.owner}` : "Drop from Core";
  const hasDuplicate = Boolean(skill.entry?.duplicate);
  const hasDrift = Boolean(skill.drift);
  const describedBy = [note ? noteId : "", failure ? failureId : ""].filter(Boolean).join(" ") || undefined;
  const editLabel = tool || skill.entry?.readOnly || skill.place === "pack" || !skill.entry?.storage ? "View files" : "Edit files";

  const renderFrom = () => {
    if (review) {
      return (
        <span className="rv">
          <span className="review"><Icon name="alert" size="sm" />To review</span>
          <button type="button" className="text" disabled={busy} onClick={() => actions.move(skill)}>Decide…</button>
        </span>
      );
    }
    return (
      <>
        <span>{fromLabel(skill)}</span>
        {showSource ? <span className="src" title={skill.source}>{source}</span> : null}
      </>
    );
  };

  const renderState = () => {
    if (missing) {
      return (
        <span className="s-missing">
          <span className="meta">Not on this machine</span>
          {skill.installable ? <button type="button" disabled={busy} onClick={() => actions.install(skill)}>Install</button> : null}
        </span>
      );
    }
    return <Switch label={skill.name} checked={skill.on} disabled={busy || heldByPack} {...(describedBy ? { describedBy } : {})} onChange={next => actions.setOn(skill, next)} />;
  };

  return (
    <li className={selected ? "srow selected" : "srow"}>
      <div className="s-pick">
        {missing ? null : <input type="checkbox" aria-label={`Select ${skill.name}`} checked={selected} disabled={busy} onChange={event => onSelect(skill.name, event.target.checked)} />}
      </div>
      <div className="s-main">
        <button type="button" className="s-name" onClick={() => actions.open(skill.name, "details")}>{skill.name}</button>
        {skill.description ? <p className="s-desc clamp1">{skill.description}</p> : null}
        {note ? <p className="s-note" id={noteId}>{note}</p> : null}
        {skill.entry?.updatesStopped ? <p className="s-note">Your version · updates stopped</p> : null}
        {hasDuplicate ? <p className="s-note warn">Two copies on this machine. <button type="button" className="text" disabled={busy} onClick={() => actions.resolveDuplicate(skill)}>Resolve…</button></p> : null}
        {hasDrift ? <p className="s-note warn">Files differ from your choice. <button type="button" className="text" disabled={busy} onClick={() => actions.setMode(skill, skill.drift ?? "")}>Reapply</button></p> : null}
        {backupNote ? <p className="s-note warn">{backupNote}</p> : null}
        {failure ? <FailureNote id={failureId} failure={failure} /> : null}
      </div>
      <div className="s-from">{renderFrom()}</div>
      <div className="s-on">{renderState()}</div>
      <div className="s-inv">
        {missing ? null : <Segmented legend={`How ${skill.name} starts`} options={modeOptions} value={skill.mode} disabled={busy} describedBy={describedBy} onChange={mode => actions.setMode(skill, mode)} />}
      </div>
      <div className="s-more">
        <Menu label={`More for ${skill.name}`}>
          {missing ? null : <MenuItem onSelect={() => actions.open(skill.name, "details")}>Inspect</MenuItem>}
          {missing ? null : <MenuItem onSelect={() => actions.open(skill.name, "editor")}>{editLabel}</MenuItem>}
          {missing ? null : <MenuItem onSelect={() => actions.update(skill)} {...unavailable(updateBlocked(skill))}>Update</MenuItem>}
          {missing ? null : <MenuItem onSelect={() => actions.move(skill)} {...unavailable(tool ? `Installed by ${skill.owner}.` : undefined)}>{moveLabel}</MenuItem>}
          {canDrop ? <MenuItem onSelect={() => actions.drop(skill)}>{dropLabel}</MenuItem> : null}
          {canAskAgain ? <MenuItem onSelect={() => actions.askAgain(skill)}>Ask me again where it belongs</MenuItem> : null}
          {missing ? null : <MenuSeparator />}
          {missing ? null : <MenuItem danger onSelect={() => actions.remove(skill)} {...unavailable(tool ? "Remove it from the tool instead." : undefined)}>Delete…</MenuItem>}
        </Menu>
      </div>
    </li>
  );
}
