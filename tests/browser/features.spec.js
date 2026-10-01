import { test, expect, selectText, middleClick, settings } from './fixtures.js';

for (const linkFocus of ['foreground', 'background']) for (const modifiers of [[], ['Control'], ['Meta']]) {
  test(`ordinary link ${linkFocus} ${modifiers.join('+') || 'none'} opens exactly once`, async ({ extension, page }) => {
    await settings(extension, { linkFocus });
    const count = extension.context.pages().length;
    const result = await middleClick(extension, page, '#nested-link', modifiers);
    expect(result.url()).toBe(`${extension.baseUrl}/native-link`);
    await expect.poll(async () => (await extension.worker.evaluate(async () => chrome.tabs.get(globalThis.createdTabs.at(-1)))).active)
      .toBe((linkFocus === 'foreground') !== Boolean(modifiers.length));
    expect(extension.context.pages()).toHaveLength(count + 1);
  });
}

test('foreground handling works through shadow links and respects page cancellation', async ({ extension, page }) => {
  await settings(extension, { linkFocus: 'foreground' });
  expect((await middleClick(extension, page, '#shadow-link b')).url()).toBe(`${extension.baseUrl}/shadow-native`);
  await page.bringToFront();
  await page.locator('#link').evaluate(link => link.addEventListener('auxclick', event => event.preventDefault()));
  const count = extension.context.pages().length;
  await page.locator('#nested-link').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(count);
});

test('live site controls disable searches and link overrides, then restore them', async ({ extension, page }) => {
  await settings(extension, { siteRules: ['127.0.0.1'], linkFocus: 'foreground' });
  await selectText(page);
  const count = extension.context.pages().length;
  await page.locator('#text').click({ button: 'middle' });
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
  expect(extension.context.pages()).toHaveLength(count);
  await settings(extension, { siteOverrides: { '127.0.0.1': true } });
  await selectText(page);
  await middleClick(extension, page);
});

test('top-level site rules apply to cross-origin frames', async ({ extension, page }) => {
  await settings(extension, { siteMode: 'allow', siteRules: ['127.0.0.1'] });
  const frameUrl = extension.baseUrl.replace('127.0.0.1', 'localhost') + '/frame';
  await page.evaluate(url => { const frame = document.createElement('iframe'); frame.src = url; document.body.append(frame); }, frameUrl);
  await expect.poll(() => page.frames().some(frame => frame.url() === frameUrl)).toBe(true);
  const frame = page.frames().find(frame => frame.url() === frameUrl);
  await selectText(frame, 'allowed frame');
  const opened = extension.context.waitForEvent('page');
  await frame.locator('#text').click({ button: 'middle' });
  const result = await opened; await result.waitForLoadState('domcontentloaded');
  expect(result.url()).toBe(`${extension.baseUrl}/search?q=allowed%20frame`);
});

test('copy-on-search writes the actual clipboard for foreground and background tabs', async ({ extension, page }) => {
  await extension.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: extension.baseUrl });
  for (const newTabActive of [true, false]) {
    await page.bringToFront();
    await settings(extension, { copyOnSearch: true, newTabActive });
    await selectText(page, `copied text ${newTabActive}`);
    await middleClick(extension, page);
    await page.bringToFront();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`copied text ${newTabActive}`);
  }
});

test('new preferences persist, invalid site rules cannot save, and layouts fit', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await page.locator('#linkFocus').selectOption('foreground');
  await page.locator('summary').filter({ hasText: 'More options' }).click();
  await page.locator('#copyOnSearch').check();
  await page.locator('#siteMode').selectOption('allow');
  await page.locator('#siteRules').fill('example.com\n*.example.org');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  await page.reload();
  await expect(page.locator('#copyOnSearch')).toBeChecked();
  await expect(page.locator('#linkFocus')).toHaveValue('foreground');
  await expect(page.locator('#siteRules')).toHaveValue('example.com\n*.example.org');
  await page.locator('#siteRules').fill('https://wrong.com/path');
  await page.locator('#save').click();
  await expect(page.locator('#rules-error')).toContainText('Invalid site');
  expect((await extension.worker.evaluate(() => chrome.storage.sync.get('siteRules'))).siteRules).toEqual(['example.com', '*.example.org']);
  await page.locator('#siteRules').fill('example.com\n*.example.org');
  await expect(page.locator('#save')).toBeDisabled();
  await page.setViewportSize({ width: 1100, height: 1200 });
  await page.screenshot({ path: 'test-results/options-desktop.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/options-dark.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/options-mobile.png', fullPage: true });
});

