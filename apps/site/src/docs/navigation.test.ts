import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterUrl } from './navigation.ts';

test('chapter navigation retains the docs route', () => {
  assert.equal(chapterUrl('setup'), '/docs?chapter=setup');
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

