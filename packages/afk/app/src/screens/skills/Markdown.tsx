import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

/** A plain preview of a skill file: frontmatter hidden, headings, lists, code blocks and paragraphs. */
export function Markdown({ text }: { text: string }) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>); paragraph = []; };
  const flushList = () => { if (list.length) blocks.push(<ul key={blocks.length}>{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>); list = []; };

  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      if (code === null) { flushParagraph(); flushList(); code = []; }
      else { blocks.push(<pre key={blocks.length}>{code.join("\n")}</pre>); code = null; }
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) { flushParagraph(); flushList(); blocks.push(<h4 key={blocks.length}>{inline(heading[1]!)}</h4>); }
    else if (item) { flushParagraph(); list.push(item[1]!); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  if (code !== null) blocks.push(<pre key={blocks.length}>{code.join("\n")}</pre>);
  flushParagraph();
  flushList();
  return <div className="md-preview">{blocks.length ? blocks : <p className="meta">Nothing to preview yet.</p>}</div>;
}
