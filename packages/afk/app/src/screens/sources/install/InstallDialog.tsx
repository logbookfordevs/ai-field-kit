import { useEffect, useRef, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useMutation, useOperation } from "@/api/hooks";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { Progress } from "@/components/Progress";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { DestinationFields, type DestinationErrors, type DestinationValue } from "@/screens/sources/install/DestinationFields";
import { SkillPicker, type PickerItem } from "@/screens/sources/install/SkillPicker";
import { UploadDrop } from "@/screens/sources/install/UploadDrop";
import { uploadPayload, type PickedFile } from "@/screens/sources/install/upload";
import type { InstallRequest } from "@/screens/sources/install/store";
import { useSourcesState } from "@/screens/sources/data";
import { defaultBookmarkName, formatBytes, isValidSource } from "@/screens/sources/format";
import { plural, shortSource } from "@/text/format";
import type { Destination, InstallCandidate, InstallOutcome, InstallProgress, UploadCandidate, UploadPreview } from "@/screens/sources/types";
import { navigate } from "@/shell/router";
import "@/screens/sources/install/Install.css";

export interface InstallDialogProps {
  request: InstallRequest;
  onClose: () => void;
}

type Way = "repository" | "upload";

interface Errors extends DestinationErrors {
  repository?: string | undefined;
  upload?: string | undefined;
  picks?: string | undefined;
  general?: string | undefined;
}

interface Finished {
  title: string;
  sub: string;
  later: boolean;
}

const ways = [
  { value: "repository", label: "A repository" },
  { value: "upload", label: "A zip or folder" },
] as const;

const agents = ["codex", "claude-code", "cursor", "opencode"];

