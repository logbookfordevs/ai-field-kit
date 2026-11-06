import { Menu, MenuItem } from "@/components/Menu";
import { Tags } from "@/components/Tags";
import { useToast } from "@/components/Toast";
import { commandFor, type RunKind, type ToolEntry, type ToolRun } from "@/screens/tools/types";

export interface ToolRowProps {
  tool: ToolEntry;
  run: ToolRun | undefined;
  onRun: (kind: RunKind) => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function lastRunText(run: ToolRun | undefined): { text: string; tone: "idle" | "running" | "ok" | "failed" } {
  if (!run) return { text: "Not run this session", tone: "idle" };
  if (run.pending) return { text: "Running…", tone: "running" };
  return { text: `Last run · exit ${run.code ?? 1}`, tone: run.code === 0 ? "ok" : "failed" };
}

export function ToolRow({ tool, run, onRun, onEdit, onRemove }: ToolRowProps) {
  const toast = useToast();
  const status = lastRunText(run);

  const copy = async (kind: RunKind) => {
    try {
      await navigator.clipboard.writeText(commandFor(tool, kind));
      toast.show(`Copied the ${kind} command. Nothing was run.`);
    } catch {
      toast.show("Couldn't copy. Select the command and copy it yourself.");
    }
  };

  return (
    <li className="row tool-row">
      <div className="row-main">
        <h2 className="tool-name">{tool.name}</h2>
        <p className={`tool-last ${status.tone}`}>{status.text}</p>
        {tool.provides?.length ? <Tags label={`Skills ${tool.name} brings`} items={tool.provides} /> : null}
      </div>
      <div className="row-actions">
        <button type="button" aria-label={`Run install for ${tool.name}`} onClick={() => onRun("install")}>Run install</button>
        <button type="button" aria-label={`Run update for ${tool.name}`} onClick={() => onRun("update")}>Run update</button>
        <button type="button" className="text" aria-label={`Edit ${tool.name}`} onClick={onEdit}>Edit</button>
        <Menu label={`More for ${tool.name}`}>
          <MenuItem danger onSelect={onRemove}>Remove entry…</MenuItem>
        </Menu>
      </div>
      <dl className="tool-cmds">
        <div>
          <dt>Install command</dt>
          <dd>
            <code className="tool-cmd">{tool.install}</code>
            <button type="button" className="copy" aria-label={`Copy install command for ${tool.name}`} onClick={() => void copy("install")}>Copy</button>
          </dd>
        </div>
        <div>
          <dt>Update command</dt>
          <dd>
            {tool.update ? (
              <>
                <code className="tool-cmd">{tool.update}</code>
                <button type="button" className="copy" aria-label={`Copy update command for ${tool.name}`} onClick={() => void copy("update")}>Copy</button>
              </>
            ) : <span className="meta">Reuses the install command</span>}
          </dd>
        </div>
      </dl>
    </li>
  );
}
