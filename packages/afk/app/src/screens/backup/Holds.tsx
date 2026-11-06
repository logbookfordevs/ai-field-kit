import { count, megabytes } from "@/screens/backup/format";
import type { BackupContents } from "../../../../src/fieldwork/library-backup.js";

const staysHere = ["Skills kept on this machine only", "Skills that are off", "Pack skill files (they download again)", "Project folders"];

export function Holds({ contents }: { contents: BackupContents }) {
  const saved = [
    `${count(contents.coreSkills, "Core skill")} (${megabytes(contents.skillBytes)})`,
    count(contents.packs, "pack definition"),
    count(contents.tools, "tool"),
    count(contents.bookmarks, "Try later bookmark"),
    count(contents.choices, "Manual/Automatic choice"),
    ...(contents.rules ? ["AGENTS.md and references"] : []),
  ];
  return (
    <section aria-labelledby="holds-h">
      <div className="sec-head"><h2 id="holds-h">What a backup holds</h2></div>
      <div className="two">
        <div><h3>Saved</h3><ul className="plain" aria-label="Saved in the backup">{saved.map(line => <li key={line}>{line}</li>)}</ul></div>
        <div><h3>Stays on this machine</h3><ul className="plain" aria-label="Stays on this machine">{staysHere.map(line => <li key={line}>{line}</li>)}</ul></div>
      </div>
    </section>
  );
}
