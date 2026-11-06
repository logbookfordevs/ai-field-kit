import type { LibraryPreview } from "../../../src/fieldwork/library-restore.js";
import { Icon } from "@/components/Icon";
import { Progress } from "@/components/Progress";
import { plural as count } from "@/text/format";

function found(preview: LibraryPreview): string {
  return `Found an AFK library with ${count(preview.coreSkills, "Core skill")}, ${count(preview.packs, "pack")} and ${count(preview.tools, "tool")}.`;
}

export function Restoring({ label, preview, onCancel }: { label: string; preview: LibraryPreview | undefined; onCancel: () => void }) {
  const downloading = preview !== undefined;
  return (
    <>
      <div><h1 tabIndex={-1}>Restoring {label}</h1></div>
      <ol className="phases" aria-label="Progress">
        <li className={downloading ? "done" : "now"}>
          {downloading ? <Icon name="check" size="sm" /> : <span className="dot" aria-hidden="true" />}
          <span>Check that it is an AFK library<span className="vh">{downloading ? " (done)" : " (in progress)"}</span></span>
        </li>
        <li className={downloading ? "now" : ""}>
          <span className="dot" aria-hidden="true" />
          <span>Download it and link your skills{downloading ? <span className="vh"> (in progress)</span> : null}</span>
        </li>
      </ol>
      <div role="status">
        <Progress label={preview ? found(preview) : "Checking the repository…"} />
      </div>
      <p className="sub">Nothing is lost if this stops. The library is only put in place once the download is complete.</p>
      <div className="fr-acts"><button type="button" onClick={onCancel}>Cancel</button></div>
    </>
  );
}
