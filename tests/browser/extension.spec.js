import { test, expect, selectText, middleClick, settings } from './fixtures.js';

test('searches selected text once, next to its source tab, and clears after success', async ({ extension, page }) => {
  await selectText(page);
  const source = await extension.worker.evaluate(async () => (await chrome.tabs.query({})).at(-1));
  const count = extension.context.pages().length;
  const result = await middleClick(extension, page);
  expect(result.url()).toBe(`${extension.baseUrl}/search?q=curious%20cats%20%26%20caf%C3%A9`);
  await expect.poll(() => page.evaluate(() => getSelection().toString())).toBe('');
  const opened = await extension.worker.evaluate(async () => chrome.tabs.get(globalThis.createdTabs.at(-1)));
  expect(extension.context.pages()).toHaveLength(count + 1);
  expect(opened.index).toBe(source.index + 1);
  expect(opened.active).toBe(true);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(true);
});

test('opens a selected URL directly', async ({ extension, page }) => {
  await selectText(page, `${extension.baseUrl}/direct`);
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/direct`);
});

test('always-search setting overrides URL detection', async ({ extension, page }) => {
  await settings(extension, { disableDomainCheck: true });
  const url = `${extension.baseUrl}/direct`;
  await selectText(page, url);
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/search?q=${encodeURIComponent(url)}`);
});

for (const newTabActive of [true, false]) for (const modifiers of [[], ['Control'], ['Meta']]) {
  test(`focus ${newTabActive} with modifiers ${modifiers.join('+') || 'none'}`, async ({ extension, page }) => {
    await settings(extension, { newTabActive });
    await selectText(page);
    await middleClick(extension, page, '#text', modifiers);
    const tab = await extension.worker.evaluate(async () => chrome.tabs.get(globalThis.createdTabs.at(-1)));
    expect(tab.active).toBe(newTabActive !== (modifiers.length > 0));
  });
}

test('preserves the selection when clearing is disabled', async ({ extension, page }) => {
  await settings(extension, { clearSelection: false });
  await selectText(page);
  await middleClick(extension, page);
  expect(await page.evaluate(() => getSelection().toString())).toBe('curious cats & café');
});

test('deeply nested link clicks open the native link exactly once', async ({ extension, page }) => {
  await selectText(page);
  const count = extension.context.pages().length;
  const result = await middleClick(extension, page, '#nested-link');
  expect(result.url()).toBe(`${extension.baseUrl}/native-link`);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
  expect(extension.context.pages()).toHaveLength(count + 1);
});

test('link detection follows the composed path through shadow DOM', async ({ extension, page }) => {
  await selectText(page);
  const result = await middleClick(extension, page, '#shadow-link b');
  expect(result.url()).toBe(`${extension.baseUrl}/shadow-native`);
});

for (const selector of ['#input', '#textarea']) {
  test(`searches selection inside ${selector}`, async ({ extension, page }) => {
    const value = await page.locator(selector).inputValue();
    await page.locator(selector).focus();
    await page.locator(selector).evaluate(element => element.setSelectionRange(0, element.value.length));
    const result = await middleClick(extension, page, selector);
    expect(result.url()).toBe(`${extension.baseUrl}/search?q=${encodeURIComponent(value)}`);
    await expect.poll(() => page.locator(selector).evaluate(element => element.selectionStart === element.selectionEnd)).toBe(true);
  });
}

test('does not search password fields or empty selections', async ({ extension, page }) => {
  const count = extension.context.pages().length;
  await page.locator('#password').focus();
  await page.locator('#password').evaluate(el => el.setSelectionRange(0, el.value.length));
  await page.locator('#password').click({ button: 'middle' });
  await page.locator('#text').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(count);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
});

test('synthetic page events cannot trigger searches', async ({ extension, page }) => {
  const count = extension.context.pages().length;
  await selectText(page);
  await page.locator('#text').evaluate(element => element.dispatchEvent(new MouseEvent('mousedown', { button: 1, bubbles: true })));
  expect(extension.context.pages()).toHaveLength(count);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
});

test('searches text in same-origin iframes', async ({ extension, page }) => {
  const frame = page.frames().find(frame => frame.url().endsWith('/frame'));
  await selectText(frame, 'frame search text');
  const opened = extension.context.waitForEvent('page');
  await frame.locator('#text').click({ button: 'middle' });
  const result = await opened;
  await result.waitForLoadState('domcontentloaded');
  expect(result.url()).toBe(`${extension.baseUrl}/search?q=frame%20search%20text`);
});

test('keeps selected text when tab creation fails and shows an error', async ({ extension, page }) => {
  await extension.worker.evaluate(() => { chrome.tabs.create = async () => { throw new Error('Simulated tab failure'); }; });
  await selectText(page);
  await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => page.evaluate(() => getSelection().toString())).toBe('curious cats & café');
  const cdp = await extension.context.newCDPSession(page);
  await expect.poll(async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.map(node => node.name?.value || '').join(' ');
  }).toContain('Simulated tab failure');
});

test('autoscroll preference updates on an already open page', async ({ extension, page }) => {
  await settings(extension, { preventAutoscroll: false });
  await selectText(page);
  await middleClick(extension, page);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
});

