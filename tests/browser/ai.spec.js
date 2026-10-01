import { test, expect, selectText, middleClick, settings } from './fixtures.js';
const chatgpt = 'chatgpt';
async function mockChatGPT(extension) {
  // Verify the real extension handoff without submitting test text to a provider.
  await extension.context.route('https://chatgpt.com/**', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>ChatGPT handoff fixture</title><p>Handoff</p>',
  }));
}

test('AI prompt edits save, URL is on by default, and switching preserves the search engine', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await expect(page.locator('#aiOptions')).toBeHidden();
  await page.locator('#enginePreset').selectOption(chatgpt);
  await expect(page.locator('#aiOptions')).toBeVisible();
  await expect(page.locator('#domainOption')).toBeHidden();
  await expect(page.locator('#aiPrompt')).toHaveValue("Explain and let's discuss this.\n\nContext:\n{text}\nFrom Page: {url}");
  await expect(page.locator('#aiIncludeUrl')).toBeChecked();
  await page.locator('#aiPrompt').fill('Source: {url}\nSummarize {text} and ask me a question.');
  await page.locator('#aiIncludeUrl').uncheck();
  await expect(page.locator('#aiPreview')).toHaveCount(0);
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  await page.reload();
  await expect(page.locator('#enginePreset')).toHaveValue(chatgpt);
  await expect(page.locator('#aiPrompt')).toHaveValue('Source: {url}\nSummarize {text} and ask me a question.');
  await expect(page.locator('#aiIncludeUrl')).not.toBeChecked();
  await expect(page.locator('#save')).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ai-options-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.screenshot({ path: 'test-results/ai-options-light.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/ai-options-dark.png', fullPage: true });
  await page.locator('#enginePreset').selectOption('custom');
  await expect(page.locator('#searchEngine')).toHaveValue(`${extension.baseUrl}/search?q=%s`);
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  const stored = await extension.worker.evaluate(() => chrome.storage.sync.get(null));
  expect(stored.destination).toBe('search');
  expect(stored.aiPrompt).toBe('Source: {url}\nSummarize {text} and ask me a question.');
});

test('AI prompt validation keeps edits and prevents invalid saves', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await page.locator('#enginePreset').selectOption(chatgpt);
  await page.locator('#aiPrompt').fill('é'.repeat(2500));
  await expect(page.locator('#ai-error')).toContainText('too long');
  await page.locator('#save').click();
  expect((await extension.worker.evaluate(() => chrome.storage.sync.get('destination'))).destination).toBeUndefined();
  await page.locator('#aiPrompt').fill('Explain {text}.');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
});

test('middle-click opens the encoded ChatGPT prompt with source URL and obeys URL opt-out live', async ({ extension, page }) => {
  await mockChatGPT(extension);
  await settings(extension, { destination: chatgpt });
  await page.goto(`${extension.baseUrl}/article?chapter=2#part`);
  await selectText(page, 'https://example.com/selection');
  const result = await middleClick(extension, page);
  expect(new URL(result.url()).searchParams.get('q')).toBe(`Explain and let's discuss this.\n\nContext:\nhttps://example.com/selection\nFrom Page: ${page.url()}`);
  await page.bringToFront();
  await settings(extension, { aiPrompt: 'Translate this.', aiIncludeUrl: false });
  await selectText(page, 'café & cats');
  const withoutUrl = await middleClick(extension, page);
  expect(new URL(withoutUrl.url()).searchParams.get('q')).toBe('Translate this.\n\nContext:\ncafé & cats');
});

test('popup can switch Search engine / AI without overwriting AI preferences', async ({ extension, page }) => {
  await page.bringToFront();
  const tab = await extension.worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  tab.url = page.url();
  await settings(extension, { aiPrompt: 'Discuss.', aiIncludeUrl: false });
  const popup = await extension.context.newPage();
  await popup.addInitScript(tab => { chrome.tabs.query = async () => [tab]; }, tab);
  await popup.goto(`chrome-extension://${extension.id}/popup.html`);
  await expect(popup.locator('#controls')).toBeEnabled();
  await popup.locator('#enginePreset').selectOption(chatgpt);
  await expect(popup.locator('#status')).toHaveText('Saved.');
  await popup.reload();
  await expect(popup.locator('#enginePreset')).toHaveValue(chatgpt);
  await popup.locator('#enginePreset').selectOption('https://duckduckgo.com/?q=%s');
  await expect(popup.locator('#status')).toHaveText('Saved.');
  const stored = await extension.worker.evaluate(() => chrome.storage.sync.get(null));
  expect(stored.destination).toBe('search'); expect(stored.aiPrompt).toBe('Discuss.'); expect(stored.aiIncludeUrl).toBe(false);
});

