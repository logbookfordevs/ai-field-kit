import { useState } from "react";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";
import { PathCard } from "@/components/PathCard";
import { Progress } from "@/components/Progress";
import { Ledger, Row } from "@/components/Row";
import { Segmented } from "@/components/Segmented";
import { Switch } from "@/components/Switch";
import { Tags } from "@/components/Tags";
import { ToastProvider, useToast } from "@/components/Toast";
import { Page } from "@/shell/Page";
import "@/shell/Shell.css";

const startOptions = [{ value: "manual", label: "Manual" }, { value: "auto", label: "Automatic" }] as const;

function Rows() {
  const toast = useToast();
  const [on, setOn] = useState(true);
  const [start, setStart] = useState<"manual" | "auto">("manual");
  return (
    <Ledger label="Skills">
      <Row
        title={<span className="sname">north-plan</span>}
        description="Turns a rough goal into a short, ordered plan with checkpoints and owners for each step."
        meta="Core · fieldnotes/agent-skills"
        aside={<><Switch label="north-plan" checked={on} onChange={setOn} /><Segmented legend="How north-plan starts" options={startOptions} value={start} onChange={setStart} /></>}
        actions={(
          <Menu label="More for north-plan">
            <MenuItem onSelect={() => toast.show("Inspect north-plan")}>Inspect</MenuItem>
            <MenuItem onSelect={() => toast.show("north-plan updated", { action: { label: "Undo", onAction: () => toast.show("Undone") } })}>Update</MenuItem>
            <MenuItem onSelect={() => {}} disabledReason="Installed by a tool.">Move to…</MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => toast.show("Deleted")}>Delete…</MenuItem>
          </Menu>
        )}
      />
      <Row title="Hairline" description="Typography presets" meta="fieldnotes/hairline" actions={<button type="button">Install…</button>} />
    </Ledger>
  );
}

function Dialogs() {
  const [open, setOpen] = useState<"default" | "sheet" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const close = () => { setOpen(null); setBlocked(false); };
  return (
    <div className="head-actions">
      <button type="button" className="primary" onClick={() => setOpen("default")}>Save a repository</button>
      <button type="button" onClick={() => setOpen("sheet")}>Open side panel</button>
      <Dialog open={open === "default"} onClose={close} title="Save for later" description="Nothing is installed until you choose." footer={<><button type="button" onClick={close}>Cancel</button><button type="button" className="primary" onClick={close}>Save</button></>}>
        <label>Repository<input placeholder="owner/repo" /></label>
        <label>Name<input /></label>
      </Dialog>
      <Dialog variant="sheet" open={open === "sheet"} onClose={close} canClose={!dirty} onCloseBlocked={() => setBlocked(true)} title="north-plan" description="Core · fieldnotes/agent-skills">
        <label>SKILL.md<textarea defaultValue={"---\nname: north-plan\n---\n"} onChange={() => setDirty(true)} /></label>
        {blocked ? <p className="field-error">Save or revert your changes before closing.</p> : null}
        <button type="button" onClick={() => { setDirty(false); setBlocked(false); }}>Revert</button>
      </Dialog>
    </div>
  );
}

export function Gallery() {
  return (
    <ToastProvider>
      <main style={{ maxWidth: 1240, margin: "0 auto" }}>
        <Page title="Components" description="Shared pieces for every screen. Dev only; not part of the build." actions={<Dialogs />}>
          <section><Rows /></section>
          <section><Tags label="Members" items={["north-plan", "kami", { name: "quill-sketch", away: true }]} /></section>
          <section style={{ display: "grid", gap: 8 }}>
            <PathCard label="Library" path="~/.afk/library" />
            <PathCard label="Agents read from" path="~/.agents/skills · ~/.claude/skills" action={<button type="button" className="text">Copy</button>} />
          </section>
          <section style={{ display: "grid", gap: 16, maxWidth: 420 }}>
            <Progress label="Downloading 2 of 5 skills" value={2} max={5} />
            <Progress label="Looking inside the repository" />
          </section>
          <section>
            <EmptyState title="Nothing saved for later" actions={<button type="button">Save a repository for later</button>}>Bookmark a repository you want to look at later. Nothing is installed until you choose.</EmptyState>
          </section>
        </Page>
      </main>
    </ToastProvider>
  );
}
