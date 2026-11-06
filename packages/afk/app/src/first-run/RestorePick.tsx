import { useId, useRef, useState, type FormEvent } from "react";
import { useOperation } from "@/api/hooks";
import { Icon } from "@/components/Icon";
import { Progress } from "@/components/Progress";
import { Ledger, Row } from "@/components/Row";

const filterFrom = 8;

function lastPushed(pushedAt: string | undefined): string {
  return pushedAt ? ` · last pushed ${pushedAt.slice(0, 10)}` : "";
}

export interface RestorePickProps {
  pendingRepository: string | undefined;
  address: string;
  onAddress: (address: string) => void;
  problem: string;
  onRestore: (repository: string, label: string) => void;
  onBack: (() => void) | null;
}

/** Choose the library to restore from the GitHub list, or paste any repository address. */
export function RestorePick({ pendingRepository, address, onAddress, problem, onRestore, onBack }: RestorePickProps) {
  const repositories = useOperation("restore/repositories");
  const urlId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [empty, setEmpty] = useState(false);
  const [filter, setFilter] = useState("");

  const all = repositories.data ?? [];
  const shown = all.filter(repository => repository.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const canFilter = all.length > filterFrom;
  const noneListed = !repositories.loading && all.length === 0;
  const emptyMessage = repositories.error?.message ?? "No repositories found for this GitHub sign-in. Paste a repository address instead.";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setEmpty(true);
      input.current?.focus();
      return;
    }
    onRestore(trimmed, trimmed);
  };

  return (
    <>
      {onBack ? <button type="button" className="text back" onClick={onBack}><Icon name="back" size="sm" />Back</button> : null}
      <div><h1 tabIndex={-1}>Which repository is your library?</h1></div>
      {pendingRepository ? <p className="notice">The restore from <code>{pendingRepository}</code> did not finish. Restore from it again to finish linking its skills.</p> : null}
      <p className="lede">Listed with your GitHub CLI sign-in. AFK checks that a repository is an AFK library before downloading it, and stores no token.</p>
      {problem ? <p className="field-error" role="alert">{problem}</p> : null}
      {repositories.loading ? <div role="status"><Progress label="Looking up your repositories…" /></div> : null}
      {canFilter ? (
        <label>
          <span>Filter repositories</span>
          <input type="search" value={filter} onChange={event => setFilter(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
      ) : null}
      {shown.length > 0 ? (
        <Ledger label="Your repositories">
          {shown.map(repository => (
            <Row
              key={repository.url}
              title={<span className="sname">{repository.name}</span>}
              meta={`${repository.private ? "private" : "public"}${lastPushed(repository.pushedAt)}`}
              actions={<button type="button" className="primary" aria-label={`Restore ${repository.name}`} onClick={() => onRestore(repository.url, repository.name)}>Restore</button>}
            />
          ))}
        </Ledger>
      ) : null}
      {canFilter && shown.length === 0 ? <p className="sub">No repository matches “{filter.trim()}”.</p> : null}
      {noneListed ? <p className="hint">{emptyMessage}</p> : null}
      <form className="fr-form" noValidate onSubmit={submit}>
        <label htmlFor={urlId}>Or paste a repository</label>
        <input
          id={urlId}
          ref={input}
          value={address}
          onChange={event => { onAddress(event.target.value); setEmpty(false); }}
          placeholder="owner/repo or git@github.com:owner/afk-library.git"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={empty}
          aria-describedby={errorId}
        />
        <p className="field-error" id={errorId}>{empty ? "Paste the repository first." : ""}</p>
        <div className="fr-acts"><button type="submit">Restore from this address</button></div>
      </form>
      <p className="hint">From a terminal: <code>afk library connect owner/repo</code></p>
    </>
  );
}