test('does not clear a new selection while waiting for the old request', async ({ extension, page }) => {
  await extension.worker.evaluate(() => {
    const original = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async options => {
      globalThis.searchWaiting = true;
      await new Promise(resolve => { globalThis.releaseSearch = resolve; });
      return original(options);
    };
  });
  await selectText(page);
  await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => extension.worker.evaluate(() => globalThis.searchWaiting)).toBe(true);
  await selectText(page, 'another selection', '#other');
  const opened = extension.context.waitForEvent('page');
  await extension.worker.evaluate(() => globalThis.releaseSearch());
  await (await opened).waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => getSelection().toString())).toBe('another selection');
});

test('in-flight repeated clicks create one tab and allow a later search', async ({ extension, page }) => {
  await extension.worker.evaluate(() => {
    const original = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async options => {
      globalThis.searchWaiting = true;
      await new Promise(resolve => { globalThis.releaseSearch = resolve; });
      chrome.tabs.create = original;
      return original(options);
    };
  });
  await selectText(page);
  const count = extension.context.pages().length;
  await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => extension.worker.evaluate(() => globalThis.searchWaiting)).toBe(true);
  await page.locator('#text').click({ button: 'middle' });
  const opened = extension.context.waitForEvent('page');
  await extension.worker.evaluate(() => globalThis.releaseSearch());
  await (await opened).waitForLoadState('domcontentloaded');
  await expect.poll(() => page.evaluate(() => getSelection().toString())).toBe('');
  expect(extension.context.pages()).toHaveLength(count + 1);
  await page.bringToFront();
  await selectText(page, 'later search');
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/search?q=later%20search`);
});

test('survives service-worker suspension and reads the saved engine after restart', async ({ extension, page }) => {
  await settings(extension, { searchEngine: `${extension.baseUrl}/restarted?q=%s` });
  const cdp = await extension.context.newCDPSession(page);
  const versions = new Map();
  cdp.on('ServiceWorker.workerVersionUpdated', event => {
    for (const version of event.versions) versions.set(version.versionId, version);
  });
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => [...versions.values()].find(version =>
    version.scriptURL.includes(extension.id) && version.runningStatus === 'running')?.versionId).toBeTruthy();
  const versionId = [...versions.values()].find(version =>
    version.scriptURL.includes(extension.id) && version.runningStatus === 'running').versionId;
  await cdp.send('ServiceWorker.stopWorker', { versionId });
  await expect.poll(() => versions.get(versionId)?.runningStatus).toBe('stopped');
  await cdp.detach();
  await selectText(page, 'restart search');
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/restarted?q=restart%20search`);
});

test('supports selected text inside a shadow root', async ({ extension, page }) => {
  await selectText(page, 'shadow search', '#shadow-text');
  expect((await middleClick(extension, page, '#shadow-text')).url()).toBe(`${extension.baseUrl}/search?q=shadow%20search`);
});

test('searches selections in a related srcdoc frame', async ({ extension, page }) => {
  const attached = page.waitForEvent('framenavigated', frame => frame.url() === 'about:srcdoc');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.srcdoc = '<p id="text">srcdoc search</p>';
    document.body.append(frame);
  });
  const frame = await attached;
  await selectText(frame, 'srcdoc search');
  const opened = extension.context.waitForEvent('page');
  await frame.locator('#text').click({ button: 'middle' });
  const result = await opened;
  await result.waitForLoadState('domcontentloaded');
  expect(result.url()).toBe(`${extension.baseUrl}/search?q=srcdoc%20search`);
});

test('searches selections in a cross-origin frame', async ({ extension, page }) => {
  const frameUrl = extension.baseUrl.replace('127.0.0.1', 'localhost') + '/frame';
  const attached = page.waitForEvent('framenavigated', frame => frame.url() === frameUrl);
  await page.evaluate(url => {
    const frame = document.createElement('iframe');
    frame.src = url;
    document.body.append(frame);
  }, frameUrl);
  const frame = await attached;
  await selectText(frame, 'cross-origin search');
  const opened = extension.context.waitForEvent('page');
  await frame.locator('#text').click({ button: 'middle' });
  const result = await opened;
  await result.waitForLoadState('domcontentloaded');
  expect(result.url()).toBe(`${extension.baseUrl}/search?q=cross-origin%20search`);
});

test('respects a page handler that has already consumed the gesture', async ({ extension, page }) => {
  await selectText(page);
  await page.evaluate(() => window.addEventListener('mousedown', event => {
    if (event.button === 1) event.preventDefault();
  }, true));
  const count = extension.context.pages().length;
  await page.locator('#text').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(count);
  expect(await page.evaluate(() => getSelection().toString())).toBe('curious cats & café');
});

test('an oversized selection reports an error and a shorter selection still works', async ({ extension, page }) => {
  await selectText(page, 'x'.repeat(20_001));
  await page.locator('#text').click({ button: 'middle' });
  const cdp = await extension.context.newCDPSession(page);
  await expect.poll(async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.map(node => node.name?.value || '').join(' ');
  }).toContain('Select a shorter passage');
  expect(await page.evaluate(() => getSelection().toString().length)).toBe(20_001);
  await selectText(page, 'short search');
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/search?q=short%20search`);
});
