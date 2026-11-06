import { useCallback, useEffect, useRef, useState } from "react";
import type { RulesDestinationState, RulesPreview, RulesState, RulesTargetPreview } from "../../../../src/fieldwork/rules.js";
import { useClient } from "@/api/ClientProvider";
import { useMutation, useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { ConflictDialog } from "@/screens/rules/ConflictDialog";
import { DestinationDialog, Destinations, DisconnectDialog, type DestinationInput } from "@/screens/rules/Destinations";
import { Diff } from "@/screens/rules/Diff";
import {
  adoptDraft, applyServerState, addReference, clock, CANONICAL, diffRows, discardStash, editDraft, hasCanonical, hasEdits, markSaved, openFile,
  reloadFromDisk, removeReference, renameReference, restoreReference, restoreStash, revertAll, revertFile, RULES_END, RULES_START,
  savedText, startDocument, textFromDestination, type Drafts,
} from "@/screens/rules/model";
import { plural } from "@/text/format";
import { AddReferenceDialog, RemoveReferenceDialog, RenameReferenceDialog } from "@/screens/rules/ReferenceDialogs";
import { draftStore, useDrafts } from "@/screens/rules/store";
import { PreviewDialog, ResultDialog, SaveFirstDialog, type SyncOutcome } from "@/screens/rules/SyncDialogs";
import { Workbench } from "@/screens/rules/Workbench";
import { Page } from "@/shell/Page";
import type { Attention, ScreenDefinition } from "@/screens/types";
import "@/screens/rules/types";
import "@/screens/rules/Rules.css";

type Destination = RulesDestinationState;

type DialogState =
  | { kind: "none" }
  | { kind: "add-reference"; path: string }
  | { kind: "rename-reference" }
  | { kind: "remove-reference" }
  | { kind: "revert-all" }
  | { kind: "save-first" }
  | { kind: "preview"; preview: RulesPreview; error: string }
  | { kind: "result"; outcomes: SyncOutcome[]; errors: string[] }
  | { kind: "conflict"; preview: RulesPreview; target: RulesTargetPreview; error: string; stale: boolean }
  | { kind: "destination"; id: string | undefined; error: string }
  | { kind: "disconnect"; id: string; error: string }
  | { kind: "disk-conflict"; reason: string; state: RulesState };

const unique = (items: string[]): string[] => [...new Set(items)];

function useRulesState() {
  const read = useOperation("rules/state");
  const data = read.data;
  useEffect(() => { if (data) draftStore.update(drafts => applyServerState(drafts, data)); }, [data]);
  return read;
}

function RulesScreen() {
  const client = useClient();
  const toast = useToast();
  const read = useRulesState();
  const drafts = useDrafts();
  const saveFiles = useMutation("rules/save");
  const saveDestination = useMutation("rules/destination");
  const runSync = useMutation("rules/sync");
  const adopt = useMutation("rules/adopt");
  const overwrite = useMutation("rules/overwrite");
  const disconnect = useMutation("rules/disconnect");
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState("");
  const [saving, setSaving] = useState(false);
  const savingNow = useRef(false);

  const state = read.data;
  const destinations = state?.destinations ?? [];
  const edited = hasEdits(drafts);
  const dialogOpen = dialog.kind !== "none";
  const closeDialog = useCallback(() => setDialog({ kind: "none" }), []);
  const busy = saving || saveFiles.pending || runSync.pending || overwrite.pending;
  const isSelected = (destination: Destination): boolean => selection[destination.id] ?? destination.status !== "off";
  const selectedIds = destinations.filter(destination => destination.status !== "off" && isSelected(destination)).map(destination => destination.id);
  const ready = hasCanonical(drafts);
  const fail = (message: string): void => { setActionErrors(previous => unique([...previous, message])); toast.fail(message); };

  useEffect(() => {
    if (!edited) return;
    const guard = (event: BeforeUnloadEvent): void => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [edited]);

  const reviewDiskChange = async (reason: string): Promise<void> => {
    const fresh = await client.run("rules/state");
    if (fresh.ok) setDialog({ kind: "disk-conflict", reason, state: fresh.value });
  };

  const save = async (): Promise<boolean> => {
    if (savingNow.current) return false;
    const current = draftStore.get();
    if (!hasEdits(current)) return true;
    savingNow.current = true;
    setSaving(true);
    try {
      const result = await saveFiles.run({ files: current.files.map(file => ({ path: file.path, content: file.draft })), expectedHash: current.baseHash });
      if (!result.ok) {
        fail(result.error.message);
        if (/chang|stale|conflict/i.test(result.error.message)) await reviewDiskChange(result.error.message);
        return false;
      }
      const fresh = await client.run("rules/state");
      draftStore.update(drafts => markSaved(fresh.ok ? applyServerState(drafts, fresh.value, true) : drafts, clock()));
      setActionErrors([]);
      return true;
    } finally {
      savingNow.current = false;
      setSaving(false);
    }
  };

  const previewSync = async (ids: string[] = selectedIds): Promise<void> => {
    const result = await client.run("rules/preview", { ids });
    if (result.ok) setDialog({ kind: "preview", preview: result.value, error: "" });
    else toast.fail(result.error.message);
  };

  const onSave = async (): Promise<void> => {
    if (await save()) toast.show("Rules saved. Agent files change only when you sync.");
  };
  const saveAndSync = async (): Promise<void> => {
    closeDialog();
    if (await save()) await previewSync();
  };
  const openSync = (): void => {
    if (hasEdits(draftStore.get())) setDialog({ kind: "save-first" });
    else void previewSync();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s" || dialogOpen || !ready) return;
      event.preventDefault();
      void onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sync = async (preview: RulesPreview): Promise<void> => {
    const ids = preview.targets.map(target => target.id);
    const result = await runSync.run({ ids, preview });
    if (!result.ok) { setDialog({ kind: "preview", preview, error: result.error.message }); return; }
    const outcome = result.value.preview ?? preview;
    const latest = new Map(result.value.state.destinations.map(destination => [destination.id, destination]));
    const outcomes = outcome.targets.map(target => ({ id: target.id, name: target.name, path: target.path, status: latest.get(target.id)?.status ?? target.status, reason: latest.get(target.id)?.reason ?? target.reason }));
    setLastRun(`Last sync · ${clock()}`);
    setActionErrors([]);
    setDialog({ kind: "result", outcomes, errors: outcome.errors ?? [] });
  };

  const reviewConflict = async (id: string): Promise<void> => {
    const result = await client.run("rules/preview", { ids: [id] });
    if (!result.ok) { toast.fail(result.error.message); return; }
    const target = result.value.targets[0];
    if (!target) { toast.show("Destination no longer exists. Check destinations again."); return; }
    setDialog({ kind: "conflict", preview: result.value, target, error: "", stale: false });
  };

  const adoptRegion = async (id: string): Promise<void> => {
    const result = await adopt.run({ id });
    if (!result.ok) { if (dialog.kind === "conflict") setDialog({ ...dialog, error: result.error.message }); toast.fail(result.error.message); return; }
    draftStore.update(current => adoptDraft(current, result.value.content, clock()));
    closeDialog();
    toast.show("Destination edits loaded as a draft. Review and save before syncing.");
  };

  const replaceRegion = async (): Promise<void> => {
    if (dialog.kind !== "conflict") return;
    const { target, preview } = dialog;
    const result = await overwrite.run({ id: target.id, expectedRegion: target.currentRegion ?? "", expectedPreview: preview });
    const outcome = result.ok ? result.value.preview.targets.find(entry => entry.id === target.id) : undefined;
    const message = !result.ok ? result.error.message : outcome?.status !== "current" ? (outcome?.reason ?? "The destination still needs attention. Review again before replacing.") : "";
    if (message) {
      setActionErrors(previous => unique([...previous, message]));
      setDialog({ ...dialog, error: message, stale: true });
      toast.fail(message);
      return;
    }
    closeDialog();
    toast.show("AFK region replaced with saved rules. Existing files were backed up.");
  };

  const checkDestinations = async (): Promise<void> => {
    await read.reload();
    setActionErrors([]);
    toast.show("Destinations checked against their current files.");
  };

  const recheck = async (id: string): Promise<void> => {
    closeDialog();
    await checkDestinations();
    const fresh = await client.run("rules/state");
    if (fresh.ok && fresh.value.destinations.find(destination => destination.id === id)?.status === "conflict") await reviewConflict(id);
  };

  const saveDestinationInput = async (input: DestinationInput): Promise<void> => {
    const result = await saveDestination.run({ destination: input });
    if (!result.ok) { setDialog({ kind: "destination", id: input.id, error: result.error.message }); return; }
    closeDialog();
    toast.show("Destination saved. No agent file changed.");
  };

  const disconnectDestination = async (id: string, clean: boolean): Promise<void> => {
    const result = await disconnect.run({ id, clean });
    if (!result.ok) { setDialog({ kind: "disconnect", id, error: result.error.message }); return; }
    closeDialog();
    toast.show("Destination disconnected. Your file remains in place.");
  };

  const reconnect = async (id: string): Promise<void> => {
    const found = destinations.find(destination => destination.id === id);
    if (!found) return;
    const result = await saveDestination.run({ destination: { id, name: found.name, kind: found.kind, path: found.path, ...(found.claudeMdImport ? { claudeMdImport: true } : {}) } });
    if (result.ok) toast.show("Destination reconnected. Preview before syncing."); else toast.fail(result.error.message);
  };

  const startRules = async (from?: string): Promise<void> => {
    let text = "# Agent rules\n\n";
    if (from) {
      const existing = await client.run("rules/existing", { id: from });
      if (!existing.ok) { toast.fail(existing.error.message); return; }
      text = textFromDestination(existing.value.text);
      if (!text) { toast.show("This destination contains no text to copy. Start a new document or paste your rules."); return; }
    }
    draftStore.update(current => startDocument(current, text));
    toast.show("Unsaved draft created. Save it before syncing to agents.");
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor textarea")?.focus());
  };

  const removeCurrentReference = (): void => {
    const current = draftStore.get();
    const removed = removeReference(current, current.current);
    draftStore.update(() => removed.drafts);
    closeDialog();
    const file = removed.file;
    if (file) toast.show(`${file.path} removed.`, { action: { label: "Undo", onAction: () => draftStore.update(latest => restoreReference(latest, removed.index, file)) } });
  };

  if (read.error && !state) return <Page title="Agent rules"><p className="field-error" role="alert">{read.error.message}</p></Page>;
  if (!state || !drafts.loaded) return <Page title="Agent rules"><p className="meta" role="status">Loading rules…</p></Page>;

  const hasSelection = selectedIds.length > 0;
  const summary = !ready ? "Start AGENTS.md first, then save and sync it to your agents." : !hasSelection ? "Choose at least one destination to sync." : `${plural(selectedIds.length, "destination")} selected. Sync previews the saved files before making changes.${edited ? " Your editor contains unsaved changes." : ""}`;
  const copyFrom = (id: string, name: string) => {
    const filename = destinations.find(destination => destination.id === id)?.path.split("/").pop() ?? "AGENTS.md";
    return <button type="button" onClick={() => void startRules(id)}>Copy from {name}’s {filename}</button>;
  };

  const revertAllAction = edited ? <button type="button" onClick={() => setDialog({ kind: "revert-all" })}>Revert all drafts</button> : undefined;
  const folderName = drafts.folder.replace(/\/$/, "").split("/").pop();
  const errors = unique([...state.errors, ...actionErrors]);

  return (
    <Page title="Agent rules" description="Edit and save your shared rules here. Sync previews changes to the destinations you choose." actions={revertAllAction}>
      <details className="rules-folder">
        <summary><span>AFK folder ·</span><code>{folderName}</code><span className="meta">Global</span></summary>
        <div className="folder-context"><code>{drafts.folder}</code><span className="meta">Shared by every pack and project</span></div>
      </details>

      {ready ? (
        <Workbench
          drafts={drafts}
          busy={busy}
          onOpen={path => draftStore.update(current => openFile(current, path))}
          onEdit={text => draftStore.update(current => editDraft(current, text))}
          onRevert={() => { draftStore.update(revertFile); toast.show("File reverted to the saved version."); }}
          onSave={() => void onSave()}
          onAddReference={path => setDialog({ kind: "add-reference", path: path ?? "" })}
          onRenameReference={() => setDialog({ kind: "rename-reference" })}
          onRemoveReference={() => setDialog({ kind: "remove-reference" })}
          onRestoreStash={() => { draftStore.update(current => restoreStash(current, clock())); toast.show("Previous draft restored. The other version is kept aside."); }}
          onDiscardStash={() => draftStore.update(discardStash)}
        />
      ) : (
        <div className="rules-empty">
          <EmptyState title="Write your rules once" level={2} actions={<>
            <button type="button" className="primary" onClick={() => void startRules()}>Start AGENTS.md</button>
            {copyFrom("codex", "Codex")}
            {copyFrom("claude", "Claude")}
          </>}>
            This AFK folder has no AGENTS.md yet. Start one here and it lives beside settings.json, ready to sync to Codex, Claude or any rules file you add. Copying starts an unsaved draft from the text you wrote yourself. Nothing is written until you save, and agent files change only when you sync.
          </EmptyState>
        </div>
      )}

      <Destinations
        destinations={destinations}
        selected={isSelected}
        summary={summary}
        lastRun={lastRun}
        errors={errors}
        canSync={hasSelection && ready && !busy}
        syncLabel={edited ? "Save & sync…" : "Sync saved rules"}
        onSelect={(id, on) => setSelection(previous => ({ ...previous, [id]: on }))}
        onSync={openSync}
        onCheck={() => void checkDestinations()}
        onPreview={id => void previewSync([id])}
        onReview={id => void reviewConflict(id)}
        onEdit={id => setDialog({ kind: "destination", id, error: "" })}
        onDisconnect={id => setDialog({ kind: "disconnect", id, error: "" })}
        onReconnect={id => void reconnect(id)}
      />

      <aside className="rules-note">
        <p><strong>AFK writes inside {RULES_START} … {RULES_END} and nowhere else.</strong> Text outside the markers, unrelated files and the destination file itself stay yours: no symlinks, no whole-file replacement, a backup before every change. Destinations are files on this machine; moving the AFK folder between machines is up to your Git, Drive or iCloud setup.</p>
      </aside>

      {renderDialog()}
    </Page>
  );

  function renderDialog() {
    switch (dialog.kind) {
      case "none": return null;
      case "add-reference": return <AddReferenceDialog drafts={drafts} initialPath={dialog.path} onClose={closeDialog} onAdd={input => { draftStore.update(current => addReference(current, input)); closeDialog(); toast.show(`references/${input.path} added as an unsaved draft. Save to write it to the AFK folder.`); }} />;
      case "rename-reference": return <RenameReferenceDialog drafts={drafts} path={drafts.current} onClose={closeDialog} onRename={(to, relink) => { draftStore.update(current => renameReference(current, current.current, to, relink)); closeDialog(); toast.show(`Renamed to references/${to}; save to keep this change.`); }} />;
      case "remove-reference": return <RemoveReferenceDialog path={drafts.current} onClose={closeDialog} onRemove={removeCurrentReference} />;
      case "revert-all": return (
        <Dialog open onClose={closeDialog} variant="small" title="Discard unsaved rule changes?" description="Your saved rules stay in the AFK folder. Unsaved text, added references and reference renames will be discarded." footer={<><button type="button" className="text" onClick={closeDialog}>Keep editing</button><button type="button" className="primary" onClick={() => { draftStore.update(revertAll); closeDialog(); toast.show("Rule drafts reverted. Agent files unchanged."); }}>Discard drafts</button></>}>
          <p className="sub">This cannot be undone.</p>
        </Dialog>
      );
      case "save-first": return <SaveFirstDialog canSyncSaved={savedText(drafts, CANONICAL) !== undefined} onKeepEditing={closeDialog} onSyncSaved={() => void previewSync()} onSaveAndSync={() => void saveAndSync()} />;
      case "preview": return <PreviewDialog preview={dialog.preview} error={dialog.error} syncing={runSync.pending} onClose={closeDialog} onSync={() => void sync(dialog.preview)} onPreviewAgain={() => void previewSync(dialog.preview.targets.map(target => target.id))} onReview={id => void reviewConflict(id)} />;
      case "result": return <ResultDialog outcomes={dialog.outcomes} errors={dialog.errors} onClose={closeDialog} />;
      case "conflict": return <ConflictDialog target={dialog.target} previewErrors={dialog.preview.errors} busy={adopt.pending || overwrite.pending} error={dialog.error} stale={dialog.stale} onClose={closeDialog} onAdopt={() => void adoptRegion(dialog.target.id)} onReplace={() => void replaceRegion()} onReviewAgain={() => void reviewConflict(dialog.target.id)} onRecheck={() => void recheck(dialog.target.id)} />;
      case "destination": return <DestinationDialog destination={destinations.find(destination => destination.id === dialog.id)} error={dialog.error} busy={saveDestination.pending} onClose={closeDialog} onSave={input => void saveDestinationInput(input)} />;
      case "disconnect": {
        const target = destinations.find(destination => destination.id === dialog.id);
        return target ? <DisconnectDialog destination={target} error={dialog.error} busy={disconnect.pending} onClose={closeDialog} onDisconnect={clean => void disconnectDestination(target.id, clean)} /> : null;
      }
      case "disk-conflict": return <DiskConflict reason={dialog.reason} state={dialog.state} drafts={drafts} onClose={closeDialog} onReload={() => { draftStore.update(current => reloadFromDisk(current, dialog.state, clock())); closeDialog(); toast.show("Saved files reloaded. Your previous drafts are kept aside."); }} />;
    }
  }
}

function DiskConflict({ reason, state, drafts, onClose, onReload }: { reason: string; state: RulesState; drafts: Drafts; onClose: () => void; onReload: () => void }) {
  const draft = drafts.files.find(file => file.path === CANONICAL)?.draft ?? "";
  const saved = state.files.find(file => file.path === CANONICAL)?.content ?? "";
  const differs = diffRows(draft, saved).some(row => row.kind !== "same");
  return (
    <Dialog open onClose={onClose} variant="wide" title="The AFK folder changed on disk" description={reason} footer={<><button type="button" className="text" onClick={onClose}>Keep editing</button><button type="button" className="primary" onClick={onReload}>Reload saved files</button></>}>
      <p className="sub">Your editor drafts are retained. Reload the saved files to review changes made through another editor or sync provider; your current drafts will be kept aside.</p>
      {differs ? <details open><summary>Your draft → current saved AGENTS.md</summary><Diff before={draft} after={saved} label="Changes from disk" /></details> : null}
    </Dialog>
  );
}

function useRulesAttention(): Attention | null {
  const read = useOperation("rules/state");
  const drafts = useDrafts();
  if (hasEdits(drafts)) return { text: "Unsaved", tone: "attention" };
  const managed = (read.data?.destinations ?? []).filter(destination => destination.status !== "off");
  const conflicts = managed.filter(destination => destination.status === "conflict").length;
  if (conflicts) return { text: plural(conflicts, "conflict"), tone: "attention" };
  const stale = managed.filter(destination => destination.status === "outdated").length;
  if (stale) return { text: `${stale} out of date`, tone: "attention" };
  return null;
}

export const screen: ScreenDefinition = {
  id: "rules",
  label: "Agent rules",
  Screen: RulesScreen,
  useAttention: useRulesAttention,
};