/** The agent chosen in the previous app, if any; the default (universal) needs no field. */
function savedAgent(): string | undefined {
  try {
    const saved = (JSON.parse(localStorage.getItem("afk.install") ?? "{}") as { agent?: unknown }).agent;
    return typeof saved === "string" && agents.includes(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

/** Add something new: look inside a repository or an upload, pick skills, choose where they go. */
export function InstallDialog({ request, onClose }: InstallDialogProps) {
  const [round, setRound] = useState(0);
  return <InstallForm key={round} request={round === 0 ? request : {}} onClose={onClose} onAgain={() => setRound(round + 1)} />;
}

function InstallForm({ request, onClose, onAgain }: InstallDialogProps & { onAgain: () => void }) {
  const client = useClient();
  const toast = useToast();
  const sources = useSourcesState();
  const repositoryInstall = useMutation("kit/install");
  const uploadInstall = useMutation("kit/upload-install");

  const [way, setWay] = useState<Way>(request.source ?? "repository");
  const [repository, setRepository] = useState(request.repository ?? "");
  const [found, setFound] = useState<{ source: string; candidates: InstallCandidate[] } | null>(null);
  const autoSearch = Boolean(request.repository?.trim()) && request.source !== "upload" && request.destination !== "later";
  const [finding, setFinding] = useState(autoSearch);
  const [upload, setUpload] = useState<{ id: string; name: string; candidates: UploadCandidate[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [place, setPlace] = useState<DestinationValue>({ destination: request.destination ?? null, pack: "", packName: "", scope: "Global", bookmarkName: "" });
  const [bookmarkEdited, setBookmarkEdited] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState<InstallProgress | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const version = useRef(0);
  const started = useRef(false);
  const repositoryField = useRef<HTMLInputElement>(null);
  const destinationGroup = useRef<HTMLFieldSetElement>(null);
  const packField = useRef<HTMLSelectElement>(null);
  const packNameField = useRef<HTMLInputElement>(null);
  const bookmarkField = useRef<HTMLInputElement>(null);

  const packs = sources.data?.settings.profiles ?? [];
  const projects = sources.data?.settings.projects ?? [];
  const uploading = way === "upload";
  const destination = place.destination;
  const pack = place.pack || (packs.length === 0 ? "new-pack" : "");
  const bookmarkName = bookmarkEdited ? place.bookmarkName : defaultBookmarkName(repository.trim());
  const pollsProgress = running && !uploading && (destination === "core" || destination === "machine");

  const progress = useOperation("skills/install-state", {}, { refetchInterval: pollsProgress ? 1_000 : false });
  const liveProgress = progress.data?.pending ? progress.data : null;

  const candidates = uploading ? upload?.candidates : found?.candidates;
  const available = (candidates ?? []).filter(candidate => candidate.state !== "tool");
  const toolOwned = (candidates ?? []).filter(candidate => candidate.state === "tool");
  const selectable = available.filter(candidate => candidate.state !== "conflict" || destination === "pack");

  const searched = uploading ? upload !== null : found !== null;
  const count = picked.size;
  const readyToList = searched && !finding && !reading;
  const showsFind = !uploading && destination !== "later";
  const savesBookmark = destination === "later";
  const cancellable = running && pollsProgress;

  const settleSearch = (mine: number, source: string, result: Awaited<ReturnType<typeof client.run>>) => {
    if (mine !== version.current) return;
    setFinding(false);
    if (!result.ok) {
      setErrors({ repository: result.error.message });
      return;
    }
    const list = (result.value as { candidates: InstallCandidate[] }).candidates;
    const open = list.filter(candidate => candidate.state !== "tool");
    const wanted = source === request.repository?.trim() ? request.skills ?? [] : [];
    const chosen = wanted.length
      ? wanted.filter(name => open.some(candidate => candidate.name === name && candidate.state !== "conflict"))
      : open[0] && open.length === 1 && open[0].state !== "conflict" ? [open[0].name] : [];
    setFound({ source, candidates: list });
    setPicked(new Set(chosen));
  };

  const search = async (source: string) => {
    if (!isValidSource(source)) {
      setErrors({ repository: "Enter a repository, like owner/repository." });
      repositoryField.current?.focus();
      return;
    }
    const mine = ++version.current;
    setErrors({});
    setFound(null);
    setPicked(new Set());
    setFinding(true);
    settleSearch(mine, source, await client.run("kit/install-preview", { source }));
  };

  useEffect(() => {
    const source = request.repository?.trim();
    if (!autoSearch || !source || started.current) return;
    started.current = true;
    const mine = ++version.current;
    void client.run("kit/install-preview", { source }).then(result => settleSearch(mine, source, result));
    // Only the first search follows the request; later ones follow the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRepository = (value: string) => {
    setRepository(value);
    setErrors(current => ({ ...current, repository: undefined, general: undefined }));
    if (found && value.trim() !== found.source) {
      version.current++;
      setFound(null);
      setPicked(new Set());
      setFinding(false);
    }
  };

  const changeWay = (next: Way) => {
    version.current++;
    setWay(next);
    setFound(null);
    setUpload(null);
    setPicked(new Set());
    setFinding(false);
    setReading(false);
    setErrors({});
    if (next === "upload" && destination === "later") setPlace(current => ({ ...current, destination: null }));
  };

  const readUpload = async (files: PickedFile[]) => {
    const mine = ++version.current;
    setErrors({});
    setUpload(null);
    setPicked(new Set());
    setReading(true);
    try {
      const prepared = await uploadPayload(files);
      if (mine !== version.current) return;
      if ("error" in prepared) {
        setErrors({ upload: prepared.error });
        return;
      }
      const result = await client.run("kit/upload-preview", prepared.payload);
      if (mine !== version.current) return;
      if (!result.ok) {
        setErrors({ upload: result.error.message });
        return;
      }
      const preview = result.value as UploadPreview;
      const first = files[0];
      const name = first && files.length === 1 && !first.path ? first.file.name : first?.path.split("/")[0] ?? "Upload";
      const open = preview.candidates.filter(candidate => candidate.state !== "tool");
      setUpload({ id: preview.upload, name, candidates: preview.candidates });
      setPicked(new Set(open.length === 1 && open[0] ? [open[0].name] : []));
    } catch (error) {
      if (mine === version.current) setErrors({ upload: error instanceof Error ? error.message : "Could not read that file." });
    } finally {
      if (mine === version.current) setReading(false);
    }
  };

  const toggle = (name: string) => {
    setErrors(current => ({ ...current, picks: undefined }));
    setPicked(current => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const toggleAll = () => {
    setErrors(current => ({ ...current, picks: undefined }));
    const everything = selectable.length > 0 && selectable.every(candidate => picked.has(candidate.name));
    setPicked(everything ? new Set() : new Set(selectable.map(candidate => candidate.name)));
  };

  const changePlace = (patch: Partial<DestinationValue>) => {
    if (patch.bookmarkName !== undefined) setBookmarkEdited(true);
    setPlace(current => ({ ...current, ...patch }));
    setErrors(current => ({ ...current, destination: undefined, pack: undefined, packName: undefined, bookmarkName: undefined, general: undefined }));
  };

  const targetName = pack === "new-pack" ? place.packName.trim() : packs.find(item => item.id === pack)?.name ?? "";

  const actionLabel = (): string => {
    if (savesBookmark) return "Save to Try later";
    const skills = plural(count, "skill");
    if (!count) return "Install";
    if (destination === "core") return `Install ${skills} to Core`;
    if (destination === "machine") return `Install ${skills} ${place.scope === "Global" || uploading ? "on this machine" : `in ${place.scope}`}`;
    if (destination === "pack") return `Install ${skills} to ${pack === "new-pack" ? "a new pack" : targetName || "a pack"}`;
    return "Install";
  };

  const fail = (next: Errors, focus?: () => void) => {
    setErrors(next);
    focus?.();
  };

  const submit = async () => {
    const source = repository.trim();
    if (!uploading && !isValidSource(source)) return fail({ repository: "Enter a repository, like owner/repository." }, () => repositoryField.current?.focus());
    if (uploading && !upload) return fail({ upload: "Choose a zip, a .skill file or a folder first." });
    if (!destination) return fail({ destination: "Choose where the skills go." }, () => destinationGroup.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus());

    if (destination === "later") {
      const name = bookmarkName.trim();
      if (!name) return fail({ bookmarkName: "Give this repository a name." }, () => bookmarkField.current?.focus());
      const names = found?.source === source ? [...picked] : [];
      await run({ source, names, to: "later", name }, destination, names.length, { later: source });
      return;
    }

    if (!uploading && found?.source !== source) return fail({ repository: "Find the skills in this repository first." }, () => repositoryField.current?.focus());
    if (!count) return fail({ picks: "Select at least one skill to install." });
    if (destination === "pack") {
      if (!pack) return fail({ pack: "Choose a pack." }, () => packField.current?.focus());
      if (pack === "new-pack" && !place.packName.trim()) return fail({ packName: "Name the new pack." }, () => packNameField.current?.focus());
    }

    const names = [...picked];
    const to = destination === "pack" ? pack : destination;
    const packName = pack === "new-pack" && destination === "pack" ? { packName: place.packName.trim() } : {};
    if (uploading && upload) {
      const replace = upload.candidates.filter(candidate => candidate.state === "installed" && picked.has(candidate.name)).map(candidate => candidate.name);
      await run({ upload: upload.id, names, to, ...packName, ...(replace.length ? { replace } : {}) }, destination, names.length, {});
      return;
    }
    const replace = destination === "pack" ? [] : available.filter(candidate => candidate.state === "conflict" && picked.has(candidate.name)).map(candidate => candidate.name);
    const agent = destination === "core" || destination === "machine" ? savedAgent() : undefined;
    await run({
      source, names, to, ...packName,
      ...(destination === "machine" && place.scope !== "Global" ? { scope: place.scope } : {}),
      ...(agent ? { agent } : {}),
      ...(replace.length ? { replace } : {}),
    }, destination, names.length, {});
  };

  const run = async (payload: Record<string, unknown>, to: Destination, installed: number, bookmark: { later?: string }) => {
    setRunning(true);
    setStopped(null);
    setErrors({});
    const result = uploading ? await uploadInstall.run(payload) : await repositoryInstall.run(payload);
    setRunning(false);
    if (!result.ok) {
      setErrors({ general: result.error.message });
      return;
    }
    const outcome = result.value as InstallOutcome;
    if (!outcome.ok) {
      setStopped(outcome.install ?? null);
      setErrors({ general: to === "core" ? "Installation stopped, so nothing was added to Core. Review the output, then retry." : "Installation stopped. Review the output, then retry." });
      return;
    }
    setFinished(finishedFor(to, installed, uploading, { packName: targetName, scope: place.scope, later: bookmark.later }));
  };

  const cancelInstall = async () => {
    const result = await client.run("skills/install-cancel", {});
    const cancelled = result.ok && (result.value as { cancelled?: boolean }).cancelled;
    if (!cancelled) toast.show(result.ok ? (result.value as { reason?: string }).reason ?? "There is nothing to cancel." : result.error.message);
  };

  const readSkill = async (name: string): Promise<string> => {
    const result = await client.run("kit/install-read", { source: found?.source ?? repository.trim(), name });
    if (!result.ok) throw new Error(result.error.message);
    return (result.value as { content: string }).content;
  };

  const items: PickerItem[] = available.map(candidate => ({ name: candidate.name, description: candidate.description, notes: notesFor(candidate, uploading, destination) }));

  const openNext = () => {
    onClose();
    if (!finished) return;
    if (finished.later) {
      navigate("sources");
      requestAnimationFrame(() => document.getElementById("try-later")?.focus());
    } else navigate("skills");
  };

  const title = finished ? (finished.later ? "Saved for later" : "Installed") : savesBookmark && !uploading ? "Save a repository for later" : "Add something new";

  const footer = finished ? (
    <>
      <button type="button" className="text" onClick={onAgain}>Add another</button>
      <button type="button" className="primary" onClick={openNext}>{finished.later ? "Open Try later" : "Open in Skills"}</button>
    </>
  ) : (
    <>
      {running ? null : <button type="button" className="text" onClick={onClose}>Cancel</button>}
      {cancellable ? <button type="button" className="text danger-text" onClick={() => { void cancelInstall(); }}>Cancel installation</button> : null}
      <button type="button" className="primary" disabled={running} onClick={() => { void submit(); }}>{running ? "Installing…" : actionLabel()}</button>
    </>
  );

  const showsProgress = running || liveProgress !== null;
  const output = (running ? liveProgress : stopped) ?? stopped;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={footer}
      canClose={!running}
      onCloseBlocked={() => toast.show("Installation is still running. Cancel it first to close.")}
      initialFocus={repositoryField}
    >
      {finished ? (
        <div className="success">
          <span className="tick"><Icon name="check" /></span>
          <h3>{finished.title}</h3>
          <p className="sub">{finished.sub}</p>
        </div>
      ) : (
        <>
          <Segmented legend="Install from" showLegend options={ways} value={way} onChange={changeWay} disabled={running} />

          {uploading ? (
            <div className="blk">
              <UploadDrop onFiles={files => { void readUpload(files); }} disabled={running || reading} loaded={upload?.name} describedBy="upload-note" />
              {reading ? <p className="meta" role="status">Looking for SKILL.md files…</p> : null}
              <p className="field-error" role="alert">{errors.upload}</p>
            </div>
          ) : (
            <div className="blk">
              <div className="field-row">
                <label>
                  Repository
                  <input
                    ref={repositoryField}
                    value={repository}
                    placeholder="owner/repository or URL"
                    autoComplete="off"
                    disabled={running}
                    aria-invalid={errors.repository ? true : undefined}
                    aria-describedby="repository-hint repository-error"
                    onChange={event => changeRepository(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (showsFind) void search(repository.trim());
                    }}
                  />
                </label>
                {showsFind ? <button type="button" disabled={finding || running} onClick={() => { void search(repository.trim()); }}>{finding ? "Finding…" : "Find skills"}</button> : null}
              </div>
              <p className="hint" id="repository-hint">{savesBookmark ? "AFK saves the link. Nothing is downloaded." : "For example owner/repository or a GitHub URL."}</p>
              <p className="field-error" id="repository-error" role="alert">{errors.repository}</p>
            </div>
          )}

          {finding ? <p className="meta" role="status">Looking for SKILL.md files in {shortSource(repository)}…</p> : null}

          {readyToList && items.length > 0 ? (
            <SkillPicker
              legend={`Skills in ${uploading ? upload?.name : shortSource(found?.source ?? repository)}`}
              items={items}
              picked={picked}
              onToggle={toggle}
              onToggleAll={toggleAll}
              {...(errors.picks ? { error: errors.picks } : {})}
              {...(uploading ? {} : { readSkill })}
            />
          ) : null}
          {readyToList && items.length === 0 ? <p className="meta">No installable skills were found{uploading ? " in that upload" : " in this repository"}.</p> : null}
          {readyToList && toolOwned.length > 0 ? (
            <p className="hint">Left out because a tool installs them: {toolOwned.map(candidate => `${candidate.name} (${candidate.tool})`).join(", ")}.</p>
          ) : null}
          {readyToList && uploading && items.length > 0 ? (
            <p className="hint" id="upload-note">In Core or a pack their files are saved in your library and backup. A pack that holds one can’t be exported as a manifest.</p>
          ) : null}

          <DestinationFields
            value={{ ...place, pack, bookmarkName }}
            onChange={changePlace}
            packs={packs}
            projects={projects}
            upload={uploading}
            errors={errors}
            groupRef={destinationGroup}
            packRef={packField}
            packNameRef={packNameField}
            bookmarkRef={bookmarkField}
          />

          {showsProgress ? <InstallOutput progress={output} /> : null}
          {!showsProgress && stopped ? <InstallOutput progress={stopped} /> : null}
          <p className="field-error" role="alert">{errors.general}</p>
        </>
      )}
    </Dialog>
  );
}

function notesFor(candidate: InstallCandidate | UploadCandidate, uploading: boolean, destination: Destination | null): PickerItem["notes"] {
  const notes: PickerItem["notes"] = [];
  const from = candidate.installedFrom ?? "an unknown source";
  if ("files" in candidate) notes.push({ text: `${plural(candidate.files, "file")} · ${formatBytes(candidate.bytes)}` });
  if (uploading) {
    if (candidate.state === "installed") notes.push({ text: candidate.installedFrom ? `Installed from ${from}. Installing replaces it.` : "Already installed. Installing replaces it.", warning: true });
    return notes;
  }
  if (candidate.state === "conflict") notes.push({ text: destination === "pack" ? `Installed from ${from}. The pack uses that copy.` : `Installed from ${from}. Installing replaces it.`, warning: true });
  if (candidate.state === "installed") notes.push({ text: "Already installed" });
  if (candidate.inKit) notes.push({ text: `In ${candidate.inKit}` });
  return notes;
}

function finishedFor(to: Destination, count: number, uploading: boolean, where: { packName: string; scope: string; later: string | undefined }): Finished {
  const skills = plural(count, "skill");
  if (to === "later") return { later: true, title: `${shortSource(where.later ?? "The repository")} is in Try later`, sub: "Install it from Sources whenever you want. Nothing was downloaded." };
  if (to === "core") return { later: false, title: `${skills} installed to Core`, sub: uploading ? "Saved in your library and added to Core. It is in your backup." : "They are on for every agent and saved with your next backup." };
  if (to === "pack") {
    return { later: false, title: `${skills} added to ${where.packName || "the pack"}`, sub: uploading ? "Saved in your library and added to the pack. Turning the pack on needs no download." : "Their files are downloaded, and the pack stays on or off as it was." };
  }
  const project = !uploading && where.scope !== "Global";
  return {
    later: false,
    title: `${skills} installed ${project ? `in ${where.scope}` : "on this machine"}`,
    sub: project ? "They stay with that project and are never backed up." : uploading ? "Installed on this machine only. It stays out of your library." : "They stay on this machine and are never backed up.",
  };
}

function elapsed(progress: InstallProgress): string {
  if (!progress.startedAt) return "";
  const seconds = Math.max(0, Math.floor(((progress.finishedAt ?? Date.now()) - progress.startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function InstallOutput({ progress }: { progress: InstallProgress | null }) {
  const detail = progress ? [progress.item, elapsed(progress)].filter(Boolean).join(" · ") : "";
  const determinate = progress !== null && progress.total > 0;
  return (
    <div className="install-output" role="status">
      {progress && determinate ? <Progress label={progress.phase} value={progress.completed} max={progress.total} /> : <Progress label={progress?.phase ?? "Installing…"} />}
      {detail ? <p className="meta">{detail}</p> : null}
      {progress?.pending && progress.lastLine ? <p className="meta">{progress.lastLine}</p> : null}
      {progress?.output ? (
        <details open={!progress.pending && progress.code !== undefined && progress.code !== 0}>
          <summary>Skills CLI output</summary>
          <pre>{progress.output}</pre>
        </details>
      ) : null}
    </div>
  );
}
