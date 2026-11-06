import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { hrefFor } from "@/shell/router";
import { useAction } from "@/screens/overview/useAction";
import type { UndecidedSkill } from "@/screens/overview/needs";

export interface PackChoice { id: string; name: string }

function PackDialog({ skill, packs, onClose }: { skill: UndecidedSkill; packs: PackChoice[]; onClose: () => void }) {
  const add = useAction("kit/add");
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const hasPacks = packs.length > 0;
  const canJoinPack = skill.installable && hasPacks;
  const blockedReason = !skill.installable ? "It has no repository to download from, so a pack can't bring it to another machine. Add it to Core or keep it here." : null;

  const submit = async () => {
    const pack = packs.find(item => item.id === packId);
    if (await add.run({ names: [skill.name], to: packId }, `${skill.name} is in ${pack?.name ?? "the pack"}.`)) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={<>Where does <span className="sname">{skill.name}</span> belong?</>}
      description="Packs turn on per project or globally."
      footer={
        <>
          <button type="button" className="text" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={!canJoinPack || add.pending} onClick={submit}>Add to pack</button>
        </>
      }
    >
      {blockedReason ? <p className="sub">{blockedReason}</p> : null}
      {skill.installable && hasPacks ? (
        <label>
          <span>Pack</span>
          <select value={packId} onChange={event => setPackId(event.target.value)}>
            {packs.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
          </select>
        </label>
      ) : null}
      {skill.installable && !hasPacks ? <p className="sub">You have no packs yet. <a href={hrefFor("packs")}>Create one in Packs</a>, then come back.</p> : null}
    </Dialog>
  );
}

function ReviewRow({ skill, libraryReady, packs }: { skill: UndecidedSkill; libraryReady: boolean; packs: PackChoice[] }) {
  const adopt = useAction("skill/adopt");
  const add = useAction("kit/add");
  const keep = useAction("kit/machine-only");
  const [choosing, setChoosing] = useState(false);
  const busy = adopt.pending || add.pending || keep.pending;

  const addToCore = () => libraryReady
    ? adopt.run({ name: skill.name, to: "library" }, `${skill.name} is in your library and will be backed up.`)
    : add.run({ names: [skill.name], to: "core" }, `${skill.name} is in Core.`);
  const keepHere = () => libraryReady
    ? adopt.run({ name: skill.name, to: "machine" }, `${skill.name} stays on this machine only.`)
    : keep.run({ name: skill.name, enabled: true }, `${skill.name} stays on this machine only.`);

  return (
    <li>
      <div className="need-skill">
        <span className="sname">{skill.name}</span>
        {skill.description ? <p className="sub clamp1">{skill.description}</p> : null}
      </div>
      <div className="acts">
        <button type="button" onClick={addToCore} disabled={busy}>Add to Core<span className="vh"> {skill.name}</span></button>
        <button type="button" onClick={keepHere} disabled={busy}>Keep on this machine<span className="vh"> {skill.name}</span></button>
        <button type="button" className="text" onClick={() => setChoosing(true)} disabled={busy}>Other…<span className="vh"> for {skill.name}</span></button>
      </div>
      {choosing ? <PackDialog skill={skill} packs={packs} onClose={() => setChoosing(false)} /> : null}
    </li>
  );
}

export function ReviewNeed({ skills, libraryReady, packs }: { skills: UndecidedSkill[]; libraryReady: boolean; packs: PackChoice[] }) {
  const count = skills.length;
  return (
    <li className="need" data-need="review">
      <Icon name="alert" />
      <div>
        <h3>{count === 1 ? "1 skill was installed outside AFK" : `${count} skills were installed outside AFK`}</h3>
        <p className="sub">They&rsquo;re on, but not in your library. Decide where each one belongs.</p>
      </div>
      <ul className="need-skills" aria-label="Skills to review">
        {skills.map(skill => <ReviewRow key={skill.name} skill={skill} libraryReady={libraryReady} packs={packs} />)}
      </ul>
    </li>
  );
}
