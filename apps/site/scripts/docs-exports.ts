import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluate } from '@mdx-js/mdx';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { chapters } from '../src/docs/chapters.ts';
import { markdownOptions } from '../src/docs/markdown-options.ts';
import { markdownPath, publicOrigin } from '../src/docs/doc-links.ts';

export const contentFiles = chapters.map(({ id }) => fileURLToPath(new URL(`../src/docs/content/${id}.mdx`, import.meta.url)));

function markdownLink(href: string) {
  const url = new URL(href, publicOrigin);
  if (url.origin === publicOrigin && url.pathname === '/docs') {
    const id = url.searchParams.get('chapter') || chapters[0].id;
    if (chapters.some((chapter) => chapter.id === id)) {
      return new URL(markdownPath(id) + url.hash, publicOrigin).href;
    }
  }
  return url.href;
}

export function toMarkdown(html: string) {
  const converter = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  converter.use(gfm);
  converter.addRule('tableCells', {
    filter: ['td', 'th'],
    replacement: (content, node) => {
      const index = Array.from(node.parentElement?.children ?? []).indexOf(node);
      const escaped = content.replace(/(?<!\\)\|/g, '\\|');
      return `${index === 0 ? '| ' : ' '}${escaped} |`;
    },
  });
  converter.addRule('links', {
    filter: (node) => node.nodeName === 'A' && node.hasAttribute('href'),
    replacement: (content, node) => `[${content}](${markdownLink(node.getAttribute('href') ?? '')})`,
  });
  converter.addRule('definitions', {
    filter: 'dt',
    replacement: (content) => `\n\n**${content}**\n\n`,
  });
  converter.addRule('definitionBodies', { filter: 'dd', replacement: (content) => `\n\n${content}\n\n` });
  converter.addRule('summaries', { filter: 'summary', replacement: (content) => `\n\n**${content}**\n\n` });
  converter.addRule('codeBlocks', {
    filter: 'pre',
    replacement: (_, node) => {
      const code = node.querySelector('code');
      const text = ((code ?? node).textContent ?? '').replace(/\n$/, '');
      const longestFence = Math.max(2, ...(text.match(/`+/g) ?? []).map((match) => match.length));
      const fence = '`'.repeat(longestFence + 1);
      const language = code?.getAttribute('class')?.match(/language-([\w-]+)/)?.[1] ?? 'text';
      const label = code?.getAttribute('data-label');
      return `\n\n${label ? `**${label}**\n\n` : ''}${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });
  return converter.turndown(html) + '\n';
}

export async function renderChapter(id: string) {
  const source = await readFile(new URL(`../src/docs/content/${id}.mdx`, import.meta.url), 'utf8');
  const { default: Content } = await evaluate(source, { ...runtime, ...markdownOptions });
  return renderToStaticMarkup(createElement(Content));
}

export async function generateDocsExports() {
  const assets = new Map<string, string>();
  const documents = await Promise.all(chapters.map(async (chapter) => {
    const markdown = toMarkdown(await renderChapter(chapter.id));
    const firstBreak = markdown.indexOf('\n');
    const source = `${publicOrigin}/docs?chapter=${chapter.id}`;
    const withSource = markdown.slice(0, firstBreak) + `\n\nSource: ${source}\n` + markdown.slice(firstBreak + 1);
    assets.set(markdownPath(chapter.id), withSource);
    return withSource;
  }));
  assets.set('/llms.txt', '# AI Field Kit\n\n> Setup and skill-management documentation for AFK.\n\n## Chapters\n\n' + chapters.map(({ id, title, description }) => `- [${title}](${publicOrigin}${markdownPath(id)}): ${description}`).join('\n') + `\n\n## Complete documentation\n\n- [All chapters](${publicOrigin}/llms-full.txt)\n`);
  assets.set('/llms-full.txt', '# AI Field Kit — Complete documentation\n\n' + documents.join('\n---\n\n'));
  return assets;
}

export function docsExportsPlugin(): Plugin {
  let pending: Promise<Map<string, string>> | undefined;
  const exports = () => pending ??= generateDocsExports();
  return {
    name: 'afk-docs-exports',
    configureServer(server) {
      server.watcher.add(contentFiles);
      server.watcher.on('change', (file) => {
        if (contentFiles.includes(file)) pending = undefined;
      });
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const isExport = /^\/docs\/[^/]+\.md$/.test(pathname) || ['/llms.txt', '/llms-full.txt'].includes(pathname);
        if (!isExport) return next();
        try {
          const body = (await exports()).get(pathname);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.statusCode = body ? 200 : 404;
          res.end(body ?? 'Documentation page not found.');
        } catch (error) { next(error); }
      });
    },
    async generateBundle() {
      for (const file of contentFiles) this.addWatchFile(file);
      for (const [path, source] of await generateDocsExports()) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source });
      }
    },
  };
}
