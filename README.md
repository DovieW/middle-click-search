# Middle Click to Search

Select text on a webpage and middle-click (press the mouse wheel) to search it in a new tab. Select a web address to open it directly. Hold **Ctrl** or **⌘** to reverse whether the new tab takes focus. Native link clicks keep their usual behavior.

## Install for development

1. Download or clone this repository.
2. Open your Chromium browser's extension management page and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository directory containing `manifest.json`.
4. Open an ordinary HTTP(S) webpage and try a selected-text middle-click.

There is no build step. Changes to background/content scripts require reloading the extension and refreshing test pages. Click the extension toolbar icon to open settings.

## Preferences

Choose Google, DuckDuckGo, Bing, Brave, or a custom HTTP(S) search URL containing `%s`. The preview shows how selected text will be encoded. Click **Save preferences** to apply changes.

You can switch to new tabs or keep them in the background, always search even if text resembles a URL, retain the highlight, and control wheel scrolling during a search. Results open immediately after the originating tab in the same window. Existing search-engine and focus preferences carry forward; the old domain-checking preference migrates when you open settings.

Only preferences are stored using browser sync storage. The extension does not keep selections or search history, run analytics, or contact a backend. Your chosen destination receives text when a search tab opens. HTTP search URLs are supported for local/private engines; use HTTPS for public engines when available.

## Develop and test

Use Node.js 22 or newer:

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Linux environments may need Playwright's system packages: `npx playwright install --with-deps chromium`. Browser tests load the actual unpacked extension in Chrome for Testing, use temporary profiles and a local fixture server, and clean them up afterward. They do not send test selections to public search engines. Unit tests cover routing, setting normalization, and browser API failures.

In this prepared cloud environment, use the retained browser cache:

```sh
PLAYWRIGHT_BROWSERS_PATH=/workspace/cloud-onboarding/browsers npm run test:browser
```

Set `EXTENSION_BROWSER_PATH` if testing a different extension-capable Chromium binary. Some ordinary Chrome/Chromium builds no longer accept automated unpacked-extension loading; use Chrome for Testing for the suite. Failed browser runs retain traces under `test-results/`.

## Supported scope

The manifest targets Chrome 102+ and Chromium-based browsers with compatible extension APIs. Automated verification uses Linux Chrome for Testing; other browsers and operating systems require release testing. Firefox needs a separate background manifest and is not currently supported.

Content scripts run on HTTP(S) pages and matching frames. Browser settings pages, the Chrome Web Store, built-in PDF viewers, and other browser-protected pages do not permit the gesture. Password inputs are ignored. Standard text/search/URL/tel inputs and textareas support selected-text search; some rich editors implement their own selection model.

If a search fails, the selection stays highlighted and an error appears on the page. Automatic retries are avoided to prevent duplicate tabs. After reloading/updating the extension, refresh existing webpages. Domain detection cannot distinguish every filename from a hostname; enable **Always search selected text** if you prefer predictable search-only behavior.

See [the project evaluation](docs/PROJECT_REVIEW.md) for the baseline findings, architecture, product directions, and release checklist. Licensed under [GPL-3.0](LICENSE).