test('popup toggles only the current host and offers saved custom engines', async ({ extension, page }) => {
  await settings(extension, { siteRules: ['*.example.org'], siteOverrides: { 'example.com': false } });
  const popup = await extension.context.newPage();
  await popup.goto(`chrome-extension://${extension.id}/popup.html`);
  // The toolbar grants activeTab; emulate its active-tab result in this tab-based harness.
  await popup.addInitScript(url => { chrome.tabs.query = async () => [{ url }]; }, extension.baseUrl);
  await popup.reload();
  await expect(popup.locator('#site')).toHaveText('127.0.0.1');
  await expect(popup.locator('#siteEnabled')).toBeEnabled();
  await expect(popup.locator('#enginePreset')).toHaveValue(`${extension.baseUrl}/search?q=%s`);
  await popup.locator('#siteEnabled').uncheck();
  await expect(popup.locator('#status')).toHaveText('Saved.');
  const stored = await extension.worker.evaluate(() => chrome.storage.sync.get(null));
  expect(stored.siteOverrides).toEqual({ 'example.com': false, '127.0.0.1': false });
  expect(stored.siteRules).toEqual(['*.example.org']);
  await popup.locator('#useRules').click();
  await expect(popup.locator('#siteEnabled')).toBeChecked();
  await popup.setViewportSize({ width: 340, height: 530 });
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await popup.screenshot({ path: 'test-results/popup.png' });
  await popup.locator('#enginePreset').selectOption('https://duckduckgo.com/?q=%s');
  await expect.poll(async () => (await extension.worker.evaluate(() => chrome.storage.sync.get('searchEngine'))).searchEngine).toBe('https://duckduckgo.com/?q=%s');
});

test('saving options preserves popup changes made while the form is open', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await page.locator('#newTabActive').uncheck();
  await settings(extension, { enabled: false, siteOverrides: { 'example.com': false } });
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  const stored = await extension.worker.evaluate(() => chrome.storage.sync.get(null));
  expect(stored.enabled).toBe(false);
  expect(stored.newTabActive).toBe(false);
  expect(stored.siteOverrides).toEqual({ 'example.com': false });
  await expect(page.locator('#enabled')).not.toBeChecked();
});

test('disabled sites keep browser link focus and global disable wins over exceptions', async ({ extension, page }) => {
  await settings(extension, { siteRules: ['127.0.0.1'], linkFocus: 'foreground' });
  await middleClick(extension, page, '#nested-link');
  expect((await extension.worker.evaluate(async () => chrome.tabs.get(globalThis.createdTabs.at(-1)))).active).toBe(false);
  await page.bringToFront();
  await settings(extension, { enabled: false, siteOverrides: { '127.0.0.1': true } });
  await selectText(page);
  const count = extension.context.pages().length;
  await page.locator('#text').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(count);
  expect(await page.evaluate(() => window.middleDefaultPrevented)).toBe(false);
});

test('clipboard failure warns without stopping the search or keeping temporary text', async ({ extension, page }) => {
  await settings(extension, { copyOnSearch: true });
  await extension.worker.evaluate(() => { chrome.offscreen.createDocument = async () => { throw new Error('Clipboard unavailable'); }; });
  await selectText(page, 'still search');
  expect((await middleClick(extension, page)).url()).toBe(`${extension.baseUrl}/search?q=still%20search`);
  const cdp = await extension.context.newCDPSession(page);
  await expect.poll(async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.map(node => node.name?.value || '').join(' ');
  }).toContain('copying to the clipboard failed');
});

test('late document auxclick cancellation keeps page behavior', async ({ extension, page }) => {
  await settings(extension, { linkFocus: 'foreground' });
  await page.evaluate(() => document.addEventListener('auxclick', event => event.preventDefault()));
  const count = extension.context.pages().length;
  await page.locator('#nested-link').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(count);
});

test('clean options refresh when settings change elsewhere', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await settings(extension, { enabled: false });
  await expect(page.locator('#enabled')).not.toBeChecked();
  await expect(page.locator('#save')).toBeDisabled();
});
