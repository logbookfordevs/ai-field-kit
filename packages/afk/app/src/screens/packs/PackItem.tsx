import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";
import { Progress } from "@/components/Progress";
import { Switch } from "@/components/Switch";
import { plural, type PackView } from "@/screens/packs/model";
import type { InstallProgress } from "@/screens/packs/types";

export interface PackItemProps {
  pack: PackView;
  /** This pack is being turned on or off. */
  switching: boolean;
  /** Some pack is being switched; only one can run at a time. */
  locked: boolean;
  progress: InstallProgress | null;
  notice: string | null;
  onToggle: (enabled: boolean) => void;
  onCancel: () => void;
  onEdit: () => void;
  onExport: () => void;
  onRemove: () => void;
}

export function PackItem({ pack, switching, locked, progress, notice, onToggle, onCancel, onEdit, onExport, onRemove }: PackItemProps) {
  const { profile, members, hereCount, awayCount, on } = pack;
  const offSummary = `Off. Turning it on links ${plural(hereCount, "skill")}${awayCount ? ` and downloads ${awayCount}` : ""}.`;
  const onSummary = `On for every agent. ${plural(members.length, "skill")} linked.`;
  const showsDownload = switching && awayCount > 0 && !on;
  const [showMembers, setShowMembers] = useState(false);
  const membersId = useId();
  const progressLabel = progress ? `${progress.phase} · ${progress.completed} of ${plural(progress.total, "source")}` : "Starting the download…";

  return (
    <li className="pack" aria-labelledby={`pack-${profile.id}`}>
      <div className="pack-main">
        <div className="pack-title">
          <h2 id={`pack-${profile.id}`}>{profile.name}</h2>
          <Menu label={`More for ${profile.name}`}>
            <MenuItem onSelect={onExport} {...(pack.exportBlock ? { disabledReason: pack.exportBlock } : {})}>Export manifest</MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={onRemove} {...(profile.enabled.length ? { disabledReason: "Turn it off first." } : {})}>Remove pack…</MenuItem>
          </Menu>
        </div>
        {profile.description ? <p className="sub">{profile.description}</p> : null}
        <p className="meta">{plural(members.length, "skill")} · {hereCount ? `${hereCount} on this machine` : "none downloaded yet"}</p>
        <div className="pack-links">
        <button type="button" className="text members-toggle" aria-expanded={showMembers} aria-controls={membersId} onClick={() => setShowMembers(shown => !shown)}>
          <Icon name="chev" size="sm" className="chev" />
          {showMembers ? "Hide members" : "Show members"}
        </button>
        <button type="button" className="text" onClick={onEdit}>Edit members</button>
        </div>
        {showMembers ? (
          <div id={membersId} className="members">
            <ul className="member-list" aria-label={`Members of ${profile.name}`}>
              {members.map(member => (
                <li key={member.name} className={member.here ? undefined : "away"}>
                  <span className="sname">{member.name}</span>
                  <span className="meta">{member.origin}</span>
                  <span className="meta away-note">{member.here ? "" : "not downloaded yet"}</span>
                </li>
              ))}
            </ul>
            {awayCount ? <p className="legend">Not downloaded yet: they download when the pack turns on.</p> : null}
          </div>
        ) : null}
      </div>
      <div className="pack-side">
        <Switch label={profile.name} checked={on} disabled={locked} onChange={onToggle} />
        {showsDownload ? (
          <div role="status" className="pack-progress">
            <Progress label={progressLabel} {...(progress ? { value: progress.completed, max: progress.total } : {})} />
            <button type="button" onClick={onCancel}>Cancel download</button>
          </div>
        ) : (
          <p className="meta">{on ? onSummary : offSummary}</p>
        )}
        {notice ? <p className="field-error" role="alert">{notice}</p> : null}
      </div>
    </li>
  );
}
