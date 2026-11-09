import { type FormEvent, useState } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { Ledger } from "@/components/Row";
import { Page } from "@/shell/Page";
import { navigate } from "@/shell/router";
import type { ScreenDefinition } from "@/screens/types";
import { openInstall } from "@/screens/sources";
import { BackupFailedNeed, BackupOffNeed, EditedNeed, ReplacedNeed } from "@/screens/overview/LocalNeeds";
import { ReviewNeed } from "@/screens/overview/ReviewNeed";
import { Setup } from "@/screens/overview/Setup";
import { useAttention, useOverview, type Need } from "@/screens/overview/needs";
import { ago, plural, shortSource } from "@/text/format";
import { dailyBackupTime } from "@/screens/backup/format";
import "@/screens/overview/overview.css";

function NeedItem({ need, libraryReady, packs }: { need: Need; libraryReady: boolean; packs: { id: string; name: string }[] }) {
  switch (need.kind) {
    case "backup-failed": return <BackupFailedNeed waiting={need.waiting} {...(need.reason ? { reason: need.reason } : {})} />;
    case "review": return <ReviewNeed skills={need.skills} libraryReady={libraryReady} packs={packs} />;
    case "edited": return <EditedNeed item={need.item} />;
    case "replaced": return <ReplacedNeed item={need.item} />;
    case "backup-off": return <BackupOffNeed />;
  }
}

function QuickActions() {
  const [query, setQuery] = useState("");
  const find = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    navigate("skills", q ? { q } : undefined);
  };
  return (
    <section aria-labelledby="quick-h">
      <div className="sec-head"><h2 id="quick-h">Quick actions</h2></div>
      <div className="quick">
        <form className="quick-row" role="search" onSubmit={find}>
          <label>
            <span>Find a skill</span>
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or what it does" autoComplete="off" />
          </label>
          <button type="submit">Find</button>
        </form>
        <div className="acts">
          <button type="button" className="primary" onClick={() => openInstall()}>Add something new</button>
        </div>
      </div>
    </section>
  );
}

function OverviewScreen() {
  const { kit, backup, setup, needs } = useOverview();
  const failed = kit.error ?? backup.error;
  const status = backup.data?.status;

  if (failed) {
    return (
      <Page title="Overview">
        <EmptyState title="AFK couldn't read your setup" actions={<button type="button" onClick={() => { void kit.reload(); void backup.reload(); }}>Try again</button>}>
          {failed.message}
        </EmptyState>
      </Page>
    );
  }
  if (!needs || !status || !kit.data) return <Page title="Overview" />;

  const packs = (setup.data?.settings.profiles ?? []).map(pack => ({ id: pack.id, name: pack.name }));
  const repository = status.remote ? shortSource(status.remote) : undefined;
  const core = kit.data.core.length;
  const savedIn = core > 0 ? `${plural(core, "Core skill")} and your choices are` : "Your choices are";
  const savedLine = status.lastSavedAt === undefined ? "backed up" : `backed up ${ago(status.lastSavedAt)}`;
  const allSetTitle = status.waiting > 0 ? `All set · ${plural(status.waiting, "change")} back up at ${dailyBackupTime}` : `All set · ${savedLine}`;

  return (
    <Page title="Overview" description={needs.length ? `${plural(needs.length, "thing needs", "things need")} you.` : undefined}>
      <section aria-labelledby="needs-h">
        {needs.length > 0 ? (
          <>
            <div className="sec-head"><h2 id="needs-h">Needs you</h2></div>
            <Ledger labelledBy="needs-h" className="needs">
              {needs.map(need => <NeedItem key={need.kind === "edited" || need.kind === "replaced" ? `${need.kind}:${need.item.id}` : need.kind} need={need} libraryReady={status.library} packs={packs} />)}
            </Ledger>
          </>
        ) : (
          <div className="allset">
            <span className="tick"><Icon name="check" /></span>
            <h2 id="needs-h">{allSetTitle}</h2>
            <p className="sub">Nothing needs you.{repository ? ` ${savedIn} saved in ${repository}.` : ""}</p>
          </div>
        )}
      </section>
      <div className="ov-grid">
        <Setup kit={kit.data} backup={{ status, attention: backup.data?.attention ?? [] }} state={setup.data} />
        <QuickActions />
      </div>
    </Page>
  );
}

export const screen: ScreenDefinition = {
  id: "overview",
  label: "Overview",
  Screen: OverviewScreen,
  useAttention,
};
