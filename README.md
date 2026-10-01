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

Settings are grouped into Search / AI, Tabs, and Sites. Custom URLs, previews, and site overrides appear only when relevant; additional mouse options are expandable.

You can switch to new tabs or keep them in the background, always search even if text resembles a URL, retain the highlight, and control wheel scrolling during a search. Results open immediately after the originating tab in the same window. Existing search-engine and focus preferences carry forward; the old domain-checking preference migrates when you open settings.

### AI assistants

Choose **ChatGPT**, **Gemini**, **Claude**, **Perplexity**, or **Custom AI** under **Search engine / AI** in settings or the popup. Selected text becomes AI context, including text that looks like a web address. The **AI prompt** is an editable template: place `{text}` and `{url}` wherever you want the selection and page URL. `{text}` is required; `{url}` is optional. **Include page URL** is on by default and can be turned off. The source URL comes from the frame containing the selection, falling back to the page URL for related blank frames. Embedded URL credentials are removed.

The default prompt is:

```text
Explain and let's discuss this.

Context:
{text}
From Page: {url}
```

Turn off **Include page URL** to leave `{url}` blank; a URL-only line is removed. Previously saved instruction-only prompts are converted to templates automatically. Click **Save changes** to apply edits. Switching back to a search engine keeps your AI preferences. Ordinary links keep their separate focus behavior; copy-on-search copies the selection itself.

All AI destinations share the same template and URL-inclusion preference. Provider behavior is explicit:

| Provider | Handoff | Submission |
| --- | --- | --- |
| ChatGPT | `https://chatgpt.com/?q=…` fills a draft | Optional **Send automatically (experimental)** |
| Gemini | `https://gemini.google.com/app?q=…`, with an authorized draft-filling fallback | Optional **Send automatically (experimental)** |
| Claude | `https://claude.ai/new?q=…` fills a draft | Review and send in Claude |
| Perplexity | `https://www.perplexity.ai/search?q=…` | The website sends immediately; the settings page states this |

The Gemini URL matches [Chromium's built-in Gemini shortcut](https://github.com/chromium/chromium/blob/main/components/search_engines/template_url_starter_pack_data.cc), described in [Google's help](https://support.google.com/gemini/answer/14886647). During a live check this account's editor ignored the query, so the extension fills an empty draft as a fallback. It only fills tabs it opened with a short-lived authorization, never arbitrary Gemini links or existing user drafts. Draft filling is also labeled experimental. Perplexity's native URL submission was verified live; The user verified Gemini and Claude on October 1, 2026. Claude's `q` prefill behavior is described in the original [Oasis research](https://pages.oasis.security/rs/106-PZV-596/images/claudyday-vulnerability.pdf?version=0). These are website integrations rather than provider API contracts.

**Send automatically (experimental)** is off by default. When enabled for ChatGPT or Gemini, the extension waits for the matching prompt and enabled send button and makes one authorized click. Editing or sending manually cancels automation. Manually opened tabs never trigger extension submission or draft filling. A failure badge appears on the original page if the handoff cannot be confirmed within 45 seconds; submission is never retried. Prompt fingerprints and tab authorization metadata are kept briefly in session storage; full prompt text is not stored there.

The live ChatGPT and Gemini editor markup was inspected. Local fixtures cover delayed readiness, draft filling, exactly-once sending, existing drafts, and cancellation. The user verified Gemini and Claude live; ChatGPT automatic sending remains experimental and is tested against matching composer fixtures. The extension does not use provider APIs, require API keys, or select a model. The provider controls sign-in and response generation. Very long links are rejected (8,000-character extension limit) rather than truncating the prompt or context.

Selecting an AI provider sends the instruction, highlighted text, and optional source URL to that provider in the navigation URL. Its privacy policy applies. Search engines remain the default for existing installations. No extension permissions are added.

### Custom destinations

**Custom search** uses `%s` for the encoded selection. **Custom AI** has a separate **AI URL** using `%s` for the entire encoded prompt after `{text}` and `{url}` expansion, for example `https://example.com/chat?prompt=%s`. Both support HTTP(S) URLs with a fixed host; credentials, unsafe schemes, and placeholders in the host are rejected. Each `%s` is replaced, including placeholders in the path or fragment. Custom AI must be configured before use and fails safely if its URL is missing or invalid.

Custom AI shares the prompt template and URL-inclusion preference with built-in providers. Switching destinations preserves its saved URL and the search URL. It opens a website URL, not an authenticated API request; prompt handling and submission depend on that website. Extension auto-send and draft filling are not applied to arbitrary custom destinations.

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

See [0.2.1 release notes](docs/RELEASE-0.2.1.md), [store dashboard notes](docs/store/dashboard-notes.txt), and [privacy details](PRIVACY.md). The extension package contains no development dependencies, test fixtures, original image sources, or store marketing files.
