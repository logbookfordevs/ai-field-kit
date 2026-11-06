import { useRef, useState, type DragEvent } from "react";
import { chosenFiles, droppedFiles, type PickedFile } from "@/screens/sources/install/upload";

export interface UploadDropProps {
  onFiles: (files: PickedFile[]) => void;
  disabled: boolean;
  /** Name of the file already read, so the person can see what is loaded. */
  loaded?: string | undefined;
  describedBy?: string | undefined;
}

export function UploadDrop({ onFiles, disabled, loaded, describedBy }: UploadDropProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    onFiles(await droppedFiles(event.dataTransfer));
  };
  const onChosen = (input: HTMLInputElement) => {
    const files = chosenFiles(input.files);
    input.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={dragging ? "drop dragging" : "drop"}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { void onDrop(event); }}
    >
      <p><b>Drop a .zip, a .skill file or a folder here</b></p>
      <p className="sub" id={describedBy}>AFK finds every SKILL.md inside. Uploaded skills have no repository, so they don’t update on their own.</p>
      {loaded ? <p className="meta">Loaded: <span className="mono">{loaded}</span></p> : null}
      <div className="acts">
        <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}>Choose file…</button>
        <button type="button" disabled={disabled} onClick={() => folderInput.current?.click()}>Choose folder…</button>
      </div>
      <input ref={fileInput} type="file" accept=".zip,.skill" hidden aria-label="Zip or .skill file" onChange={event => onChosen(event.currentTarget)} />
      <input ref={folderInput} type="file" hidden aria-label="Skill folder" onChange={event => onChosen(event.currentTarget)} {...{ webkitdirectory: "" }} />
    </div>
  );
}
