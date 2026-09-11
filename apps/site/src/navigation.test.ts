import assert from 'node:assert/strict';
import test from 'node:test';
import { siteDestination, scrollRestorationKey } from './navigation.ts';

const location = { pathname: '/docs', search: '?chapter=profiles' };

test('section links keep the selected chapter and any other query parameters', () => {
  assert.equal(siteDestination('#profiles-create', location), '/docs?chapter=profiles#profiles-create');
  assert.equal(siteDestination('#skills-maintain', { pathname: '/docs/', search: '?chapter=skills&source=team' }), '/docs/?chapter=skills&source=team#skills-maintain');
  assert.equal(siteDestination('#install', { pathname: '/', search: '' }), '/#install');
});

test('page links retain their destination while resources and external links use the browser', () => {
  for (const href of ['/', '/docs', '/docs/', '/docs?chapter=skills', '/docs/?chapter=profiles#profiles-create']) {
    assert.equal(siteDestination(href, location), href);
  }
  for (const href of ['/docs/skills.md', '/llms.txt', '/llms-full.txt', 'https://example.com/docs', 'mailto:hello@example.com', undefined]) {
    assert.equal(siteDestination(href, location), null);
  }
});

test('fresh section URLs do not reuse another document’s initial scroll position', () => {
  const initial = { ...location, key: 'default', hash: '#profiles-create' };
  assert.equal(scrollRestorationKey(initial), '/docs?chapter=profiles#profiles-create');
  assert.notEqual(scrollRestorationKey(initial), scrollRestorationKey({ ...initial, search: '?chapter=skills' }));
  assert.equal(scrollRestorationKey({ ...initial, key: 'history-entry-1' }), 'history-entry-1');
});
