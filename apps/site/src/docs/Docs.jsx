import { useEffect, useRef, useState } from 'react';
import GuideContent, { chapters } from '@/docs/GuideContent.jsx';
import { AfkMark } from '@/components/ui/svgs/afkMark.jsx';
import '@/docs/docs.css';
import { chapterUrl } from '@/docs/navigation.js';

function Command({ value, label = 'Terminal' }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Copied');
    } catch {
      setMessage('Copy unavailable. Select the command to copy it.');
    }
    timer.current = window.setTimeout(() => setMessage(''), 3000);
  }
  return <div className="docs-command">
    <div className="docs-command-bar"><span>{label}</span><button type="button" onClick={copy} aria-label={`Copy command: ${value}`}>Copy</button></div>
    <pre><code>{value}</code></pre>
    <span className="docs-copy-status" role="status">{message}</span>
  </div>;
}

export default function Docs() {
  const requested = new URLSearchParams(window.location.search).get('chapter');
  const current = chapters.find((item) => item.id === requested) ?? chapters[0];
  const index = chapters.indexOf(current);
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  const hasPrevious = Boolean(previous);
  const hasNext = Boolean(next);
  const [filter, setFilter] = useState('');
  const [headings, setHeadings] = useState([]);
  const article = useRef(null);
  const filtered = chapters.filter((item) => item.title.toLowerCase().includes(filter.trim().toLowerCase()));
  const hasResults = filtered.length > 0;

  useEffect(() => {
    document.title = `${current.title} | AFK Docs`;
    setHeadings(Array.from(article.current.querySelectorAll('h2[id]'), (heading) => ({ id: heading.id, title: heading.textContent })));
  }, [current.id, current.title]);

  return <div className="docs-app" data-lfd-recipe="ocean">
    <a className="skip" href="#docs-content">Skip to content</a>
    <header className="docs-header">
      <a className="docs-brand" href="/" aria-label="AI Field Kit home"><AfkMark className="docs-mark" /><strong>AI Field Kit</strong></a>
      <span className="docs-header-label">Documentation</span>
      <a href="https://github.com/logbookfordevs/ai-field-kit">GitHub</a>
    </header>
    <div className="docs-layout">
      <aside className="docs-sidebar" aria-label="Documentation chapters">
        <a className="docs-manual-title" href="/docs">The field manual</a>
        <label className="docs-filter">Find a chapter<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter chapters" /></label>
        <nav className="docs-chapters" aria-label="Chapters">
          {filtered.map((item) => <a href={chapterUrl(item.id)} key={item.id} aria-current={item.id === current.id ? 'page' : undefined}>{item.title}</a>)}
        </nav>
        {!hasResults && <p className="docs-empty" role="status">No matching chapters. Try a shorter name.</p>}
        <div className="docs-sidebar-note"><p>Start small.<br />Keep your agent.</p><a href="/">Back to AFK</a></div>
      </aside>
      <div className="docs-mobile-nav"><label htmlFor="docs-chapter">Chapter</label><select id="docs-chapter" value={current.id} onChange={(event) => window.location.assign(chapterUrl(event.target.value))}>{chapters.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></div>
      <main id="docs-content" className="docs-content" tabIndex={-1}>
        <article ref={article}><GuideContent chapter={current.id} Command={Command} /></article>
        <nav className="docs-pagination" aria-label="Continue reading">
          {hasPrevious && <a href={chapterUrl(previous.id)}><span>Previous</span>{previous.title}</a>}
          {hasNext && <a href={chapterUrl(next.id)} className="docs-next"><span>Next</span>{next.title}</a>}
        </nav>
        <footer className="docs-footer">A tool from the <a href="https://logbookfordevs.com/">Logbook for Devs</a>.<em>Charting the technical seas, one commit at a time.</em></footer>
      </main>
      <aside className="docs-toc"><nav aria-label="On this page"><strong>On this page</strong>{headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.title}</a>)}</nav><a className="docs-source-link" href="https://github.com/logbookfordevs/ai-field-kit/tree/main/packages/afk">Read the CLI source</a></aside>
    </div>
  </div>;
}
