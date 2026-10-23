import type { Chapter } from '@/docs/chapters.ts';
import { useEffect, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { markdownPath } from '@/docs/doc-links.ts';
import { chapterUrl } from '@/docs/navigation.ts';

export default function PageActions({ chapter }: { chapter: Chapter }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const anchor = useRef<HTMLDivElement>(null);
  const markdown = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function copyPage() {
    setBusy(true);
    setMessage('');
    try {
      if (!markdown.current) {
        controller.current = new AbortController();
        const response = await fetch(markdownPath(chapter.id), { signal: controller.current.signal });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('text/plain')) throw new Error('Markdown unavailable');
        markdown.current = await response.text();
      }
      await navigator.clipboard.writeText(markdown.current);
      setMessage('Page copied as Markdown. Paste it into your agent when ready.');
    } catch {
      setMessage('Could not copy. Open the Markdown below and copy it there.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + chapterUrl(chapter.id));
      setMessage('Page link copied.');
    } catch {
      setMessage('Could not copy the link. Copy the address from your browser.');
    }
  }

  return <div className="docs-page-actions">
    <div className="docs-action-buttons" ref={anchor}>
      <button className="docs-copy-page" type="button" onClick={copyPage} disabled={busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></svg><span>{busy ? 'Copying…' : 'Copy page'}</span></button>
      <Menu.Root>
        <Menu.Trigger className="docs-actions-trigger" aria-label="More page options"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></Menu.Trigger>
        <Menu.Portal><Menu.Positioner className="docs-actions-positioner" sideOffset={8} align="start" anchor={anchor}><Menu.Popup className="docs-actions-menu" aria-label="Page options">
          <Menu.Item className="docs-action-item" onClick={copyLink}>Copy page link</Menu.Item>
          <Menu.LinkItem className="docs-action-item" href={markdownPath(chapter.id)} target="_blank" rel="noopener noreferrer">View as Markdown</Menu.LinkItem>
          <Menu.Separator className="docs-actions-separator" />
          <Menu.LinkItem className="docs-action-item" href="/llms-full.txt" target="_blank" rel="noopener noreferrer">View all docs as Markdown</Menu.LinkItem>
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
    </div>
    <div className="docs-page-feedback" role="status" aria-live="polite"><span>{message}</span></div>
    <a className="docs-markdown-link" href={markdownPath(chapter.id)} target="_blank" rel="noopener noreferrer">View Markdown<span className="sr-only"> in a new tab</span></a>
  </div>;
}
