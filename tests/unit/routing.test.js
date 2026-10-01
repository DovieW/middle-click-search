import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSelection, resolveTarget, webUrl } from '../../lib/routing.js';
import { DEFAULT_SEARCH_ENGINE } from '../../lib/settings.js';

for (const [selection, expected] of [
  ['example.com', 'https://example.com/'],
  ['report.pdf', 'https://report.pdf/'],
  ['example.com/path?q=hello#there', 'https://example.com/path?q=hello#there'],
  ['example.technology', 'https://example.technology/'],
  ['bücher.de', 'https://xn--bcher-kva.de/'],
  ['127.0.0.1:8080/path', 'https://127.0.0.1:8080/path'],
  ['[::1]:8080/', 'https://[::1]:8080/'],
  ['localhost:3000', 'https://localhost:3000/'],
  ['https://example.com/über', 'https://example.com/%C3%BCber'],
  ['http://localhost:3000/path', 'http://localhost:3000/path'],
]) test(`opens website: ${selection}`, () => {
  assert.equal(resolveTarget(selection).url, expected);
  assert.equal(resolveTarget(selection).kind, 'website');
});

for (const text of ['42', '1.2', '127.1', 'hello world', 'notes', 'javascript:alert(1)',
  'data:text/html,test', 'file:///tmp/a', 'ftp://example.com', 'https://user:password@example.com',
  '-bad.com', 'example..com', 'https://example.com\\evil']) {
  test(`searches text rather than treating it as a website: ${text}`, () => {
    assert.equal(webUrl(text), null);
    assert.equal(resolveTarget(text).kind, 'search');
  });
}

test('encodes Unicode, whitespace and query delimiters', () => {
  assert.equal(resolveTarget('  café & tea\n☕  ').url,
    DEFAULT_SEARCH_ENGINE.replace('%s', encodeURIComponent('café & tea\n☕')));
});
test('always-search overrides explicit URLs and bare domains', () => {
  for (const text of ['https://example.com/', 'example.com']) {
    assert.equal(resolveTarget(text, { disableDomainCheck: true }).kind, 'search');
  }
});
test('replaces every placeholder in a custom URL', () => {
  assert.equal(resolveTarget('a & b', { searchEngine: 'https://example.com/%s?q=%s' }).url,
    'https://example.com/a%20%26%20b?q=a%20%26%20b');
});
test('rejects absent, empty, and oversized selections', () => {
  for (const value of [null, undefined, {}, '', ' \n ', 'x'.repeat(20_001)]) {
    assert.throws(() => normalizeSelection(value));
  }
});

test('handles unmatched UTF-16 surrogates without losing the search', () => {
  assert.equal(resolveTarget('bad \uD800 text').url,
    DEFAULT_SEARCH_ENGINE.replace('%s', encodeURIComponent('bad \uFFFD text')));
});
