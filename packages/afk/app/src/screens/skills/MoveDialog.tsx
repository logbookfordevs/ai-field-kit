import { useState, type FormEvent } from "react";
import { useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import type { AppState } from "@/screens/skills/api";
import { fromLabel, type Skill } from "@/screens/skills/model";
import { useRun } from "@/screens/skills/useRun";
import { placeDefinitions } from "@/text/places";

type Destination = "core" | "pack" | "machine";

const places: Record<Destination, { label: string; definition: string }> = {
  core: { label: "Core", definition: placeDefinitions.core },
  pack: { label: "A pack", definition: placeDefinitions.pack },
  machine: { label: "This machine only", definition: placeDefinitions.machine },
};

/** The places a skill can go from where it is now, each mapped to one existing operation. */
function destinationsFor(skill: Skill, packs: number): Destination[] {
  const withPack = (list: Destination[]) => list.filter(place => place !== "pack" || packs > 0);
  if (skill.place === "review") return withPack(["core", "pack", "machine"]);
  if (skill.place === "core") return withPack(["pack"]);
  if (skill.place === "pack") return skill.installable ? ["core"] : [];
  if (skill.place === "machine") return withPack(skill.installable ? ["core", "pack"] : ["pack"]);
  return [];
}

export function MoveDialog({ skill, state, onClose }: { skill: Skill; state: AppState; onClose: () => void }) {
  const run = useRun();
  const toast = useToast();
  const folders = useOperation("agent-folders/state");
  const packs = [...state.settings.profiles].sort((a, b) => a.name.localeCompare(b.name));
  const destinations = destinationsFor(skill, packs.length);
  const [to, setTo] = useState<Destination | null>(destinations.length === 1 ? destinations[0]! : null);
  const [pack, setPack] = useState(packs[0]?.id ?? "");
  const [bookmark, setBookmark] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const review = skill.place === "review";
  const libraryReady = folders.data?.library === true;
  const offerBookmark = review && to === "machine" && skill.installable && libraryReady;
  const choosingPack = to === "pack";
  const packName = packs.find(item => item.id === pack)?.name ?? "the pack";
  const submitLabel = !to ? "Move" : to === "core" ? "Add to Core" : to === "pack" ? `Add to ${packName}` : "Keep on this machine only";

  const perform = (destination: Destination) => {
    if (destination === "pack") return run("kit/add", { names: [skill.name], to: pack }, { quiet: true });
    if (review && libraryReady) return run("skill/adopt", { name: skill.name, to: destination === "core" ? "library" : "machine", ...(bookmark ? { bookmark: true } : {}) }, { quiet: true });
    if (destination === "core") return run("kit/add", { names: [skill.name], to: "core" }, { quiet: true });
    return run("kit/machine-only", { name: skill.name, enabled: true }, { quiet: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!to) {
      setError("Choose where it goes.");
      document.querySelector<HTMLInputElement>("input[name=move-to]")?.focus();
      return;
    }
    setPending(true);
    const result = await perform(to);
    setPending(false);
    if (!result.ok) { setError(result.error.message); return; }
    toast.show(to === "machine" ? `${skill.name} stays on this machine only.` : to === "core" ? `${skill.name} is in Core and will be backed up.` : `${skill.name} added to ${packName}.`);
    onClose();
  };

  const renderTitle = () => {
    const name = <span className="mono">{skill.name}</span>;
    if (review) return <>Where does {name} belong?</>;
    if (skill.place === "pack") return <>Also add {name} to Core</>;
    if (skill.place === "core") return <>Also add {name} to a pack</>;
    return <>Move {name}</>;
  };

  const renderChoices = () => {
    if (!destinations.length) return <p>There is nowhere else to move it from here. {packs.length ? "" : "Create a pack in Packs first."}</p>;
    return (
      <fieldset aria-describedby="move-error">
        <legend>Choose a place</legend>
        <div className="radio-list">
          {destinations.map(place => (
            <label key={place} className="card-radio">
              <input type="radio" name="move-to" value={place} checked={to === place} onChange={() => { setTo(place); setError(""); }} />
              <b>{places[place].label}</b>
              <span className="meta">{places[place].definition}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      variant="small"
      title={renderTitle()}
      description={`Now: ${fromLabel(skill)}`}
      footer={(
        <>
          <button type="button" className="text" onClick={onClose}>Cancel</button>
          <button type="submit" form="move-form" className="primary" disabled={pending || !destinations.length}>{pending ? "Moving…" : submitLabel}</button>
        </>
      )}
    >
      <form id="move-form" className="move-form" noValidate onSubmit={event => void submit(event)}>
        {renderChoices()}
        {choosingPack ? (
          <label>
            <span>Pack</span>
            <select value={pack} onChange={event => setPack(event.target.value)}>
              {packs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        {offerBookmark ? (
          <label className="check">
            <input type="checkbox" checked={bookmark} onChange={event => setBookmark(event.target.checked)} />
            <span>Also bookmark its repository in Try later</span>
          </label>
        ) : null}
        <p className="field-error" id="move-error" role="alert">{error}</p>
      </form>
    </Dialog>
  );
}
