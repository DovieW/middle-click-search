import test from 'node:test';
import assert from 'node:assert/strict';
import { setTabError } from '../../lib/errors.js';
import { copyText } from '../../lib/clipboard.js';

test('a queued clear wins over slow diagnostic writes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let stored, badge;
  const api = {
    storage: { session: { set: async value => { await gate; stored = value; }, remove: async () => { stored = undefined; } } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeTextColor: async () => {},
      setBadgeText: async value => { if (value.text) await gate; badge = value.text; } },
  };
  const write = setTabError(api, 1, 'Failed');
  const clear = setTabError(api, 1);
  release(); await Promise.all([write, clear]);
  assert.equal(stored, undefined); assert.equal(badge, '');
});

test('concurrent clipboard requests wait for document initialization', async () => {
  let visible = false, ready = false, release, creations = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const original = globalThis.chrome;
  globalThis.chrome = {
    runtime: { getURL: path => path, getContexts: async () => visible ? [{}] : [],
      sendMessage: async () => { assert.equal(ready, true); return { ok: true }; } },
    offscreen: { createDocument: async () => { creations++; visible = true; await gate; ready = true; } },
  };
  try {
    const first = copyText('first');
    await new Promise(resolve => setImmediate(resolve));
    const second = copyText('second');
    const both = Promise.all([first, second]);
    // Give the second request time to observe the visible but uninitialized document.
    await new Promise(resolve => setImmediate(resolve));
    release(); await both;
    assert.equal(creations, 1);
  } finally { globalThis.chrome = original; }
});
