import { dailyBackupTime } from "@/screens/backup/format";
import { Icon } from "@/components/Icon";
import type { OperationResult } from "@/api/operations";
import { hrefFor } from "@/shell/router";
import type { ScreenId } from "@/screens/types";
import { ago, plural, shortSource } from "@/text/format";

type Kit = OperationResult<"kit/state">;
type State = OperationResult<"state">;
type Status = OperationResult<"backup/state">["status"];

function backupLine(status: Status): string {
  if (status.state === "off") return "Off · your library is only on this machine";
  if (status.held) return `Paused · ${plural(Math.max(status.attention, 1), "edit")} to resolve`;
  if (status.state === "failed") return `Can't save · ${plural(status.waiting, "change")} waiting`;
  const repository = status.remote ? ` · ${shortSource(status.remote)}` : "";
  if (status.waiting > 0) return `${plural(status.waiting, "change")} back up at ${dailyBackupTime}${repository}`;
  return `${status.lastSavedAt === undefined ? "Saved" : `Saved ${ago(status.lastSavedAt)}`}${repository}`;
}

function SetupRow({ to, name, children, quiet = false }: { to: ScreenId; name: string; children: string; quiet?: boolean }) {
  return (
    <li>
      <a className="setup-row" href={hrefFor(to)}>
        <b>{name}</b>
        <span className={quiet ? "meta off" : "meta"}>{children}</span>
        <Icon name="chev" />
      </a>
    </li>
  );
}

/** One line per page, so the whole setup reads at a glance and each line opens its page. */
export function Setup({ kit, backup, state }: { kit: Kit; backup: { status: Status; attention: unknown[] }; state: State | undefined }) {
  const skills = state?.inventories.Global ?? [];
  const on = skills.filter(skill => skill.available).length;
  const review = kit.undecided.length;
  const packs = state?.settings.profiles ?? [];
  const packsOn = packs.filter(pack => pack.enabled.length > 0).length;
  const followed = kit.sources.filter(source => source.follow).length;
  const saved = state?.settings.favoriteSources.length ?? 0;
  const toolSkills = kit.tools.reduce((total, tool) => total + tool.provides.length, 0);
  const tools = state?.settings.tools.length ?? kit.tools.length;

  return (
    <section aria-labelledby="setup-h">
      <div className="sec-head"><h2 id="setup-h">Your setup</h2></div>
      <ul className="ledger">
        <SetupRow to="skills" name="Skills">{state ? `${on} of ${skills.length} on · ${kit.core.length} in Core${review ? ` · ${review} to review` : ""}` : `${kit.core.length} in Core`}</SetupRow>
        <SetupRow to="packs" name="Packs">{state ? `${plural(packs.length, "pack")} · ${packsOn ? `${packsOn} on` : "all off"}` : "Open to see your packs"}</SetupRow>
        <SetupRow to="sources" name="Sources">{`${saved} saved for later · ${followed} followed`}</SetupRow>
        <SetupRow to="tools" name="Tools">{`${plural(tools, "tool")} · ${plural(toolSkills, "skill")}`}</SetupRow>
        <SetupRow to="backup" name="Backup" quiet={backup.status.state === "off"}>{backupLine(backup.status)}</SetupRow>
      </ul>
    </section>
  );
}
