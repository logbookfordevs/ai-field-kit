import { useState } from "react";
import { useOperation } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { Ledger } from "@/components/Row";
import { Menu, MenuItem } from "@/components/Menu";
import { PathCard } from "@/components/PathCard";
import { BatchDialog } from "@/screens/tools/BatchDialog";
import { RemoveDialog } from "@/screens/tools/RemoveDialog";
import { RunDialog } from "@/screens/tools/RunDialog";
import { ToolDialog } from "@/screens/tools/ToolDialog";
import { ToolRow } from "@/screens/tools/ToolRow";
import { pollEvery, type RunKind, type ToolEntry } from "@/screens/tools/types";
import { Page } from "@/shell/Page";
import "@/screens/tools/tools.css";

type Dialogs =
  | { kind: "edit"; tool?: ToolEntry }
  | { kind: "remove"; tool: ToolEntry }
  | { kind: "run"; tool: ToolEntry; run: RunKind }
  | { kind: "batch"; run: RunKind };

export function ToolsScreen() {
  const [dialog, setDialog] = useState<Dialogs | null>(null);
  const [polling, setPolling] = useState(false);
  const state = useOperation("tool/state", {}, { refetchInterval: polling ? pollEvery : false });
  const tools = state.data?.tools ?? [];
  const runs = state.data?.runs ?? {};
  const anyRunning = Object.values(runs).some(run => run.pending);
  if (anyRunning !== polling) setPolling(anyRunning);
  const hasTools = tools.length > 0;
  const isEmpty = state.data !== undefined && !hasTools;
  const failedToLoad = state.error !== null && state.data === undefined;
  const close = () => setDialog(null);
  const home = state.data?.home ?? "";

  const actions = (
    <>
      <button type="button" className="primary" onClick={() => setDialog({ kind: "edit" })}>Add tool</button>
      <Menu label="More tool actions">
        <MenuItem onSelect={() => setDialog({ kind: "batch", run: "install" })} {...(hasTools ? {} : { disabledReason: "Add a tool first." })}>Install all tools…</MenuItem>
        <MenuItem onSelect={() => setDialog({ kind: "batch", run: "update" })} {...(hasTools ? {} : { disabledReason: "Add a tool first." })}>Update all tools…</MenuItem>
      </Menu>
    </>
  );

  return (
    <Page title="Tools" description="Saved install and update commands for the tools your agents use. Each runs only when you press Run." actions={actions}>
      {failedToLoad ? <p className="field-error" role="alert">{state.error?.message}</p> : null}
      {home ? <PathCard label="Commands run in" path={home} /> : null}
      {hasTools ? (
        <Ledger label="Tools" className="tools-ledger">
          {tools.map(tool => (
            <ToolRow
              key={tool.id}
              tool={tool}
              run={runs[tool.id]}
              onRun={run => setDialog({ kind: "run", tool, run })}
              onEdit={() => setDialog({ kind: "edit", tool })}
              onRemove={() => setDialog({ kind: "remove", tool })}
            />
          ))}
        </Ledger>
      ) : null}
      {isEmpty ? (
        <EmptyState title="No tools saved" actions={<button type="button" className="primary" onClick={() => setDialog({ kind: "edit" })}>Add tool</button>}>
          Save a tool&apos;s install and update commands to keep them together and run them from here.
        </EmptyState>
      ) : null}
      {dialog?.kind === "edit" ? <ToolDialog key={dialog.tool?.id ?? "new"} {...(dialog.tool ? { tool: dialog.tool } : {})} onClose={close} /> : null}
      {dialog?.kind === "remove" ? <RemoveDialog tool={dialog.tool} onClose={close} /> : null}
      {dialog?.kind === "run" ? <RunDialog tool={dialog.tool} kind={dialog.run} home={home} onClose={close} /> : null}
      {dialog?.kind === "batch" ? <BatchDialog tools={tools} kind={dialog.run} home={home} onClose={close} /> : null}
    </Page>
  );
}
