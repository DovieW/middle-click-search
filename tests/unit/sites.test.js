import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteRules, siteEnabled, normalizeOverrides } from '../../lib/sites.js';
import { normalizeSettings } from '../../lib/settings.js';
test('exact and wildcard host rules have distinct boundaries', () => {
  const values = { siteRules: parseSiteRules('example.com\n*.example.org') };
  for (const host of ['example.com', 'example.org', 'a.example.org']) assert.equal(siteEnabled(`https://${host}`, values), false);
  for (const host of ['a.example.com', 'notexample.org', 'example.org.evil.com']) assert.equal(siteEnabled(`https://${host}`, values), true);
});
test('allow list, overrides, and global disable have explicit precedence', () => {
  const values = normalizeSettings({ siteMode: 'allow', siteRules: ['*.example.com'], siteOverrides: { 'a.example.com': false, 'other.com': true } });
  assert.equal(siteEnabled('https://example.com', values), true);
  assert.equal(siteEnabled('https://a.example.com', values), false);
  assert.equal(siteEnabled('https://other.com', values), true);
  assert.equal(siteEnabled('https://unknown.com', values), false);
  assert.equal(siteEnabled('https://other.com', { ...values, enabled: false }), false);
  assert.equal(siteEnabled('chrome://settings', values), false);
});
test('invalid and oversized lists are rejected before saving', () => {
  for (const value of ['https://example.com', 'example.com/path', '*', 'example.com:80', 'foo bar', '*.']) assert.throws(() => parseSiteRules(value));
  assert.throws(() => parseSiteRules(Array.from({ length: 101 }, (_, i) => `host${i}.com`).join('\n')));
  assert.deepEqual(parseSiteRules('EXAMPLE.COM\nexample.com\n\n'), ['example.com']);
  assert.deepEqual(normalizeOverrides({ 'example.com': true, 'evil.com/path': false, 'other.com': 'false' }), { 'example.com': true });
});
