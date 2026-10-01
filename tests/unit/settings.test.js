import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings, validateSearchEngine } from '../../lib/settings.js';

test('defaults are safe and valid', () => {
  assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
  assert.equal(validateSearchEngine(DEFAULT_SETTINGS.searchEngine), '');
});
test('preserves existing engine, tab focus, and domain preferences', () => {
  const result = normalizeSettings({ searchEngine: 'https://example.com/?q=%s', newTabActive: false,
    disableDomainCheck: true, clearSelection: false, preventAutoscroll: false });
  assert.equal(result.newTabActive, false);
  assert.equal(result.disableDomainCheck, true);
  assert.equal(result.searchEngine, 'https://example.com/?q=%s');
  assert.equal(result.clearSelection, false);
});
test('malformed saved settings fall back to defaults', () => {
  assert.deepEqual(normalizeSettings({ searchEngine: 'javascript:%s', newTabActive: 'false',
    clearSelection: 0, unknown: true }), DEFAULT_SETTINGS);
});
for (const template of ['', 'https://example.com/', 'javascript:%s', 'ftp://example.com/%s',
  'https://%s.example.com/', 'https://user:password@example.com/?q=%s', 'https://example.com/q=%s space']) {
  test(`rejects invalid search template: ${template}`, () => assert.notEqual(validateSearchEngine(template), ''));
}
test('accepts path, query, and fragment placeholders', () => {
  for (const template of ['https://example.com/%s', 'https://example.com/?q=%s', 'http://localhost:3000/#%s']) {
    assert.equal(validateSearchEngine(template), '');
  }
});

test('handles absent or non-object settings', () => {
  for (const value of [null, 42, false, 'broken']) assert.deepEqual(normalizeSettings(value), DEFAULT_SETTINGS);
});
test('rejects over-quota and backslash search URLs before saving', () => {
  assert.match(validateSearchEngine(`https://example.com/?q=%s&x=${'é'.repeat(5000)}`), /too long/);
  assert.notEqual(validateSearchEngine('https://example.com\\evil?q=%s'), '');
});
