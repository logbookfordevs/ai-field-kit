import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { headline, type Headline } from "@/screens/backup/headline";
import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";

const icons: Record<Headline["kind"], IconName> = { off: "cloudoff", saved: "check", waiting: "cloud", failed: "alert", paused: "alert" };

/** The page's first answer: is my library backed up, in words that differ for every state. */
export function StateBlock({ status, actions, children }: { status: BackupStatus; actions?: ReactNode; children?: ReactNode }) {
  const state = headline(status);
  const isProblem = state.kind === "failed" || state.kind === "paused";
  return (
    <div className={`state-block ${state.kind === "saved" ? "ok" : ""} ${isProblem ? "bad" : ""}`.trim()} data-state={state.kind}>
      <span className="ico"><Icon name={icons[state.kind]} /></span>
      <h2>{state.title}</h2>
      <p className="sub">{state.detail}</p>
      {state.kind === "failed" && status.error ? <p className="hint failure">{status.error}</p> : null}
      {children}
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}
