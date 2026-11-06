import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppUpdateJob } from "@/api/client";
import { useClient } from "@/api/ClientProvider";
import { useToast } from "@/components/Toast";

const versionKey = ["app", "update-check"];
const reconnectMs = 12 * 60_000;

async function restartedToken(): Promise<string | undefined> {
  try {
    const response = await fetch("/", { cache: "no-store", signal: AbortSignal.timeout(3_000) });
    const token = /window\.afkToken="([a-f0-9]+)"/.exec(await response.text())?.[1];
    return response.ok && token !== window.afkToken ? token : undefined;
  } catch {
    return undefined;
  }
}

export type AppUpdate = ReturnType<typeof useAppUpdate>;

/** The app's version and update job; call once so the rail and the phone menu share it. */
export function useAppUpdate() {
  const client = useClient();
  const queries = useQueryClient();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [job, setJob] = useState<AppUpdateJob | null>(null);

  const version = useQuery({
    queryKey: versionKey,
    queryFn: async () => {
      const result = await client.app.updateCheck();
      return result.ok ? result.value : { current: "", available: false, error: result.error.message };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    void client.app.updateState().then(result => { if (result.ok && result.value?.pending) setJob(result.value); });
  }, [client]);

  const updating = Boolean(job?.pending);
  useEffect(() => {
    if (!updating) return;
    const deadline = Date.now() + reconnectMs;
    const timer = setInterval(() => {
      void (async () => {
        const state = await client.app.updateState();
        if (state.ok) { setJob(state.value); return; }
        if (await restartedToken()) { location.reload(); return; }
        if (Date.now() > deadline) setJob(current => ({ ...(current ?? { output: "" }), pending: false, phase: "Update failed", error: "Could not reconnect. Open AFK again from your terminal; review ~/.afk/app-update.json if the restart failed." }));
        else setJob(current => ({ ...(current ?? { output: "" }), pending: true, phase: "Reconnecting to AFK…" }));
      })();
    }, 1_000);
    return () => clearInterval(timer);
  }, [client, updating]);

  const check = async () => {
    setChecking(true);
    const result = await client.app.updateCheck({ refresh: true });
    setChecking(false);
    const value = result.ok ? result.value : { current: version.data?.current ?? "", available: false, error: result.error.message };
    queries.setQueryData(versionKey, value);
    if (value.error) toast.show("Could not check for updates. Try again.");
    else toast.show(value.available ? `AFK ${value.latest} is available.` : `AFK ${value.current} is up to date.`);
  };

  const update = async () => {
    setJob({ pending: true, phase: "Starting update…", output: "" });
    const result = await client.app.update();
    if (!result.ok) setJob({ pending: false, phase: "Update failed", output: "", error: result.error.message });
  };

  const current = version.data;
  const name = current?.current ? `AFK ${current.current}` : "AFK";
  const statusText = (): string => {
    if (job?.pending) return job.phase;
    if (checking || !current) return "Checking for updates…";
    if (job?.error) return "Update needs attention";
    if (current.error) return "Update check unavailable";
    if (current.available) return `${current.latest} is available`;
    return "Up to date";
  };
  const offerUpdate = !updating && !checking && Boolean(current?.available);
  const offerCheck = !updating && !offerUpdate;

  return { name, status: statusText(), job, checking, offerUpdate, offerCheck, check, update };
}

/** Version line and update action for the rail footer and the phone More menu. */
export function UpdateStatus({ update }: { update: AppUpdate }) {
  const { name, status, job, checking, offerUpdate, offerCheck } = update;
  const failed = Boolean(job?.error);
  const hasOutput = Boolean(job?.output);

  return (
    <div className="update-status">
      <p className="meta">{`${name} · ${status}`}</p>
      {failed ? <p className="field-error">{job?.error} You can retry, or run <code>afk update</code> in your terminal.</p> : null}
      {hasOutput ? (
        <details className="update-details">
          <summary>Update details</summary>
          <pre>{job?.output}</pre>
        </details>
      ) : null}
      {offerUpdate ? <button type="button" className="primary" onClick={() => void update.update()}>Update &amp; restart</button> : null}
      {offerCheck ? <button type="button" className="text" disabled={checking} onClick={() => void update.check()}>{checking ? "Checking…" : "Check for updates"}</button> : null}
    </div>
  );
}