test('ordinary links retain their focus behavior in AI mode', async ({ extension, page }) => {
  await settings(extension, { destination: chatgpt, linkFocus: 'foreground' });
  const result = await middleClick(extension, page, '#nested-link');
  expect(result.url()).toBe(`${extension.baseUrl}/native-link`);
});

test('invalid custom search draft does not block selecting AI, and reset restores AI defaults', async ({ extension }) => {
  const page = await extension.context.newPage();
  await page.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(page.locator('#controls')).toBeEnabled();
  await page.locator('#searchEngine').fill('javascript:%s');
  await page.locator('#enginePreset').selectOption(chatgpt);
  await page.locator('#aiPrompt').fill('Discuss {text}.');
  await page.locator('#aiIncludeUrl').uncheck();
  await page.locator('#save').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  const stored = await extension.worker.evaluate(() => chrome.storage.sync.get(null));
  expect(stored.searchEngine).toBe(`${extension.baseUrl}/search?q=%s`);
  await page.locator('#reset').click();
  await expect(page.locator('#status')).toHaveText('Preferences saved.');
  await page.locator('#enginePreset').selectOption(chatgpt);
  await expect(page.locator('#aiPrompt')).toHaveValue("Explain and let's discuss this.\n\nContext:\n{text}\nFrom Page: {url}");
  await expect(page.locator('#aiIncludeUrl')).toBeChecked();
});

test('AI search copies only the selection when copy-on-search is enabled', async ({ extension, page }) => {
  await mockChatGPT(extension);
  await extension.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: extension.baseUrl });
  await settings(extension, { destination: chatgpt, copyOnSearch: true });
  await selectText(page, 'clipboard context');
  await middleClick(extension, page);
  await page.bringToFront();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('clipboard context');
});

test('saved template moves the URL before context in the real ChatGPT handoff', async ({ extension, page }) => {
  await mockChatGPT(extension);
  const options = await extension.context.newPage();
  await options.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(options.locator('#controls')).toBeEnabled();
  await options.locator('#enginePreset').selectOption(chatgpt);
  await options.locator('#aiPrompt').fill('Source: {url}\n\n{text}\n\nExplain this.');
  await options.locator('#save').click();
  await expect(options.locator('#status')).toHaveText('Preferences saved.');
  await page.bringToFront();
  await selectText(page, 'literal {url} and café');
  const result = await middleClick(extension, page);
  expect(new URL(result.url()).searchParams.get('q')).toBe(`Source: ${page.url()}\n\nliteral {url} and café\n\nExplain this.`);
});

test('auto-send toggles persist and update ChatGPT handoffs on existing pages', async ({ extension, page }) => {
  await mockChatGPT(extension);
  const options = await extension.context.newPage();
  await options.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(options.locator('#controls')).toBeEnabled();
  await options.locator('#enginePreset').selectOption(chatgpt);
  await expect(options.locator('#aiAutoSend')).not.toBeChecked();
  await options.locator('#aiAutoSend').check();
  await options.locator('#save').click();
  await expect(options.locator('#status')).toHaveText('Preferences saved.');
  await options.reload();
  await expect(options.locator('#aiAutoSend')).toBeChecked();
  await page.bringToFront();
  await selectText(page, 'auto-send context');
  const auto = await middleClick(extension, page);
  expect(new URLSearchParams(new URL(auto.url()).hash.slice(1)).get('mcs-auto-send')).toBeTruthy();
  expect(new URL(auto.url()).searchParams.has('submit')).toBe(false);
  await options.locator('#aiAutoSend').uncheck();
  await options.locator('#save').click();
  await expect(options.locator('#status')).toHaveText('Preferences saved.');
  await page.bringToFront();
  await selectText(page, 'draft context');
  const draft = await middleClick(extension, page);
  expect(new URL(draft.url()).hash).toBe('');
  await options.locator('#aiAutoSend').check();
  await options.locator('#reset').click();
  await expect(options.locator('#status')).toHaveText('Preferences saved.');
  await options.locator('#enginePreset').selectOption(chatgpt);
  await expect(options.locator('#aiAutoSend')).not.toBeChecked();
});

