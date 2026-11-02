import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterUrl, resolveChapter } from './navigation.ts';
import { chapterAliases, retiredChapters } from './chapters.ts';

test('chapter navigation retains the docs route', () => {
  assert.equal(chapterUrl('setup'), '/docs?chapter=setup');
});

test('retired chapter links resolve to legacy guidance while current and unknown links stay useful', () => {
  for (const chapter of retiredChapters) assert.equal(resolveChapter(chapter.id).id, 'legacy');
  assert.equal(resolveChapter('packs').id, 'packs');
  assert.equal(resolveChapter(null).id, 'start');
  assert.equal(resolveChapter('missing').id, 'start');
});

test('renamed chapter links land on the chapter that replaced them', () => {
  assert.equal(resolveChapter('profiles').id, 'packs');
  assert.equal(resolveChapter('sources').id, 'kit');
  for (const [alias, target] of Object.entries(chapterAliases)) assert.equal(resolveChapter(alias).id, target);
  assert.equal(resolveChapter('toString').id, 'start');
});

test('DOM values remain a single encoded query parameter', () => {
  for (const value of ['setup&chapter=reference#fragment', '<img src=x onerror=alert(1)>', 'javascript:alert(1)']) {
    const result = chapterUrl(value);
    const url = new URL(result, 'https://example.com');
    assert.equal(url.pathname, '/docs');
    assert.equal(url.searchParams.get('chapter'), value);
    assert.equal(url.searchParams.size, 1);
    assert.equal(url.hash, '');
    assert.ok(!/[<>]/.test(result));
  }
});
