import { test as base, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export const test = base.extend({
  extension: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'middle-click-test-'));
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html><head><title>Extension fixture</title></head><body>
        <p id="text">curious cats & café</p><p id="other">another selection</p>
        <a id="link" href="/native-link"><span><strong id="nested-link">Native link</strong></span></a>
        <input id="input" value="input search text"><textarea id="textarea">textarea search text</textarea>
        <input id="password" type="password" value="secret password">
        <div id="shadow"></div><div id="shadow-link"></div>
        ${req.url === '/frame' ? '' : '<iframe src="/frame" title="Fixture frame"></iframe>'}
        <script>
          document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<p id="shadow-text">shadow search text</p>';
          document.querySelector('#shadow-link').attachShadow({mode:'open'}).innerHTML='<a href="/shadow-native"><span><b>Shadow link</b></span></a>';
          window.middleDefaultPrevented = null;
          document.addEventListener('mousedown',e=>{if(e.button===1)window.middleDefaultPrevented=e.defaultPrevented});
        </script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let context;
    try {
      context = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.EXTENSION_BROWSER_PATH || chromium.executablePath(),
        headless: false,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--headless=new', `--disable-extensions-except=${repo}`, `--load-extension=${repo}`],
      });
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      await worker.evaluate(() => {
        globalThis.createdTabs = [];
        chrome.tabs.onCreated.addListener(tab => globalThis.createdTabs.push(tab.id));
      });
      const id = new URL(worker.url()).host;
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      await worker.evaluate(async url => chrome.storage.sync.set({ searchEngine: `${url}/search?q=%s` }), baseUrl);
      await use({ context, worker, id, baseUrl });
    } finally {
      await context?.close();
      await new Promise(resolve => server.close(resolve));
      await rm(profile, { recursive: true, force: true });
    }
  },
  page: async ({ extension }, use) => {
    const page = await extension.context.newPage();
    await page.goto(extension.baseUrl);
    await page.bringToFront();
    await use(page);
  },
});
export { expect };

export async function selectText(page, text = 'curious cats & café', selector = '#text') {
  await page.locator(selector).evaluate((element, value) => {
    element.textContent = value;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = element.ownerDocument.defaultView.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, text);
}
export async function middleClick(extension, page, selector = '#text', modifiers = []) {
  const opened = extension.context.waitForEvent('page');
  await page.locator(selector).click({ button: 'middle', modifiers });
  const result = await opened;
  await result.waitForLoadState('domcontentloaded');
  return result;
}
export async function settings(extension, changes) {
  await extension.worker.evaluate(async values => chrome.storage.sync.set(values), changes);
}
