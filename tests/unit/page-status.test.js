import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageStatus } from '../../lib/page-status.js';
import { normalizeSettings } from '../../lib/settings.js';
const tab = { id: 7, url: 'https://example.com' };
const api = response => ({ runtime: { getManifest: () => ({ version: '0.2.0' }) }, tabs: { sendMessage: async () => response } });
test('only a live current-version content-script reply proves readiness', async () => {
  assert.equal((await getPageStatus(api({ ready: true, version: '0.2.0' }), tab, normalizeSettings())).state, 'ready');
  for (const response of [undefined, {}, { ready: true, version: '0.1.6' }]) {
    assert.equal((await getPageStatus(api(response), tab, normalizeSettings())).state, 'refresh');
  }
  const missing = api(); missing.tabs.sendMessage = async () => { throw new Error('No receiver'); };
  assert.equal((await getPageStatus(missing, tab, normalizeSettings())).refresh, true);
});
test('off, excluded and restricted pages are distinguished without messaging', async () => {
  const never = api(); never.tabs.sendMessage = async () => { throw new Error('Should not be called'); };
  assert.equal((await getPageStatus(never, tab, normalizeSettings({ enabled: false }))).state, 'off');
  assert.equal((await getPageStatus(never, tab, normalizeSettings({ siteRules: ['example.com'] }))).state, 'disabled');
  for (const url of ['chrome://settings', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore/detail/x']) {
    assert.equal((await getPageStatus(never, { id: 7, url }, normalizeSettings())).state, 'unavailable');
  }
});

test('preference initialization failure is visible in page readiness', async () => {
  const result = await getPageStatus(api({ ready: false, error: 'Could not load preferences. Try refreshing.' }), tab, normalizeSettings());
  assert.equal(result.refresh, true);
  assert.match(result.text, /Could not load preferences/);
});
