import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAiHandoff, handleAiHandoff, promptHash } from '../../lib/ai-handoff.js';
function api() {
  const data = {};
  return { data, runtime: { id: 'extension' }, storage: {
    sync: { get: async () => ({ aiAutoSend: true }) },
    session: { get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value), remove: async key => { delete data[key]; } },
  } };
}
const sender = { id: 'extension', tab: { id: 9 }, frameId: 0, url: 'https://chatgpt.com/?q=example' };
test('tickets keep only prompt fingerprints and allow one claim', async () => {
  const browser = api();
  await registerAiHandoff(browser, 9, 'nonce', 'private text', 3, 'source-document');
  assert.equal(JSON.stringify(browser.data).includes('private text'), false);
  const request = { type: 'ai-claim', nonce: 'nonce', promptHash: await promptHash('private text') };
  const results = await Promise.all([handleAiHandoff(browser, request, sender), handleAiHandoff(browser, request, sender)]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal((await handleAiHandoff(browser, request, sender)).ok, false);
  const done = await handleAiHandoff(browser, { type: 'ai-finish', nonce: 'nonce', sent: true }, sender);
  assert.equal(done.error, ''); assert.equal(done.sourceTabId, 3); assert.equal(done.sourceDocumentId, 'source-document');
  assert.deepEqual(browser.data, {});
});
test('another tab, origin, frame, nonce or prompt cannot claim a ticket', async () => {
  const browser = api(); await registerAiHandoff(browser, 9, 'nonce', 'text', 3);
  const request = { type: 'ai-claim', nonce: 'nonce', promptHash: await promptHash('text') };
  for (const source of [{ ...sender, id: 'other' }, { ...sender, tab: { id: 8 } }, { ...sender, frameId: 1 },
    { ...sender, url: 'https://other.test/' }, { ...sender, url: 'https://chatgpt.com/c/existing' }]) {
    assert.equal((await handleAiHandoff(browser, request, source)).ok, false);
  }
  for (const changes of [{ nonce: 'wrong' }, { promptHash: 'wrong' }]) {
    assert.equal((await handleAiHandoff(browser, { ...request, ...changes }, sender)).ok, false);
  }
});
test('expired tickets and a disabled auto-send preference cannot submit', async () => {
  const browser = api(); await registerAiHandoff(browser, 9, 'nonce', 'text', 3);
  const request = { type: 'ai-claim', nonce: 'nonce', promptHash: await promptHash('text') };
  browser.storage.sync.get = async () => ({ aiAutoSend: false });
  assert.equal((await handleAiHandoff(browser, request, sender)).ok, false);
  browser.data['ai-handoff-9'].expires = 0;
  assert.equal((await handleAiHandoff(browser, request, sender)).ok, false);
  assert.deepEqual(browser.data, {});
});

test('Gemini preparation is separate from submission and bound to the registered provider', async () => {
  const browser = api();
  await registerAiHandoff(browser, 9, 'nonce', 'text', 3, undefined, 'gemini', false);
  const request = { type: 'ai-prepare', nonce: 'nonce', promptHash: await promptHash('text') };
  const gemini = { ...sender, url: 'https://gemini.google.com/app?q=text' };
  assert.equal((await handleAiHandoff(browser, request, sender)).ok, false);
  assert.deepEqual(await handleAiHandoff(browser, request, gemini), { ok: true, autoSend: false });
  assert.equal((await handleAiHandoff(browser, request, gemini)).ok, false);
  assert.equal((await handleAiHandoff(browser, { ...request, type: 'ai-claim' }, gemini)).ok, false);
  assert.equal((await handleAiHandoff(browser, { type: 'ai-finish', nonce: 'nonce', prepared: true }, gemini)).error, '');
  assert.deepEqual(browser.data, {});
});
