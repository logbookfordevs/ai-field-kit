import { useOperation } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { hrefFor } from "@/shell/router";
import { NeedsAttention } from "@/screens/backup/NeedsAttention";
import { ChangeRemote } from "@/screens/backup/ChangeRemote";
import { Connect } from "@/screens/backup/Connect";
import { History } from "@/screens/backup/History";
import { Holds } from "@/screens/backup/Holds";
import { StateBlock } from "@/screens/backup/StateBlock";
import { useBackupActions } from "@/screens/backup/useBackupActions";
import type { Attention, ScreenDefinition } from "@/screens/types";
import { Page } from "@/shell/Page";
import "@/screens/backup/Backup.css";

const description = "A private Git repository that holds your library. Restore it on a new machine in one download.";
const refreshEvery = 20_000;

function BackupScreen() {
  const state = useOperation("backup/state", {}, { refetchInterval: refreshEvery });
  const actions = useBackupActions();

  if (state.error && !state.data) {
    return (
      <Page title="Backup" description={description}>
        <EmptyState title="Backup couldn't be read" actions={<button type="button" onClick={() => void state.reload()}>Try again</button>}>{state.error.message}</EmptyState>
      </Page>
    );
  }
  if (!state.data) return <Page title="Backup" description={description}><p className="sub" role="status">Loading…</p></Page>;

  const { status, attention, history, contents } = state.data;
  if (!status.library) {
    return (
      <Page title="Backup" description={description}>
        <EmptyState title="No library yet" actions={<a className="button-link" href={hrefFor("settings")}>Start a library in Settings</a>}>
          A backup saves your library, and you haven&apos;t started one. Start a library from this machine&apos;s skills, or restore one from a backup.
        </EmptyState>
      </Page>
    );
  }
  const isConnected = status.state !== "off";
  const retry = status.state === "failed";
  const saveLabel = retry ? "Try again" : "Back up now";
  const saveButton = <button type="button" disabled={status.pushing || actions.busy} onClick={() => void actions.saveNow()}>{saveLabel}</button>;
  return (
    <Page title="Backup" description={description}>
      {actions.problem ? <p className="field-error problem" role="alert">{actions.problem}</p> : null}
      <StateBlock status={status} actions={isConnected ? saveButton : undefined}>{isConnected ? <ChangeRemote actions={actions} /> : null}</StateBlock>
      {isConnected ? null : <Connect actions={actions} />}
      <NeedsAttention items={attention} held={status.held} actions={actions} />
      {isConnected && history ? <History entries={history} actions={actions} /> : null}
      {contents ? <Holds contents={contents} /> : null}
    </Page>
  );
}

function useBackupAttention(): Attention | null {
  const { data } = useOperation("backup/state", { brief: true }, { refetchInterval: refreshEvery });
  if (!data?.status.library) return null;
  const { status, attention } = data;
  if (status.state === "failed") return { text: "Can't save", tone: "problem" };
  if (attention.length > 0 || status.held) return { text: `${attention.length || 1} to resolve`, tone: "attention" };
  if (status.state === "off") return { text: "Off", tone: "quiet" };
  return null;
}

export const screen: ScreenDefinition = {
  id: "backup",
  label: "Backup",
  Screen: BackupScreen,
  useAttention: useBackupAttention,
};