async function mockComposer(extension, { delay = 0, keepText = false, currentLayout = false, provider = 'chatgpt', existingDraft = '' } = {}) {
  // Extension-created tabs can navigate before Playwright attaches request routing.
  // Start the test tab blank, then navigate through Playwright so no text reaches ChatGPT.
  await extension.worker.evaluate(() => {
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = async options => {
      globalThis.nextComposerFixtureUrl = options.url;
      return create({ ...options, url: 'about:blank' });
    };
  });
  extension.context.on('page', async tab => {
    const url = await extension.worker.evaluate(() => {
      const url = globalThis.nextComposerFixtureUrl;
      globalThis.nextComposerFixtureUrl = null;
      return url;
    });
    if (url) await tab.goto(url);
  });
  const domain = provider === 'gemini' ? 'gemini.google.com' : provider === 'claude' ? 'claude.ai' : provider === 'perplexity' ? 'www.perplexity.ai' : 'chatgpt.com';
  await extension.context.route(`https://${domain}/**`, route => route.fulfill({
    contentType: 'text/html', body: `<!doctype html><title>ChatGPT composer fixture</title>
      <form data-chatgpt-composer>
      <div ${provider === 'gemini' ? 'class="ql-editor" role="textbox"' : currentLayout ? 'role="textbox" aria-label="Ask ChatGPT"' : 'id="prompt-textarea"'} contenteditable="true"></div>
      <button ${provider === 'gemini' ? 'class="send-button" aria-label="Send message"' : currentLayout ? 'aria-label="Send" type="submit"' : 'data-testid="send-button"'} id="send" disabled>Send</button></form><script>
      window.sentCount = 0;
      const field = document.querySelector('[contenteditable=true]');
      field.innerText = ${provider === 'gemini' ? JSON.stringify(existingDraft) : "new URL(location.href).searchParams.get('q') || ''"};
      if (${currentLayout}) field.innerText = field.innerText.split(String.fromCharCode(10)).join(String.fromCharCode(10, 10));
      const button = document.querySelector('#send');
      setTimeout(() => { button.disabled = false; }, ${delay});
      button.addEventListener('click', event => {
        event.preventDefault();
        window.sentCount++;
        ${keepText ? '' : "field.innerText = ''; button.disabled = true;"}
      });</script>`,
  }));
}

test('authorized auto-send waits for a ready composer, clicks once and clears its ticket', async ({ extension, page }) => {
  await mockComposer(extension, { delay: 1200 });
  await settings(extension, { destination: chatgpt, aiAutoSend: true });
  await selectText(page, 'authorized context');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  await expect.poll(() => result.evaluate(() => window.sentCount)).toBe(1);
  await expect.poll(async () => {
    const records = await extension.worker.evaluate(() => chrome.storage.session.get(null));
    return Object.keys(records).filter(key => key.startsWith('ai-handoff-'));
  }).toEqual([]);
  expect(await result.evaluate(() => window.sentCount)).toBe(1);
});

test('normal ChatGPT drafts and manually opened URLs cannot trigger submission', async ({ extension, page }) => {
  await mockComposer(extension);
  await settings(extension, { destination: chatgpt, aiAutoSend: false });
  await selectText(page, 'draft context');
  const draft = await middleClick(extension, page);
  await expect(draft.locator('#send')).toBeEnabled();
  expect(await draft.evaluate(() => window.sentCount)).toBe(0);
  const manual = await extension.context.newPage();
  await manual.goto('https://chatgpt.com/?q=manual# mcs-auto-send=fake'.replace('# ', '#'));
  await expect(manual.locator('#send')).toBeEnabled();
  expect(await manual.evaluate(() => window.sentCount)).toBe(0);
});

test('editing an authorized prompt cancels auto-send', async ({ extension, page }) => {
  await mockComposer(extension, { delay: 2000 });
  await settings(extension, { destination: chatgpt, aiAutoSend: true });
  await selectText(page, 'original context');
  const result = await middleClick(extension, page);
  await result.locator('#prompt-textarea').fill('My edited prompt');
  await expect(result.locator('#send')).toBeEnabled();
  expect(await result.evaluate(() => window.sentCount)).toBe(0);
  await expect(result.locator('#prompt-textarea')).toHaveText('My edited prompt');
});

test('auto-send supports the current live ChatGPT editor and Send button markup', async ({ extension, page }) => {
  await mockComposer(extension, { currentLayout: true });
  await settings(extension, { destination: chatgpt, aiAutoSend: true });
  await selectText(page, 'current ChatGPT layout');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  await expect.poll(() => result.evaluate(() => window.sentCount)).toBe(1);
  await expect(result.locator('[role=textbox]')).toBeEmpty();
});

test('an unconfirmed send shows a source-page error and is not retried', async ({ extension, page }) => {
  test.setTimeout(65_000);
  await mockComposer(extension, { keepText: true });
  await page.bringToFront();
  const sourceId = await extension.worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  await settings(extension, { destination: chatgpt, aiAutoSend: true });
  await selectText(page, 'unconfirmed context');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  await expect.poll(() => result.evaluate(() => window.sentCount)).toBe(1);
  // Exercise the real deadline in the content script's isolated world.
  await expect.poll(async () => (await extension.worker.evaluate(() => chrome.storage.session.get(null)))[`tab-error-${sourceId}`] || '', { timeout: 50_000 })
    .toContain('could not send automatically');
  expect(await result.evaluate(() => window.sentCount)).toBe(1);
});

