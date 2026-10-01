import { test, expect } from './fixtures.js';

test('settings persist through save and reload, with live search preview', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#enginePreset').selectOption('https://duckduckgo.com/?q=%s');
  await page.locator('#newTabActive').uncheck();
  await page.locator('#disableDomainCheck').check();
  await expect(page.locator('#preview')).toHaveText('https://duckduckgo.com/?q=curious%20cats');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  await page.reload();
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#searchEngine')).toHaveValue('https://duckduckgo.com/?q=%s');
  await expect(page.locator('#newTabActive')).not.toBeChecked();
  await expect(page.locator('#disableDomainCheck')).toBeChecked();
});

test('invalid custom URLs never replace the saved engine', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#searchEngine').fill('javascript:%s');
  await page.locator('#save').click();
  await expect(page.locator('#url-error')).toHaveText('Use an HTTP or HTTPS search URL.');
  const stored = await extension.worker.evaluate(async () => chrome.storage.sync.get('searchEngine'));
  expect(stored.searchEngine).toBe(`${extension.baseUrl}/search?q=%s`);
});

test('migrates the legacy domain setting without overwriting a synced preference', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.evaluate(() => localStorage.setItem('disableDomainCheck', 'true'));
  await page.reload();
  await expect(page.locator('#disableDomainCheck')).toBeChecked();
  expect(await extension.worker.evaluate(async () => chrome.storage.sync.get('disableDomainCheck'))).toEqual({ disableDomainCheck: true });
  await extension.worker.evaluate(async () => chrome.storage.sync.set({ disableDomainCheck: false }));
  await page.evaluate(() => localStorage.setItem('disableDomainCheck', 'true'));
  await page.reload();
  await expect(page.locator('#disableDomainCheck')).not.toBeChecked();
});

test('restores all defaults and fits mobile viewport', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#reset').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  await expect(page.locator('#searchEngine')).toHaveValue('https://www.google.com/search?q=%s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('save failures are visible and allow retry without losing edits', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#newTabActive').uncheck();
  await page.evaluate(() => {
    const original = chrome.storage.sync.set.bind(chrome.storage.sync);
    chrome.storage.sync.set = async values => {
      chrome.storage.sync.set = original;
      throw new Error('Simulated sync failure');
    };
  });
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('Simulated sync failure');
  await expect(page.locator('#newTabActive')).not.toBeChecked();
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
});

test('Custom selection leaves the URL ready for editing', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#enginePreset').selectOption('https://www.google.com/search?q=%s');
  await page.locator('#enginePreset').selectOption('custom');
  await expect(page.locator('#enginePreset')).toHaveValue('custom');
  await expect(page.locator('#searchEngine')).toBeFocused();
  await page.locator('#searchEngine').fill(`${extension.baseUrl}/custom/%s`);
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  const stored = await extension.worker.evaluate(async () => chrome.storage.sync.get('searchEngine'));
  expect(stored.searchEngine).toBe(`${extension.baseUrl}/custom/%s`);
});
