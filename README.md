# Middle Click to Search

Select text on a webpage and middle-click (press the mouse wheel) to search it in a new tab. Select a web address to open it directly. Hold **Ctrl** or **⌘** to reverse whether the new tab takes focus. Native link clicks use browser behavior by default; choose foreground or background opening in settings.

## Install for development

1. Download or clone this repository.
2. Open your Chromium browser's extension management page and enable **Developer mode**.
3. Choose **Load unpacked** and select the repository directory containing `manifest.json`.
4. Open an ordinary HTTP(S) webpage and try a selected-text middle-click.

There is no build step. Changes to background/content scripts require reloading the extension and refreshing test pages. Click the extension toolbar icon for quick controls; choose **Settings** for the full options page.

## Preferences

Choose Google, DuckDuckGo, Bing, Brave, or a custom HTTP(S) search URL containing `%s`. The preview shows how selected text will be encoded. Click **Save changes** to apply edits. The save bar highlights unsaved changes; Save is disabled when nothing has changed.

Settings are grouped into Search, Tabs, and Sites. Custom URLs, previews, and site overrides appear only when relevant; additional mouse options are expandable.

You can switch to new tabs or keep them in the background, always search even if text resembles a URL, retain the highlight, and control wheel scrolling during a search. Results open immediately after the originating tab in the same window. Existing search-engine and focus preferences carry forward; the old domain-checking preference migrates when you open settings.

### Webpage links

**Middle-clicked links** has three choices: Browser behavior, Foreground, or Background. Ctrl or ⌘ reverses an explicit foreground/background choice. These preferences are independent of search-result focus. HTTP(S) anchors, including nested/shadow links, are supported; downloads, non-web schemes, and links handled by a site's own JavaScript retain native handling where possible. A failed override shows an error rather than retrying or opening duplicate tabs.

### Site controls

Run everywhere except listed sites, or only on listed sites. Enter one hostname per line: `example.com` matches only itself; `*.example.com` includes the base host and every subdomain. Ports and paths are not part of a site rule. Up to 100 rules are supported. The top-level site controls gestures in all frames, including cross-origin frames.

The popup can enable/disable the extension globally, toggle the exact current host, choose an engine, or open settings. Exact-host popup exceptions take precedence over the site list; global disable takes precedence over everything. **Reset site** removes the current exception. View/remove exceptions in the options page. Restricted pages cannot run gestures even if a rule allows them.

### Clipboard

Enable **Copy selection to clipboard** to replace the clipboard with the selected text, including direct URL selections. Ordinary link clicks never copy. Clipboard failure warns without blocking the tab. Clipboard work runs in an offscreen extension document, works independently of webpage focus/HTTPS, and clears the temporary text immediately. The extension requests clipboard-write, offscreen-document, and active-tab permissions for these controls; it does not request clipboard-read permission.

Only preferences are stored using browser sync storage. Short failure diagnostics are kept in browser session storage and cleared on navigation, dismissal, or a successful retry. The extension does not keep selections or search history, run analytics, or contact a backend. Your chosen destination receives text when a search tab opens. HTTP search URLs are supported for local/private engines; use HTTPS for public engines when available.

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

Set `EXTENSION_BROWSER_PATH` if testing a different extension-capable Chromium binary. Some ordinary Chrome/Chromium builds no longer accept automated unpacked-extension loading; use Chrome for Testing for the suite. Failed browser runs retain traces under `test-results/`.

## Supported scope

The manifest targets Chrome 116+ and Chromium-based browsers with compatible extension APIs. Automated verification uses Linux Chrome for Testing; other browsers and operating systems require release testing. Firefox needs a separate background manifest and is not currently supported.

Content scripts run on HTTP(S) pages and matching frames. Browser settings pages, the Chrome Web Store, built-in PDF viewers, and other browser-protected pages do not permit the gesture. Password inputs are ignored. Standard text/search/URL/tel inputs and textareas support selected-text search; some rich editors implement their own selection model.

Site/focus/scrolling changes update existing content scripts without a page refresh.

If a search fails, the selection stays highlighted and an error appears on the page. Automatic retries are avoided to prevent duplicate tabs. After reloading/updating the extension, refresh existing webpages. Domain detection cannot distinguish every filename from a hostname; enable **Always search selected text** if you prefer predictable search-only behavior.

See [the project evaluation](docs/PROJECT_REVIEW.md) for the baseline findings, architecture, product directions, and release checklist. Licensed under [GPL-3.0](LICENSE).


## Page status and errors

The popup probes the top-level content script. An inactive page offers **Refresh page**; disabled sites, global disable, and known restricted pages have their own status. A refresh may still be insufficient if Chrome or a site policy blocks content scripts. Settings changes do not require a refresh, but installing/reloading/updating the extension can leave existing pages without a working script.

A red **!** badge indicates a failed search/link operation or clipboard write, on the originating tab only. The popup shows the diagnostic and a **Dismiss** button. Successful actions never show a success badge; a successful retry clears an earlier failure. Navigation also clears it. No selection or destination is stored in diagnostics.

## Release packaging

Run `npm run package` to create a reproducible runtime-only Chrome Web Store ZIP under `release-files/<version>/`. Run `npm run store-assets` to load that ZIP in a temporary browser profile and capture store screenshots, a promotional tile, and the current icon. The browser override `EXTENSION_BROWSER_PATH` also applies here. Packaging requires Python 3; asset capture also requires `unzip` and Playwright's Chrome for Testing.

See [0.2.0 release notes](docs/RELEASE-0.2.0.md), [store dashboard notes](docs/store/dashboard-notes.txt), and [privacy details](PRIVACY.md). The extension package contains no development dependencies, test fixtures, original image sources, or store marketing files.