for (const provider of ['gemini', 'claude', 'perplexity']) test(`${provider} appears in options and popup and receives the shared prompt`, async ({ extension, page }) => {
  await mockComposer(extension, { provider });
  const options = await extension.context.newPage();
  await options.goto(`chrome-extension://${extension.id}/options.html`);
  await expect(options.locator('#controls')).toBeEnabled();
  await options.locator('#enginePreset').selectOption(provider);
  await expect(options.locator('#aiOptions')).toBeVisible();
  await expect(options.locator('#domainOption')).toBeHidden();
  if (provider === 'gemini') await expect(options.locator('#autoSendOption')).toContainText('experimental');
  else await expect(options.locator('#autoSendOption')).toBeHidden();
  if (provider === 'perplexity') await expect(options.locator('#aiProviderHint')).toHaveText('Perplexity sends on opening.');
  await options.locator('#aiPrompt').fill('From Page: {url}\nExplain {text}');
  await options.locator('#save').click();
  await expect(options.locator('#status')).toHaveText('Preferences saved.');
  await options.reload();
  await expect(options.locator('#enginePreset')).toHaveValue(provider);
  const popup = await extension.context.newPage();
  await popup.goto(`chrome-extension://${extension.id}/popup.html`);
  await expect(popup.locator('#enginePreset')).toHaveValue(provider);
  await popup.locator('#enginePreset').selectOption('chatgpt');
  await popup.locator('#enginePreset').selectOption(provider);
  await page.bringToFront();
  await selectText(page, 'provider context café & {url} <script>');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  const expected = `From Page: ${page.url()}\nExplain provider context café & {url} <script>`;
  expect(new URL(result.url()).searchParams.get('q')).toBe(expected);
  if (provider === 'gemini') {
    await expect(result.locator('.ql-editor')).toHaveText(expected, { useInnerText: true });
    expect(await result.evaluate(() => window.sentCount)).toBe(0);
    await expect.poll(async () => Object.keys(await extension.worker.evaluate(() => chrome.storage.session.get(null))).filter(key => key.startsWith('ai-handoff-'))).toEqual([]);
  } else expect(new URL(result.url()).hash).toBe('');
});

test('experimental Gemini auto-send fills the draft and submits once', async ({ extension, page }) => {
  await mockComposer(extension, { provider: 'gemini', delay: 1500 });
  await settings(extension, { destination: 'gemini', aiAutoSend: true });
  await selectText(page, 'Gemini auto-send context');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  await expect.poll(() => result.evaluate(() => window.sentCount)).toBe(1);
  await expect(result.locator('.ql-editor')).toBeEmpty();
});

test('Gemini preserves an existing draft and rejects a manually opened handoff', async ({ extension, page }) => {
  await mockComposer(extension, { provider: 'gemini', existingDraft: 'My own draft' });
  await settings(extension, { destination: 'gemini', aiAutoSend: true });
  await selectText(page, 'original context');
  const result = await middleClick(extension, page);
  await expect(result.locator('.ql-editor')).toHaveText('My own draft');
  await expect.poll(async () => Object.keys(await extension.worker.evaluate(() => chrome.storage.session.get(null))).filter(key => key.startsWith('ai-handoff-'))).toEqual([]);
  expect(await result.evaluate(() => window.sentCount)).toBe(0);
  const manual = await extension.context.newPage();
  await manual.goto('https://gemini.google.com/app?q=untrusted#mcs-auto-send=fake');
  await expect(manual.locator('.ql-editor')).toHaveText('My own draft');
  expect(await manual.evaluate(() => window.sentCount)).toBe(0);
});

test('successful AI submission preserves an earlier clipboard warning', async ({ extension, page }) => {
  await mockComposer(extension, { delay: 1200 });
  await extension.worker.evaluate(() => {
    chrome.offscreen.createDocument = async () => { throw new Error('Unavailable clipboard'); };
  });
  await page.bringToFront();
  const sourceId = await extension.worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  await settings(extension, { destination: 'chatgpt', aiAutoSend: true, copyOnSearch: true });
  await selectText(page, 'clipboard warning context');
  const result = await middleClick(extension, page);
  await expect(result.locator('#send')).toBeVisible();
  await expect.poll(() => result.evaluate(() => window.sentCount)).toBe(1);
  await expect.poll(async () => Object.keys(await extension.worker.evaluate(() => chrome.storage.session.get(null))).filter(key => key.startsWith('ai-handoff-'))).toEqual([]);
  await expect.poll(async () => (await extension.worker.evaluate(() => chrome.storage.session.get(null)))[`tab-error-${sourceId}`] || '')
    .toContain('copying to the clipboard failed');
});
