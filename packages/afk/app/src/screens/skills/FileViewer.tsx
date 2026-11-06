import { useEffect, useId, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { Segmented } from "@/components/Segmented";
import type { SkillFile } from "@/screens/skills/api";
import { Markdown } from "@/screens/skills/Markdown";

const paneOptions = [{ value: "edit", label: "Plain text" }, { value: "preview", label: "Preview" }] as const;

/** Read-only files of a project or subfolder skill, through `skill/read`. */
export function FileViewer({ name, scope, folder }: { name: string; scope: string; folder?: string }) {
  const client = useClient();
  const headingId = useId();
  const [file, setFile] = useState("SKILL.md");
  const [data, setData] = useState<SkillFile | null>(null);
  const [error, setError] = useState("");
  const [pane, setPane] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    let live = true;
    void client.run("skill/read", { name, scope, file, ...(folder ? { folder } : {}) }).then(result => {
      if (!live) return;
      if (result.ok) { setData(result.value); setError(""); } else setError(result.error.message);
    });
    return () => { live = false; };
  }, [client, name, scope, file, folder]);

  if (error) return <p className="field-error" role="alert">{error}</p>;
  if (!data) return <p className="meta" role="status">Opening {name}’s files…</p>;

  const markdown = /\.md$/i.test(data.file);
  const showPreview = markdown && pane === "preview";
  const hasFiles = data.files.length > 1;

  return (
    <div className="editor">
      <div className="editor-head">
        <h3 id={headingId}>{data.file}</h3>
        {hasFiles ? (
          <label className="editor-file">
            <span className="vh">File</span>
            <select value={file} onChange={event => setFile(event.target.value)}>
              {data.files.map(path => <option key={path} value={path}>{path}</option>)}
            </select>
          </label>
        ) : null}
        {markdown ? <Segmented legend="Show the file as" options={paneOptions} value={pane} onChange={setPane} /> : null}
      </div>
      <p className="note" role="note"><b>Read-only.</b> {folder ? "Another app manages this folder." : "Project skills are changed in the project’s own repository."}</p>
      {showPreview ? <Markdown text={data.content} /> : <textarea aria-labelledby={headingId} rows={14} spellCheck={false} readOnly value={data.content} />}
    </div>
  );
}
