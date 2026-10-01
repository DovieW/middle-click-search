import { test, expect, selectText, middleClick, settings } from './fixtures.js';
async function popupFor(extension, source) {
  await source.bringToFront();
  const tab = await extension.worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  tab.url = source.url();
  const popup = await extension.context.newPage();
  await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, tab);
  await popup.goto(`chrome-extension://${extension.id}/popup.html`);
  await expect(popup.locator('#controls')).toBeEnabled();
  return popup;
}
async function badge(extension, source) {
  await source.bringToFront();
  return extension.worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.action.getBadgeText({ tabId: tab.id });
  });
}
test('popup checks a real page, differentiates site disable, and never badges success', async ({ extension, page }) => {
  const popup = await popupFor(extension, page);
  await expect(popup.locator('#siteHint')).toHaveAttribute('data-state', 'ready');
  await expect(popup.locator('#refresh')).toBeHidden();
  await popup.locator('#siteEnabled').uncheck();
  await expect(popup.locator('#siteHint')).toHaveText('Disabled on this site.');
  await popup.locator('#siteEnabled').check();
  await expect(popup.locator('#siteHint')).toHaveAttribute('data-state', 'ready');
  await page.bringToFront(); await selectText(page); await middleClick(extension, page);
  expect(await badge(extension, page)).toBe('');
});
test('missing receiver offers refresh and the real page refresh recovers', async ({ extension, page }) => {
  const popup = await popupFor(extension, page);
  // Simulate an absent receiver; retain the real reload and restore messaging for recovery.
  await popup.evaluate(() => {
    const send = chrome.tabs.sendMessage.bind(chrome.tabs);
    const reload = chrome.tabs.reload.bind(chrome.tabs);
    chrome.tabs.sendMessage = async () => { throw new Error('No receiver'); };
    chrome.tabs.reload = async id => { chrome.tabs.sendMessage = send; return reload(id); };
  });
  await popup.locator('#enabled').uncheck();
  await expect(popup.locator('#siteHint')).toHaveText('Extension is off.');
  await popup.locator('#enabled').check();
  await expect(popup.locator('#siteHint')).toHaveText('Not active. Try refreshing.');
  await expect(popup.locator('#refresh')).toBeVisible();
  const navigation = page.waitForEvent('load');
  await popup.locator('#refresh').click(); await navigation;
  await expect(popup.locator('#siteHint')).toHaveAttribute('data-state', 'ready');
  await expect(popup.locator('#refresh')).toBeHidden();
});
test('failure badges only its source tab and is visible/dismissible in popup', async ({ extension, page }) => {
  await extension.worker.evaluate(() => {
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async options => { chrome.tabs.create = create; throw new Error('Simulated tab failure'); };
  });
  await selectText(page); await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => badge(extension, page)).toBe('!');
  const popup = await popupFor(extension, page);
  await expect(popup.locator('#errorMessage')).toHaveText('Simulated tab failure');
  await popup.locator('#dismissError').click();
  await expect(popup.locator('#pageError')).toBeHidden();
  expect(await badge(extension, page)).toBe('');
  await popup.setViewportSize({ width: 300, height: 380 });
});
test('successful retry and navigation clear failures', async ({ extension, page }) => {
  await selectText(page, 'x'.repeat(20_001)); await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => badge(extension, page)).toBe('!');
  await selectText(page, 'retry'); await middleClick(extension, page);
  await expect.poll(() => badge(extension, page)).toBe('');
  await page.bringToFront(); await selectText(page, 'x'.repeat(20_001)); await page.locator('#text').click({ button: 'middle' });
  await expect.poll(() => badge(extension, page)).toBe('!');
  await page.reload(); await expect.poll(() => badge(extension, page)).toBe('');
});
test('clipboard warning shows a failure badge despite successful navigation', async ({ extension, page }) => {
  await settings(extension, { copyOnSearch: true });
  await extension.worker.evaluate(() => { chrome.offscreen.createDocument = async () => { throw new Error('No clipboard'); }; });
  await selectText(page); await middleClick(extension, page);
  expect(await badge(extension, page)).toBe('!');
  const popup = await popupFor(extension, page);
  await expect(popup.locator('#errorMessage')).toContainText('clipboard failed');
  await popup.setViewportSize({ width: 300, height: 380 });
  await popup.screenshot({ path: 'test-results/popup-error.png' });
});

test('open popup follows settings changes from another extension page', async ({ extension, page }) => {
  const popup = await popupFor(extension, page);
  await settings(extension, { enabled: false, searchEngine: 'https://duckduckgo.com/?q=%s' });
  await expect(popup.locator('#enabled')).not.toBeChecked();
  await expect(popup.locator('#enginePreset')).toHaveValue('https://duckduckgo.com/?q=%s');
  await expect(popup.locator('#siteHint')).toHaveText('Extension is off.');
});

test('popup updates its site after source navigation', async ({ extension, page }) => {
  const popup = await popupFor(extension, page);
  await page.goto(extension.baseUrl.replace('127.0.0.1', 'localhost'));
  await expect(popup.locator('#site')).toHaveText('localhost');
});
