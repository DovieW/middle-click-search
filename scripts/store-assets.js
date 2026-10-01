import { chromium } from '@playwright/test';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const output = join(root, 'release-files', version, 'store-assets');
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'middle-click-release-'));
const extension = join(temp, 'extension');
await mkdir(extension);
execFileSync('unzip', ['-q', join(root, 'release-files', version, `middle-click-search-${version}.zip`), '-d', extension]);
let context;
try {
  context = await chromium.launchPersistentContext(join(temp, 'profile'), {
    executablePath: process.env.EXTENSION_BROWSER_PATH || chromium.executablePath(),
    headless: false, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--headless=new', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light',
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForFunction(() => !document.querySelector('#controls').disabled);
  await page.locator('summary').filter({ hasText: 'More options' }).click();
  await page.screenshot({ path: join(output, 'screenshot-settings.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: join(output, 'screenshot-settings-dark.png') });
  await page.setViewportSize({ width: 440, height: 280 });
  // A plain HTML promotional layout using the existing icon, without modifying it.
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;background:#18181b;color:#fff;font-family:system-ui,sans-serif;
    height:280px;display:flex;align-items:center;justify-content:center;gap:22px}
    img{width:88px;height:88px}h1{font-size:28px;line-height:1.15;letter-spacing:-1px;margin:0}
    p{font-size:14px;color:#a1a1aa;margin:12px 0 0}
    </style></head><body><img src="chrome-extension://${id}/Middle_Click128.png" alt="">
    <div><h1>Middle Click<br>to Search</h1><p>Select. Click. Search.</p></div></body></html>`);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  await page.screenshot({ path: join(output, 'promo-small-440x280.png') });
} finally {
  await context?.close();
  await rm(temp, { recursive: true, force: true });
}
await copyFile(join(root, 'Middle_Click128.png'), join(output, 'store-icon-128.png'));
for (const file of ['description.txt', 'dashboard-notes.txt']) await copyFile(join(root, 'docs', 'store', file), join(output, file));
execFileSync('python3', [join(root, 'scripts', 'package.py')], { stdio: 'inherit' });
console.log(`Store assets created in ${output}`);
