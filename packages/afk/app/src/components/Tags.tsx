import "@/components/Tags.css";

export type TagItem = string | { name: string; away?: boolean };

/** Compact mono tags. `away` items are dashed and say "not downloaded yet" in text. */
export function Tags({ label, items, awayText = "not downloaded yet" }: { label: string; items: readonly TagItem[]; awayText?: string }) {
  return (
    <ul className="tags" aria-label={label}>
      {items.map(item => {
        const tag = typeof item === "string" ? { name: item, away: false } : item;
        return (
          <li key={tag.name} className={tag.away ? "tag away" : "tag"}>
            {tag.name}
            {tag.away ? <span className="vh"> ({awayText})</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
