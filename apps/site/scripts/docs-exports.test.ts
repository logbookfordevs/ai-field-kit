import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDocsExports, toMarkdown } from './docs-exports.ts';
import { chapters } from '../src/docs/chapters.ts';
import { assistantUrl, isPublicDocsHost, publicOrigin } from '../src/docs/doc-links.ts';

test('exports every chapter, an index, and the full manual without UI controls', async () => {
  const assets = await generateDocsExports();
  assert.equal(assets.size, chapters.length + 2);
  for (const { id } of chapters) {
    const path = `/docs/${id}.md`;
    const text = assets.get(path);
    assert.ok(text);
    assert.match(text, /^# .+/);
    assert.ok(text.includes(`Source: ${publicOrigin}/docs?chapter=${id}`));
    assert.ok(assets.get('/llms.txt')?.includes(publicOrigin + path));
    assert.ok(assets.get('/llms-full.txt')?.includes(text));
    assert.doesNotMatch(text, /<Command|<Menu\.|Copy command:|className=/);
  }
});

test('Markdown keeps code intact, exports collapsed content, and resolves doc links', () => {
  const html = '<h1>Example</h1><pre><code class="language-bash">printf "```"\necho &lt;value&gt;\n</code></pre><details><summary>More</summary><p>Hidden explanation</p></details><dl><dt>Term</dt><dd>Meaning</dd></dl><a href="/docs?chapter=skills">Skills</a>';
  const result = toMarkdown(html);
  assert.ok(result.includes('````bash\nprintf "```"\necho <value>\n````'));
  assert.ok(result.includes('**More**'));
  assert.ok(result.includes('Hidden explanation'));
  assert.ok(result.includes('**Term**'));
  assert.ok(result.includes('Meaning'));
  assert.ok(result.includes(`[Skills](${publicOrigin}/docs/skills.md)`));
});

test('assistant handoffs encode a short public page prompt, never the full manual', () => {
  for (const provider of ['claude', 'chatgpt'] as const) {
    const url = new URL(assistantUrl(provider, { id: 'catalog', title: 'Catalog & source #1' }));
    assert.equal(url.hostname, provider === 'claude' ? 'claude.ai' : 'chatgpt.com');
    assert.equal(url.searchParams.size, 1);
    assert.equal(url.hash, '');
    assert.ok(url.searchParams.get('q')?.includes(`${publicOrigin}/docs/catalog.md`));
    assert.ok(url.searchParams.get('q')?.includes('Catalog & source #1'));
    assert.ok(url.href.length < 1200);
  }
  assert.equal(isPublicDocsHost(publicOrigin), true);
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://afk-preview.vercel.app']) {
    assert.equal(isPublicDocsHost(origin), false);
  }
});

test('pipes inside table code do not create extra columns', () => {
  const result = toMarkdown('<table><thead><tr><th>Command</th></tr></thead><tbody><tr><td><code>enable|disable</code></td></tr></tbody></table>');
  assert.ok(result.includes('`enable\\|disable`'));
});
