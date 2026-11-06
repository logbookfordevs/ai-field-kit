import { useId, useRef, useState, type FormEvent } from "react";
import { Segmented } from "@/components/Segmented";
import type { BackupActions } from "@/screens/backup/useBackupActions";

type Mode = "create" | "remote";

const modes = [
  { value: "create", label: "Create a private repository" },
  { value: "remote", label: "Use a Git remote" },
] as const;

const explanations: Record<Mode, string> = {
  create: "On your GitHub account, using your GitHub CLI sign-in. AFK stores no token.",
  remote: "Any empty Git repository URL. Git's own credentials are used.",
};

export function Connect({ actions }: { actions: BackupActions }) {
  const [mode, setMode] = useState<Mode>("create");
  const [values, setValues] = useState<Record<Mode, string>>({ create: "afk-library", remote: "" });
  const [missing, setMissing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();

  const isCreate = mode === "create";
  const label = isCreate ? "Repository name" : "Remote URL";
  const value = values[mode];
  const submitLabel = isCreate ? "Create and save" : "Connect and save";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      setMissing(true);
      input.current?.focus();
      return;
    }
    setMissing(false);
    await (isCreate ? actions.createRepository(value.trim()) : actions.connectRemote(value.trim()));
  };

  return (
    <section aria-labelledby="connect-h">
      <form className="connect" onSubmit={event => void submit(event)} noValidate>
        <div className="sec-head"><h2 id="connect-h">Connect a repository</h2></div>
        <Segmented legend="Where should AFK save?" showLegend options={modes} value={mode} onChange={next => { setMode(next); setMissing(false); }} />
        <p className="sub">{explanations[mode]}</p>
        <label>
          <span>{label}</span>
          <input
            ref={input}
            value={value}
            onChange={event => setValues({ ...values, [mode]: event.target.value })}
            placeholder={isCreate ? "afk-library" : "git@github.com:owner/afk-library.git"}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={missing}
            aria-describedby={`${hintId}${missing ? ` ${errorId}` : ""}`}
          />
        </label>
        <p className="hint" id={hintId}>Skill files aren&apos;t scanned for secrets. Keep the repository private.</p>
        <p className="field-error" id={errorId}>{missing ? (isCreate ? "Enter a name for the repository." : "Enter the URL of the Git repository.") : null}</p>
        <div><button type="submit" className="primary" disabled={actions.busy}>{submitLabel}</button></div>
      </form>
    </section>
  );
}
