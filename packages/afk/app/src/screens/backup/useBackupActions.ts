import { useCallback, useState } from "react";
import type { Result } from "@/api/client";
import { useMutation } from "@/api/hooks";
import type { OperationResult } from "@/api/operations";
import { useToast } from "@/components/Toast";
import type { Resolved } from "@/screens/backup/types";
import type { BackupStatus } from "../../../../src/fieldwork/library-backup.js";

const keptHere = "Your changes are kept here.";

function savedOrWaiting(status: BackupStatus, success: string): string {
  return status.state === "failed" ? `Not saved yet: ${status.error ?? "the remote could not be reached"}. ${keptHere}` : success;
}

function movedAside(resolved: Resolved): string {
  return resolved.movedAside?.length ? ` A different copy was kept in ${resolved.movedAside.map(move => move.to).join(", ")}.` : "";
}

/** Every change the Backup page can make. Failures stay visible as `problem` until the next action; successes toast. */
export function useBackupActions() {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation("backup/save");
  const create = useMutation("backup/create");
  const connect = useMutation("backup/connect");
  const disconnect = useMutation("backup/disconnect");
  const restore = useMutation("backup/restore");
  const keep = useMutation("backup/keep");
  const discard = useMutation("backup/discard");
  const take = useMutation("backup/take-update");
  const restoreSaved = useMutation("backup/restore-saved");
  const busy = [save, create, connect, disconnect, restore, keep, discard, take, restoreSaved].some(change => change.pending);

  const settle = useCallback(<V,>(result: Result<V>, message: (value: V) => string): boolean => {
    if (!result.ok) {
      setProblem(result.error.message);
      return false;
    }
    toast.show(message(result.value));
    return true;
  }, [toast]);

  const begin = () => setProblem(null);

  return {
    busy,
    problem,
    dismissProblem: begin,
    saveNow: async () => { begin(); return settle(await save.run({}), (status: OperationResult<"backup/save">) => savedOrWaiting(status, "Saved.")); },
    createRepository: async (name: string) => { begin(); return settle(await create.run({ name }), (status: BackupStatus) => savedOrWaiting(status, "Private repository created and backed up.")); },
    connectRemote: async (url: string) => { begin(); return settle(await connect.run({ url }), (status: BackupStatus) => savedOrWaiting(status, "Connected and backed up.")); },
    disconnectRemote: async () => { begin(); return settle(await disconnect.run({}), () => "Backup disconnected. Your library stays on this machine."); },
    goBackTo: async (id: string) => { begin(); return settle(await restore.run({ id }), () => "Went back. The library was restored as a new save."); },
    keepEdit: async (id: string) => { begin(); return settle(await keep.run({ id }), () => "Edit kept and saved."); },
    discardEdit: async (id: string) => { begin(); return settle(await discard.run({ id }), () => "The saved version is back."); },
    takeUpdate: async (name: string) => { begin(); return settle(await take.run({ name }), (resolved: Resolved) => `The update is stored and linked.${movedAside(resolved)}`); },
    restoreSavedVersion: async (name: string) => { begin(); return settle(await restoreSaved.run({ name }), (resolved: Resolved) => `The saved version is linked again.${movedAside(resolved)}`); },
  };
}

export type BackupActions = ReturnType<typeof useBackupActions>;
