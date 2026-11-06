import { useId, useState, type FormEvent } from "react";

export type StartChoice = "start" | "backup" | "restore";

const options: Record<StartChoice, { title: string; detail: string }> = {
  start: { title: "Start a new library", detail: "Move this machine’s skills into a library. You can back it up afterwards." },
  backup: { title: "Back up this machine", detail: "Save your library to a private Git repository so you can bring it back later." },
  restore: { title: "Restore my library", detail: "New or wiped machine? Bring back your skills and choices from your backup repository." },
};

/** Which way to begin. A machine whose library already exists is offered backup instead of starting one, and may skip it. */
export function Choose({ ready, onChoose, onSkip }: { ready: boolean; onChoose: (choice: StartChoice) => void; onSkip: () => void }) {
  const errorId = useId();
  const [picked, setPicked] = useState<StartChoice | null>(null);
  const [error, setError] = useState("");
  const available: StartChoice[] = ready ? ["backup", "restore"] : ["start", "restore"];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!picked) {
      setError("Choose how to start.");
      return;
    }
    onChoose(picked);
  };

  return (
    <>
      <div><h1 tabIndex={-1}>Welcome to AFK</h1></div>
      <p className="lede">
        {ready
          ? "Your library is ready on this machine. AFK keeps the skills your agents use in it, and can back it up to a private Git repository."
          : "AFK keeps the skills your agents use in one library on this machine, and can back that library up to a private Git repository."}
      </p>
      <form className="fr-form" noValidate onSubmit={submit}>
        <fieldset aria-describedby={errorId}>
          <legend>How do you want to start?</legend>
          <div className="fr-cards">
            {available.map(choice => (
              <label className="card-radio" key={choice}>
                <input type="radio" name="start" value={choice} checked={picked === choice} onChange={() => { setPicked(choice); setError(""); }} />
                <b>{options[choice].title}</b>
                <span className="meta">{options[choice].detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="field-error" id={errorId} role="alert">{error}</p>
        <div className="fr-acts">
          <button type="submit" className="primary">Continue</button>
          {ready ? <button type="button" className="text" onClick={onSkip}>Skip for now</button> : null}
        </div>
        {ready ? <p className="sub">Skipping only skips the backup. Your library stays on this machine.</p> : null}
      </form>
    </>
  );
}
