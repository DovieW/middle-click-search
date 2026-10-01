import { test, expect, selectText } from './fixtures.js';

test.use({ denyProviderModule: true });
test('blocked settings dependency fails closed with popup status and a failure badge', async ({ extension, page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await page.bringToFront();
  const source = await extension.worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  await expect.poll(() => extension.worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), source.id)).toBe('!');
  const popup = await extension.context.newPage();
  await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, { ...source, url: page.url() });
  await popup.goto(`chrome-extension://${extension.id}/popup.html`);
  await expect(popup.locator('#siteHint')).toHaveText('Could not load extension files. Reload the extension and refresh this page.');
  await expect(popup.locator('#refresh')).toBeVisible();
  await expect(popup.locator('#errorMessage')).toContainText('Could not load extension files');
  await page.bringToFront();
  await selectText(page);
  const before = extension.context.pages().length;
  await page.locator('#text').click({ button: 'middle' });
  expect(extension.context.pages()).toHaveLength(before);
  expect(errors).toEqual([]);
});
