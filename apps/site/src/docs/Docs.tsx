import type { ComponentProps, ReactNode } from 'react';
import { isValidElement } from 'react';
import type { MDXComponents } from 'mdx/types';
import type { Chapter } from '@/docs/chapters.ts';
import { SiteLink } from '@/SiteLink.tsx';
import { useNavigate, useSearchParams } from 'react-router';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import GuideContent from '@/docs/GuideContent.tsx';
import { chapters } from '@/docs/chapters.ts';
import PageActions from '@/docs/PageActions.tsx';
import { markdownPath } from '@/docs/doc-links.ts';
import { AfkMark } from '@/components/ui/svgs/afkMark.tsx';
import '@/docs/docs.css';
import { chapterUrl, retiredChapter, resolveChapter } from '@/docs/navigation.ts';
import { CommandPanel } from '@/components/CommandPanel.tsx';
import { sourceUrl } from '@/site-config.ts';

function CodeBlock({ children }: ComponentProps<'pre'>) {
  if (!isValidElement<{ children?: ReactNode; 'data-label'?: string }>(children)) return <pre>{children}</pre>;
  const code = children.props;
  const label = code['data-label'];
  const hasLabel = Boolean(label);
  if (!hasLabel) return <pre>{children}</pre>;
  return <CommandPanel value={String(code.children).replace(/\n$/, '')} label={label} />;
}

function DocsTable({ children }: ComponentProps<'table'>) {
  return <div className="docs-table"><table>{children}</table></div>;
}

const ChapterContext = createContext<Chapter>(chapters[0]);

function DocsTitle({ children }: ComponentProps<'h1'>) {
  const chapter = useContext(ChapterContext);
  return <div className="docs-title-row"><h1>{children}</h1><PageActions key={chapter.id} chapter={chapter} /></div>;
}

const markdownComponents: MDXComponents = { h1: DocsTitle, pre: CodeBlock, table: DocsTable, a: SiteLink };

export default function Docs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('chapter');
  const current = resolveChapter(requested);
  const retired = retiredChapter(requested);
  const showsRetiredNotice = Boolean(retired);
  const index = chapters.indexOf(current);
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  const hasPrevious = Boolean(previous);
  const hasNext = Boolean(next);
  const [filter, setFilter] = useState('');
  const [headings, setHeadings] = useState<{ id: string; title: string }[]>([]);
  const article = useRef<HTMLElement>(null);
  const filtered = chapters.filter((item) => item.title.toLowerCase().includes(filter.trim().toLowerCase()));
  const hasResults = filtered.length > 0;

  useEffect(() => {
    document.title = `${current.title} | AFK Docs`;
    setHeadings(Array.from(article.current?.querySelectorAll('h2[id]') ?? [], (heading) => ({ id: heading.id, title: heading.textContent ?? '' })));
  }, [current.id, current.title]);

  return <div className="docs-app" data-lfd-recipe="ocean">
    <link rel="alternate" type="text/plain" href={markdownPath(current.id)} title="This chapter as Markdown" />
    <SiteLink className="skip" href="#docs-content">Skip to content</SiteLink>
    <header className="docs-header">
      <SiteLink className="docs-brand" href="/" aria-label="AI Field Kit home"><AfkMark className="docs-mark" /><strong>afk.</strong><span className="version-tag">2.0</span></SiteLink>
      <span className="docs-header-label">Field manual</span>
      <SiteLink href="https://github.com/logbookfordevs/ai-field-kit">GitHub</SiteLink>
    </header>
    <div className="docs-layout">
      <aside className="docs-sidebar" aria-label="Documentation chapters">
        <SiteLink className="docs-manual-title" href="/docs">The field manual</SiteLink>
        <label className="docs-filter">Find a chapter<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter chapters" /></label>
        <nav className="docs-chapters" aria-label="Chapters">
          {filtered.map((item) => <SiteLink href={chapterUrl(item.id)} key={item.id} aria-current={item.id === current.id ? 'page' : undefined}>{item.title}</SiteLink>)}
        </nav>
        {!hasResults && <p className="docs-empty" role="status">No matching chapters. <button type="button" onClick={() => setFilter('')}>Clear filter</button></p>}
        <div className="docs-sidebar-note"><p>Keep it ready.<br />Bring it in when needed.</p><SiteLink href="/">Back to AFK</SiteLink></div>
      </aside>
      <div className="docs-mobile-nav"><label htmlFor="docs-chapter">Chapter</label><select id="docs-chapter" value={current.id} onChange={(event) => navigate(chapterUrl(event.target.value))}>{chapters.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></div>
      <main id="docs-content" className="docs-content" tabIndex={-1}>
        <article ref={article}>
          {showsRetiredNotice && <div className="docs-legacy-notice" role="note"><strong>This link points to a pre-2.0 guide: {retired?.title}.</strong><p>The chapter was retired when AFK changed its core. Choose <SiteLink href="/docs">AFK 2.0 guidance</SiteLink> or follow the pre-2.0 release instructions below.</p></div>}
          <ChapterContext.Provider value={current}>
            <GuideContent chapter={current.id} components={markdownComponents} />
          </ChapterContext.Provider>
        </article>
        <nav className="docs-pagination" aria-label="Continue reading">
          {hasPrevious && <SiteLink href={chapterUrl(previous.id)}><span>Previous</span>{previous.title}</SiteLink>}
          {hasNext && <SiteLink href={chapterUrl(next.id)} className="docs-next"><span>Next</span>{next.title}</SiteLink>}
        </nav>
        <footer className="docs-footer">A tool from the <SiteLink href="https://logbookfordevs.com/">Logbook for Devs</SiteLink>.<em>Charting the technical seas, one commit at a time.</em></footer>
      </main>
      <aside className="docs-toc"><nav aria-label="On this page"><strong>On this page</strong>{headings.map((heading) => <SiteLink href={`#${heading.id}`} key={heading.id}>{heading.title}</SiteLink>)}</nav><SiteLink className="docs-source-link" href={`${sourceUrl}/packages/afk`}>Read the CLI source</SiteLink></aside>
    </div>
  </div>;
}
