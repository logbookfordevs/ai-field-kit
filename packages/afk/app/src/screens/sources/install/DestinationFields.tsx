import { useId, type Ref } from "react";
import type { Destination } from "@/screens/sources/types";

export interface DestinationValue {
  destination: Destination | null;
  /** A pack ID, "new-pack", or "" before one is chosen. */
  pack: string;
  packName: string;
  /** "Global" or a project name. */
  scope: string;
  bookmarkName: string;
}

export interface DestinationErrors {
  destination?: string | undefined;
  pack?: string | undefined;
  packName?: string | undefined;
  bookmarkName?: string | undefined;
}

export interface DestinationFieldsProps {
  value: DestinationValue;
  onChange: (patch: Partial<DestinationValue>) => void;
  packs: readonly { id: string; name: string }[];
  projects: readonly { name: string }[];
  /** Uploads have no repository to bookmark and are saved in the library instead of downloaded. */
  upload: boolean;
  errors: DestinationErrors;
  groupRef?: Ref<HTMLFieldSetElement>;
  /** Fields that receive focus when their error is reported. */
  packRef: Ref<HTMLSelectElement>;
  packNameRef: Ref<HTMLInputElement>;
  bookmarkRef: Ref<HTMLInputElement>;
}

const places: { id: Destination; label: string; definition: (upload: boolean) => string }[] = [
  { id: "core", label: "Core", definition: () => "On every machine, always on, backed up." },
  { id: "pack", label: "A pack", definition: upload => upload ? "On when you turn the pack on. Saved in your library, so nothing downloads." : "On when you turn the pack on. The pack is backed up; its files download again." },
  { id: "machine", label: "This machine only", definition: () => "Installed here, never backed up." },
  { id: "later", label: "Try later", definition: () => "Bookmarked. Nothing installed." },
];

export function DestinationFields({ value, onChange, packs, projects, upload, errors, groupRef, packRef, packNameRef, bookmarkRef }: DestinationFieldsProps) {
  const errorId = useId();
  const sortedPacks = [...packs].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <fieldset ref={groupRef} aria-describedby={errors.destination ? errorId : undefined}>
        <legend>Where should they go?</legend>
        <div className="cards">
          {places.map(place => {
            const unavailable = place.id === "later" && upload;
            return (
              <label key={place.id} className="card-radio">
                <input
                  type="radio"
                  name="destination"
                  value={place.id}
                  checked={value.destination === place.id}
                  disabled={unavailable}
                  onChange={() => onChange({ destination: place.id })}
                />
                <b>{place.label}</b>
                <span className="meta">{unavailable ? "Only for repositories." : place.definition(upload)}</span>
              </label>
            );
          })}
        </div>
        <p className="field-error" id={errorId} role="alert">{errors.destination}</p>
      </fieldset>
      {value.destination === "pack" ? (
        <div className="dest-options">
          <label>
            Pack
            <select ref={packRef} value={value.pack} aria-invalid={errors.pack ? true : undefined} onChange={event => onChange({ pack: event.target.value })}>
              <option value="">Choose a pack…</option>
              {sortedPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
              <option value="new-pack">New pack…</option>
            </select>
          </label>
          <p className="field-error" role="alert">{errors.pack}</p>
          {value.pack === "new-pack" ? (
            <>
              <label>
                New pack name
                <input ref={packNameRef} value={value.packName} maxLength={120} aria-invalid={errors.packName ? true : undefined} onChange={event => onChange({ packName: event.target.value })} />
              </label>
              <p className="field-error" role="alert">{errors.packName}</p>
            </>
          ) : null}
        </div>
      ) : null}
      {value.destination === "machine" && projects.length > 0 && !upload ? (
        <div className="dest-options">
          <label>
            Install into
            <select value={value.scope} onChange={event => onChange({ scope: event.target.value })}>
              <option value="Global">This machine, for every project</option>
              {projects.map(project => <option key={project.name} value={project.name}>{project.name}</option>)}
            </select>
          </label>
          <p className="hint">A project install stays with that project and outside your Core.</p>
        </div>
      ) : null}
      {value.destination === "later" ? (
        <div className="dest-options">
          <label>
            Name
            <input ref={bookmarkRef} value={value.bookmarkName} maxLength={120} aria-invalid={errors.bookmarkName ? true : undefined} onChange={event => onChange({ bookmarkName: event.target.value })} />
          </label>
          <p className="field-error" role="alert">{errors.bookmarkName}</p>
        </div>
      ) : null}
    </>
  );
}
