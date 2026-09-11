import type { Chapter } from '@/docs/chapters.ts';
import type { AssistantProvider } from '@/docs/doc-links.ts';
import { useEffect, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { assistantUrl, isPublicDocsHost, markdownPath } from '@/docs/doc-links.ts';

function DocumentIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></svg>;
}

export default function PageActions({ chapter }: { chapter: Chapter }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [handoff, setHandoff] = useState<AssistantProvider | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const markdown = useRef<string | null>(null);
  const request = useRef<Promise<string> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const isPublished = isPublicDocsHost(window.location.origin);
  const hasHandoff = Boolean(handoff);
  const hasMessage = Boolean(message);
  const showsFeedback = hasMessage || hasHandoff;

  useEffect(() => () => controller.current?.abort(), []);

  async function copy(provider?: AssistantProvider) {
    setBusy(true);
    setMessage('');
    setHandoff(null);
    try {
      if (!markdown.current) {
        controller.current = new AbortController();
        request.current ??= fetch(markdownPath(chapter.id), { signal: controller.current.signal })
          .then(async (response) => {
            if (!response.ok || !response.headers.get('content-type')?.startsWith('text/plain')) throw new Error('Markdown unavailable');
            return response.text();
          });
        markdown.current = await request.current;
      }
      await navigator.clipboard.writeText(markdown.current);
      if (provider) {
        setMessage('Page copied. Open your assistant and paste it into the conversation.');
        setHandoff(provider);
      } else {
        setMessage('Page copied as Markdown.');
      }
    } catch {
      request.current = null;
      setMessage('Could not copy. Try again, or open the Markdown and copy it there.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="docs-page-actions">
    <div className="docs-action-buttons" ref={anchor}>
      <button className="docs-copy-page" type="button" onClick={() => copy()} disabled={busy}>
        <DocumentIcon /><span>{busy ? 'Copying…' : 'Copy page'}</span>
      </button>
      <Menu.Root>
        <Menu.Trigger className="docs-actions-trigger" aria-label="More page options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="docs-actions-positioner" sideOffset={8} align="start" anchor={anchor}>
            <Menu.Popup className="docs-actions-menu" aria-label="Page options">
              <Menu.LinkItem className="docs-action-item" href={markdownPath(chapter.id)} target="_blank" rel="noopener noreferrer">View as Markdown</Menu.LinkItem>
              {isPublished && <>
                <Menu.LinkItem className="docs-action-item" href={assistantUrl('chatgpt', chapter)} target="_blank" rel="noopener noreferrer">Open in ChatGPT</Menu.LinkItem>
                <Menu.LinkItem className="docs-action-item" href={assistantUrl('claude', chapter)} target="_blank" rel="noopener noreferrer">Open in Claude</Menu.LinkItem>
              </>}
              {!isPublished && <>
                <Menu.Item className="docs-action-item" disabled={busy} onClick={() => copy('chatgpt')}>Copy for ChatGPT</Menu.Item>
                <Menu.Item className="docs-action-item" disabled={busy} onClick={() => copy('claude')}>Copy for Claude</Menu.Item>
                <p className="docs-actions-note">This preview is not public. Copy the page to use it with your assistant.</p>
              </>}
              <Menu.Separator className="docs-actions-separator" />
              <Menu.LinkItem className="docs-action-item" href="/llms-full.txt" target="_blank" rel="noopener noreferrer">View all docs as Markdown</Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
    <div className="docs-page-feedback" role="status" aria-live="polite">
      {showsFeedback && <>
        <span>{message}</span>
        {hasHandoff && <a href={handoff === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/'} target="_blank" rel="noopener noreferrer">Continue in {handoff === 'claude' ? 'Claude' : 'ChatGPT'}</a>}
        {!hasHandoff && <a href={markdownPath(chapter.id)} target="_blank" rel="noopener noreferrer">View Markdown</a>}
      </>}
    </div>
  </div>;
}
