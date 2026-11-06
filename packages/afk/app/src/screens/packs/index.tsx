import { useRef, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useMutation, useOperation, type Read } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { Dialog } from "@/components/Dialog";
import { ImportDialog } from "@/screens/packs/ImportDialog";
import { MembersDialog } from "@/screens/packs/MembersDialog";
import { Ledger } from "@/components/Row";
import { useToast } from "@/components/Toast";
import { PackItem } from "@/screens/packs/PackItem";
import { downloadJson } from "@/screens/packs/download";
import { GLOBAL, viewPacks, type PackView } from "@/screens/packs/model";
import { plural } from "@/text/format";
import type { PackState } from "@/screens/packs/types";
import { noAttention, type ScreenDefinition } from "@/screens/types";
import { Page } from "@/shell/Page";
import "@/screens/packs/Packs.css";

function usePackState(): Read<PackState> {
  const read = useOperation("state");
  return { ...read, data: read.data };
}

type Editor = { pack: PackView | null };

interface Notice { packId: string; message: string }

function PacksScreen() {
  const state = usePackState();
  const toast = useToast();
  const client = useClient();
  const activation = useMutation("activation");
  const cancelInstall = useMutation("skills/install-cancel");
  const [switching, setSwitching] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<PackView | null>(null);
  const remove = useMutation("pack/remove");
  const cancelRequested = useRef(false);
  const install = useOperation("skills/install-state", {}, { refetchInterval: switching ? 400 : false });

  const packs = state.data ? viewPacks(state.data) : [];
  const isLoading = state.loading && !state.data;
  const failedToLoad = Boolean(state.error) && !state.data;
  const hasNoPacks = Boolean(state.data) && packs.length === 0;

  async function turnOff(pack: PackView) {
    for (const scope of pack.scopes) {
      const result = await activation.run({ id: pack.profile.id, scope, enabled: false });
      if (!result.ok) return result;
    }
    return { ok: true as const };
  }

  async function toggle(pack: PackView, enabled: boolean) {
    const { id, name } = pack.profile;
    setNotice(null);
    setSwitching(id);
    cancelRequested.current = false;
    const result = enabled ? await activation.run({ id, scope: GLOBAL, enabled: true }) : await turnOff(pack);
    setSwitching(null);
    if (result.ok) {
      const downloaded = enabled && pack.awayCount ? ` · ${plural(pack.awayCount, "skill")} downloaded` : "";
      toast.show(`${name} is ${enabled ? "on" : "off"}${downloaded}`);
      return;
    }
    const message = cancelRequested.current ? `Download cancelled. ${name} stays off.` : result.error.message;
    setNotice({ packId: id, message });
  }

  async function cancel() {
    cancelRequested.current = true;
    const result = await cancelInstall.run({});
    const reason = result.ok ? (result.value as { cancelled?: boolean; reason?: string }).reason : result.error.message;
    if (reason) toast.show(reason);
  }

  async function confirmRemove() {
    if (!removing) return;
    const result = await remove.run({ id: removing.profile.id });
    if (!result.ok) return;
    toast.show(`Removed ${removing.profile.name}`);
    setRemoving(null);
  }

  async function exportManifest(pack: PackView) {
    const result = await client.run("pack/manifest", { id: pack.profile.id });
    if (!result.ok) return toast.fail(result.error.message);
    const { manifest } = result.value;
    downloadJson(`${manifest.id}.json`, manifest);
    toast.show(`Exported ${manifest.id}.json`);
  }

  const running = install.data?.pending ? install.data : null;

  return (
    <Page
      title="Packs"
      description="Groups of skills you turn on when a piece of work needs them. Packs are backed up as definitions; their files download again."
      actions={
        <>
          <button type="button" onClick={() => setImporting(true)}>Import pack</button>
          <button type="button" className="primary" onClick={() => setEditor({ pack: null })}>Create pack</button>
        </>
      }
    >
      {isLoading ? <p className="sub" role="status">Loading packs…</p> : null}
      {failedToLoad ? (
        <EmptyState title="Couldn't load your packs" actions={<button type="button" onClick={() => void state.reload()}>Try again</button>}>
          {state.error?.message}
        </EmptyState>
      ) : null}
      {hasNoPacks ? <EmptyState title="No packs yet">A pack groups skills you want on together, such as everything for writing.</EmptyState> : null}
      {packs.length ? (
        <Ledger label="Packs">
          {packs.map(pack => {
            const isSwitching = switching === pack.profile.id;
            return (
              <PackItem
                key={pack.profile.id}
                pack={pack}
                switching={isSwitching}
                locked={switching !== null}
                progress={isSwitching && running?.label === `Turn on ${pack.profile.name}` ? running : null}
                notice={notice?.packId === pack.profile.id ? notice.message : null}
                onToggle={enabled => void toggle(pack, enabled)}
                onCancel={() => void cancel()}
                onEdit={() => setEditor({ pack })}
                onExport={() => void exportManifest(pack)}
                onRemove={() => { remove.reset(); setRemoving(pack); }}
              />
            );
          })}
        </Ledger>
      ) : null}
      {editor && state.data ? (
        <MembersDialog
          pack={editor.pack}
          inventory={state.data.inventories[GLOBAL] ?? []}
          existingNames={packs.map(item => item.profile.name)}
          onClose={() => setEditor(null)}
          onSaved={message => { setEditor(null); toast.show(message); }}
        />
      ) : null}
      {importing ? <ImportDialog onClose={() => setImporting(false)} onImported={message => { setImporting(false); toast.show(message); }} /> : null}
      <Dialog
        open={removing !== null}
        variant="small"
        onClose={() => setRemoving(null)}
        canClose={!remove.pending}
        title={`Remove ${removing?.profile.name ?? "pack"}?`}
        description="This removes the pack, not its skills. Their files stay on this machine and in your library."
        footer={
          <>
            <button type="button" className="text" onClick={() => setRemoving(null)} disabled={remove.pending}>Cancel</button>
            <button type="button" className="danger-outline" onClick={() => void confirmRemove()} disabled={remove.pending}>Remove pack</button>
          </>
        }
      >
        {remove.error ? <p className="field-error" role="alert">{remove.error.message}</p> : null}
      </Dialog>
    </Page>
  );
}

export const screen: ScreenDefinition = {
  id: "packs",
  label: "Packs",
  Screen: PacksScreen,
  useAttention: noAttention,
};
