import { useState, type ReactNode } from "react";
import { useOperation } from "@/api/hooks";
import { FirstRun, type FirstRunKind, type StartRequest } from "@/first-run/FirstRun";
import { navigate, useRoute, type Route } from "@/shell/router";
import type { ScreenId } from "@/screens/types";
import "@/first-run/operations";
import "@/first-run/first-run.css";

const welcomeDismissed = (settings: object): boolean => "welcomeDismissed" in settings && settings.welcomeDismissed === true;

type Decision = { kind: "app" } | { kind: "first-run"; mode: FirstRunKind; pendingRepository?: string; start?: StartRequest };

/** Settings links to `#/overview?start=library` or `?start=restore` while this machine has no library. */
function startRequest({ screen, params }: Route): StartRequest | undefined {
  const start = params.get("start");
  return screen === "overview" && (start === "library" || start === "restore") ? start : undefined;
}

/**
 * Puts the first-run flow in front of the app when this machine has no library, a restore did not finish, or AFK
 * started an empty library and nobody has answered yet. The decision is made once, so finishing a step (which
 * changes what the machine reports) cannot pull the flow away mid-way.
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const backup = useOperation("backup/state", { brief: true });
  const status = backup.data?.status;
  const isFresh = status?.fresh === true;
  const settings = useOperation("state", {}, { enabled: isFresh });
  const [decided, setDecided] = useState<Decision | null>(null);
  const requested = startRequest(useRoute());
  const canStart = status?.library === false && status.restoring === undefined;

  const computed = decide();
  if (computed && !decided) setDecided(computed);
  if (requested && canStart && decided?.kind === "app") setDecided({ kind: "first-run", mode: "new", start: requested });

  function decide(): Decision | null {
    if (backup.error) return { kind: "app" };
    if (!status) return null;
    if (status.restoring !== undefined) return { kind: "first-run", mode: "restoring", pendingRepository: status.restoring };
    if (!status.library) return { kind: "first-run", mode: "new", ...(requested ? { start: requested } : {}) };
    if (!isFresh) return { kind: "app" };
    if (settings.error) return { kind: "app" };
    if (!settings.data) return null;
    return welcomeDismissed(settings.data.settings) ? { kind: "app" } : { kind: "first-run", mode: "ready" };
  }

  const decision = decided ?? computed;
  const finish = (to?: ScreenId) => {
    if (to) navigate(to);
    else if (requested) navigate("overview");
    setDecided({ kind: "app" });
  };

  if (!decision) return <p className="fr-loading" role="status">Opening AFK…</p>;
  if (decision.kind === "app") return children;
  return <FirstRun kind={decision.mode} pendingRepository={decision.pendingRepository} start={decision.start} onFinish={finish} />;
}
