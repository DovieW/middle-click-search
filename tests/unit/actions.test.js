import test from 'node:test';
import assert from 'node:assert/strict';
import { openSelection } from '../../lib/actions.js';

function fakeApi(settings = {}) {
  const created = [];
  return {
    runtime: { id: 'extension-id' }, storage: { sync: { get: async () => settings } },
    tabs: { get: async id => ({ id, index: 4, windowId: 8 }),
      create: async options => { created.push(options); return { id: 123 }; } }, created,
  };
}
const sender = { id: 'extension-id', tab: { id: 12, index: 0, windowId: 1 } };
test('opens next to the originating tab using its current window/index', async () => {
  const api = fakeApi();
  assert.deepEqual(await openSelection(api, { text: 'example.com' }, sender),
    { ok: true, tabId: 123, clearSelection: true });
  assert.deepEqual(api.created[0], { url: 'https://example.com/', index: 5,
    windowId: 8, openerTabId: 12, active: true });
});
for (const newTabActive of [true, false]) for (const invertFocus of [true, false]) {
  test(`focus preference ${newTabActive}, modifier ${invertFocus}`, async () => {
    const api = fakeApi({ newTabActive });
    await openSelection(api, { text: 'some text', invertFocus }, sender);
    assert.equal(api.created[0].active, newTabActive !== invertFocus);
  });
}
test('rejects messages without the originating extension tab', async () => {
  for (const source of [{}, { id: 'other', tab: { id: 12 } }, { id: 'extension-id' }]) {
    const api = fakeApi();
    await assert.rejects(openSelection(api, { text: 'test' }, source));
    assert.equal(api.created.length, 0);
  }
});
test('does not report success when storage or tab creation fails', async () => {
  for (const component of ['storage', 'get', 'create']) {
    const api = fakeApi();
    const fail = async () => { throw new Error('Browser API unavailable'); };
    if (component === 'storage') api.storage.sync.get = fail;
    else api.tabs[component] = fail;
    await assert.rejects(openSelection(api, { text: 'test' }, sender), /unavailable/);
  }
});
