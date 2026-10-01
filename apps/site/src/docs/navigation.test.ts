import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterUrl, resolveChapter } from './navigation.ts';
import { retiredChapters } from './chapters.ts';

test('chapter navigation retains the docs route', () => {
  assert.equal(chapterUrl('setup'), '/docs?chapter=setup');
});

test('retired chapter links resolve to legacy guidance while current and unknown links stay useful', () => {
  for (const chapter of retiredChapters) assert.equal(resolveChapter(chapter.id).id, 'legacy');
  assert.equal(resolveChapter('profiles').id, 'profiles');
  assert.equal(resolveChapter(null).id, 'start');
  assert.equal(resolveChapter('missing').id, 'start');
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
