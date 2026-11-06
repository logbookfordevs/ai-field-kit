import { diffRows } from "@/screens/rules/model";

/** Changed lines between two texts; added and removed lines say so in text for screen readers. */
export function Diff({ before, after, label }: { before: string | null; after: string | null; label: string }) {
  const rows = diffRows(before, after);
  return (
    <div className="diff" role="region" tabIndex={0} aria-label={label}>
      {rows.map((row, index) => {
        if (row.kind === "fold") return <div key={index} className="fold">{row.text}</div>;
        const gutter = row.kind === "add" ? "+" : row.kind === "del" ? "−" : "";
        const spoken = row.kind === "add" ? "Added: " : row.kind === "del" ? "Removed: " : "";
        return (
          <div key={index} className={row.kind}>
            <span className="g" aria-hidden="true">{gutter}</span>
            <span>{spoken ? <span className="vh">{spoken}</span> : null}{row.text || " "}</span>
          </div>
        );
      })}
    </div>
  );
}
