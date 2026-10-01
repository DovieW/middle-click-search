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
for (const linkFocus of ['foreground', 'background']) for (const invertFocus of [true, false]) {
  test(`ordinary link focus ${linkFocus} modifier ${invertFocus}`, async () => {
    const api = fakeApi({ linkFocus });
    const result = await openSelection(api, { type: 'open-link', url: 'https://example.com/path', invertFocus }, sender);
    assert.equal(api.created[0].active, (linkFocus === 'foreground') !== invertFocus);
    assert.equal(result.clearSelection, false);
  });
}
test('blocked origin and default link handling cannot create a tab', async () => {
  await assert.rejects(openSelection(fakeApi({ siteRules: ['example.com'] }), { text: 'test' }, { ...sender, tab: { id: 12, url: 'https://example.com' } }), /disabled/);
  for (const url of ['https://example.com', 'javascript:alert(1)']) {
    await assert.rejects(openSelection(fakeApi(), { type: 'open-link', url }, sender));
  }
});
test('copy failure is a warning, while the search still opens successfully', async () => {
  const api = fakeApi({ copyOnSearch: true });
  const result = await openSelection(api, { text: 'hello' }, sender, async () => { throw new Error('Unavailable'); });
  assert.equal(result.ok, true); assert.match(result.warning, /clipboard/); assert.equal(api.created.length, 1);
});
test('copy is opt-in and is never run for ordinary links', async () => {
  const texts = [];
  await openSelection(fakeApi({ copyOnSearch: true }), { text: 'hello' }, sender, async text => texts.push(text));
  await openSelection(fakeApi({ copyOnSearch: true, linkFocus: 'foreground' }), { type: 'open-link', url: 'https://example.com' }, sender, async text => texts.push(text));
  await openSelection(fakeApi(), { text: 'other' }, sender, async text => texts.push(text));
  assert.deepEqual(texts, ['hello']);
});

test('stale document requests cannot copy or open a tab', async () => {
  const api = fakeApi({ copyOnSearch: true });
  api.tabs.sendMessage = async (_id, _request, options) => {
    assert.deepEqual(options, { documentId: 'old-document' });
    throw new Error('No receiver');
  };
  let copied = false;
  await assert.rejects(openSelection(api, { text: 'hello' }, { ...sender, documentId: 'old-document' }, async () => { copied = true; }));
  assert.equal(copied, false);
  assert.equal(api.created.length, 0);
});
test('a document lost during copying cannot open a tab', async () => {
  const api = fakeApi({ copyOnSearch: true });
  let ready = true;
  api.tabs.sendMessage = async () => ({ ready });
  await assert.rejects(openSelection(api, { text: 'hello' }, { ...sender, documentId: 'document' }, async () => { ready = false; }), /no longer available/);
  assert.equal(api.created.length, 0);
});
test('oversized link requests fail before browser work', async () => {
  const api = fakeApi({ linkFocus: 'foreground' });
  await assert.rejects(openSelection(api, { type: 'open-link', url: 'https://example.com/' + 'x'.repeat(20001) }, sender), /too long/);
  assert.equal(api.created.length, 0);
});
