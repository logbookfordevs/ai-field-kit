import { useEffect, useRef, useState } from "react";
import type { LibraryInitPlan } from "../../../src/fieldwork/library-init.js";
import type { LibraryPreview, RestoreSummary } from "../../../src/fieldwork/library-restore.js";
import type { Tool } from "../../../src/fieldwork/settings.js";
import { useMutation } from "@/api/hooks";
import { Choose, type StartChoice } from "@/first-run/Choose";
import { Restored, Started } from "@/first-run/Done";
import { RestorePick } from "@/first-run/RestorePick";
import { Restoring } from "@/first-run/Restoring";
import { StartPreview, Starting } from "@/first-run/StartPreview";
import { RunningTools, ToolApproval } from "@/first-run/ToolApproval";
import type { ScreenId } from "@/screens/types";

/** new: no library yet. ready: AFK started an empty one. restoring: a restore put the library in place but did not finish. */
export type FirstRunKind = "new" | "ready" | "restoring";

type Step =
  | { name: "choose" }
  | { name: "preview" }
  | { name: "starting" }
  | { name: "started"; plan: LibraryInitPlan }
  | { name: "pick" }
  | { name: "restoring"; label: string; preview?: LibraryPreview }
  | { name: "tools"; summary: RestoreSummary }
  | { name: "running"; summary: RestoreSummary; tool: Tool; position: number; total: number }
  | { name: "restored"; summary: RestoreSummary; ran: string[]; failed: string[] };

type Stage = 0 | 1 | 2;

const stageOf: Record<Step["name"], Stage> = { choose: 0, preview: 1, starting: 1, pick: 1, restoring: 1, tools: 1, running: 1, started: 2, restored: 2 };

function Steps({ stage, restoring }: { stage: Stage; restoring: boolean }) {
  const labels = ["Choose", restoring ? "Pick library" : "Preview", "Done"];
  return (
    <ol className="fr-steps" aria-label="Steps">
      {labels.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined}>{label}</li>)}
    </ol>
  );
}

export interface FirstRunProps {
  kind: FirstRunKind;
  pendingRepository?: string | undefined;
  /** Leaves the flow for the app, optionally opening a section. */
  onFinish: (to?: ScreenId) => void;
}

/** The full-page first-run flow shown in front of the app. */
export function FirstRun({ kind, pendingRepository, onFinish }: FirstRunProps) {
  const [step, setStep] = useState<Step>(kind === "restoring" ? { name: "pick" } : { name: "choose" });
  const [problem, setProblem] = useState("");
  const [address, setAddress] = useState(pendingRepository ?? "");
  const [restoringPath, setRestoringPath] = useState(kind === "restoring");
  const main = useRef<HTMLElement>(null);
  const shown = useRef(false);
  const attempt = useRef(0);

  const welcome = useMutation("welcome");
  const init = useMutation("library/init");
  const inspect = useMutation("restore/inspect");
  const start = useMutation("restore/start");
  const cancel = useMutation("restore/cancel");
  const runTool = useMutation("tool/run");

  useEffect(() => {
    if (!shown.current) { shown.current = true; return; }
    main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  }, [step.name]);

  const finish = async (to?: ScreenId) => {
    await welcome.run({});
    onFinish(to);
  };

  const choose = (choice: StartChoice) => {
    setProblem("");
    if (choice === "backup") return void finish("backup");
    setRestoringPath(choice === "restore");
    setStep(choice === "restore" ? { name: "pick" } : { name: "preview" });
  };

  const startLibrary = async (plan: LibraryInitPlan) => {
    setProblem("");
    setStep({ name: "starting" });
    const result = await init.run({ expected: plan });
    if (!result.ok) {
      setProblem(result.error.message);
      setStep({ name: "preview" });
      return;
    }
    await welcome.run({});
    setStep({ name: "started", plan: result.value });
  };

  const restoreFrom = async (repository: string, label: string) => {
    const mine = ++attempt.current;
    const cancelled = () => attempt.current !== mine;
    setProblem("");
    setStep({ name: "restoring", label });
    const checked = await inspect.run({ repository });
    if (cancelled()) return;
    if (!checked.ok) {
      setProblem(checked.error.message);
      setStep({ name: "pick" });
      return;
    }
    setStep({ name: "restoring", label, preview: checked.value });
    const restored = await start.run({ repository });
    if (cancelled()) return;
    if (!restored.ok) {
      setProblem(restored.error.message);
      setStep({ name: "pick" });
      return;
    }
    await welcome.run({});
    setStep(restored.value.tools.length > 0 ? { name: "tools", summary: restored.value } : { name: "restored", summary: restored.value, ran: [], failed: [] });
  };

  const cancelRestore = async () => {
    attempt.current += 1;
    setProblem("");
    setStep({ name: "pick" });
    await cancel.run({});
  };

  const runTools = async (summary: RestoreSummary, chosen: Tool[]) => {
    const ran: string[] = [];
    const failed: string[] = [];
    for (const [index, tool] of chosen.entries()) {
      setStep({ name: "running", summary, tool, position: index + 1, total: chosen.length });
      const result = await runTool.run({ id: tool.id });
      if (result.ok && result.value.code === 0) ran.push(tool.name);
      else failed.push(tool.name);
    }
    setStep({ name: "restored", summary, ran, failed });
  };

  const backToChoose = () => {
    setProblem("");
    setStep({ name: "choose" });
  };

  return (
    <div className="fr">
      <header className="fr-top">
        <div className="brand"><b>afk.</b><span>AI Field Kit</span></div>
        <Steps stage={stageOf[step.name]} restoring={restoringPath} />
      </header>
      <main id="main" className="fr-main" ref={main} tabIndex={-1}>
        {step.name === "choose" ? <Choose ready={kind === "ready"} onChoose={choose} onSkip={() => void finish()} /> : null}
        {step.name === "preview" ? <StartPreview problem={problem} onBack={backToChoose} onStart={plan => void startLibrary(plan)} /> : null}
        {step.name === "starting" ? <Starting /> : null}
        {step.name === "started" ? <Started plan={step.plan} onOpenBackup={() => void finish("backup")} onOpenApp={() => void finish()} /> : null}
        {step.name === "pick" ? (
          <RestorePick
            pendingRepository={pendingRepository}
            address={address}
            onAddress={setAddress}
            problem={problem}
            onRestore={(repository, label) => void restoreFrom(repository, label)}
            onBack={kind === "restoring" ? null : backToChoose}
          />
        ) : null}
        {step.name === "restoring" ? <Restoring label={step.label} preview={step.preview} onCancel={() => void cancelRestore()} /> : null}
        {step.name === "tools" ? <ToolApproval tools={step.summary.tools} onRun={chosen => void runTools(step.summary, chosen)} onSkip={() => setStep({ name: "restored", summary: step.summary, ran: [], failed: [] })} /> : null}
        {step.name === "running" ? <RunningTools name={step.tool.name} position={step.position} total={step.total} /> : null}
        {step.name === "restored" ? <Restored summary={step.summary} ran={step.ran} failed={step.failed} onOpenBackup={() => void finish("backup")} onOpenApp={() => void finish()} /> : null}
      </main>
    </div>
  );
}
