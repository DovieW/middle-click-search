# Project evaluation and redesign

Evaluated the full tracked project at baseline `f0b1148`, then implemented the reliability work below. The product is a browser gesture: select text and middle-click to search or open a website. Its value depends on predictable behavior across pages, settings, and the Manifest V3 worker lifecycle.

The recommended direction is to establish a dependable gesture and shared search infrastructure, then build richer features on that foundation. Project size is not a constraint; complexity should have a demonstrated purpose. A complete framework rewrite would not fix the underlying event, storage, and lifecycle defects by itself.

## Baseline findings

| Area | Finding | Consequence | Resolution |
| --- | --- | --- | --- |
| Direct URLs | The `processedUrl` branch never called `createTabNextToActive` | URL/domain selections silently did nothing | Shared routing and tab-opening path |
| Settings | `disableDomainCheck` was stored in options-page localStorage; the worker tried to read `window` | Preference could never affect the worker | All preferences in sync storage; migrate the legacy key when settings opens |
| Tab placement | Looked up the active tab after asynchronous storage reads | A focus/window change could place the result beside another tab | Use the originating tab ID, then read its current window and index |
| URL handling | Accepted arbitrary schemes and rejected useful paths, Unicode, and long domain suffixes | Inconsistent destinations and unsafe URL types | HTTP(S) routing, URL normalization, credentials rejected, explicit always-search preference |
| Native links | Checked only the clicked node and its parent; parent access could throw | Deep links could trigger duplicate tabs or broken searches | Follow the composed event path, including shadow DOM |
| Selection | Cleared text before tab creation completed | Silent failures destroyed the user's selection | Clear only on successful acknowledgment and only if the selection is unchanged |
| Editing controls | Relied exclusively on `window.getSelection()` | Text fields were unsupported | Read selection ranges from supported inputs and textareas; ignore password fields |
| Frames | Content script ran only in the top-level page | Selections in frames could not search | Inject into matching frames and related about:blank/srcdoc frames |
| Browser gesture | Autoscroll option existed only in commented code | A search could also start unwanted scrolling | Configurable synchronous cancellation with live storage updates |
| Failure handling | No response channel or error feedback | Failed operations looked like ignored clicks | Typed messages, validation, browser API error propagation, accessible page notification |
| Options UI | Minimal markup, no URL validation or save feedback | Misconfiguration silently searched an error string | Accessible settings form, presets, preview, validation, explicit save/reset |
| Development | No automated tests, package scripts, CI, or setup documentation | No reliable way to assess regressions | Node unit tests, real-extension browser tests, frozen dependency lockfile, CI |
| Assets | Runtime icons are present; `Assets/` holds source/marketing images | No runtime dependency issue | Retained existing assets and license |
| Privacy | No account, analytics, or backend | Good foundation | Retained; only preferences persist, not selected text/history |

Baseline local browser smoke checks passed for ordinary text search and the options page. The URL no-op defect was reproduced with the original background script; the storage mismatch was confirmed by inspecting both contexts. Other findings above follow directly from the source, with replacement behavior covered in the regression suite.

## Architecture

- `get_text.js`: captures trusted gestures, protects links/editors, reads selections, and handles acknowledgment/errors. It does not decide where to search.
- `background.js`: receives typed internal messages and keeps the asynchronous response channel alive.
- `lib/actions.js`: validates the sender, reads authoritative preferences, resolves the destination, and opens a tab next to the origin.
- `lib/routing.js`: browser-independent selection and destination logic.
- `lib/settings.js`: defaults, engine presets, validation, and normalization used by the worker and options page.
- `options.html`, `options.css`, `options.js`: configuration and legacy preference migration.

No selection data is persisted. Each action rereads settings, so worker suspension cannot leave the search engine or focus preference stale. Content scripts cache only the synchronous autoscroll decision and receive updates through `storage.onChanged`. In-flight duplicate clicks on a frame are ignored until acknowledgment; automatic retries are deliberately avoided because an acknowledgment can fail after a tab has already opened.

## Product directions

| Direction | Benefit | Cost / decision |
| --- | --- | --- |
| Reliability first (implemented) | Makes the existing interaction dependable and creates shared routing/settings infrastructure | Requires regression coverage and honest platform limits |
| Multiple engines per gesture | Fast research across different destinations | Needs a clear gesture/menu design and conflict rules before implementation |
| Keyboard and context-menu actions | Makes the same capability available without a middle button | Requires UX choices and additional manifest capabilities |
| Per-site controls | Lets users resolve conflicts with specialized web apps | Needs a hostname/rule model and UI for exclusions |
| Firefox support | Broadens reach | Requires a Firefox-specific background manifest and actual Firefox tests; not just renaming `chrome` |

The next feature should follow the user's workflow, rather than adding several new gestures or a large popup without a clear need.

## Practical limits and remaining validation

- Automated browser tests run in Linux Chrome for Testing. Physical middle-button behavior, Windows autoscroll, macOS devices, Chrome stable, Edge/Brave policies, and screen-reader experience require manual release validation.
- Browser-internal pages, the Chrome Web Store, and built-in PDF viewers restrict content scripts. File URLs are outside the manifest's match patterns. A browser extension cannot override these restrictions.
- Domain recognition is syntactic. `report.pdf` can be a filename or a hostname; automatic routing cannot infer intent reliably. “Always search selected text” resolves ambiguity. No DNS probes or external classification service are used.
- Closed shadow roots and webpages that suppress mouse events can limit access to selections. Rich editors may implement selection independently of native DOM selection.
- Opening a tab successfully does not guarantee the destination server will load or accept a very long query.
- Legacy `disableDomainCheck` migrates when the settings page is first opened. A worker cannot read the previous options page's localStorage.
- Settings synchronization and incognito availability depend on browser/account policy. Errors are reported; no account or credentials are required by the extension.

## Release gate

Run syntax checks, unit tests, and the real-extension browser suite. Manually verify wheel gestures on target operating systems, native links, restricted-page behavior, screen-reader feedback, upgrades from 0.1.6, and the browser's extension warnings. Review the resulting package before store publication. No store submission or publication is part of this change.

## Original overhaul verification

On the completed implementation, `npm ci` succeeded with the frozen lockfile, `npm run check` passed, all **48 unit tests** passed, and all **33 real-extension browser tests** passed in Linux Chrome for Testing 145.0.7632.6. No tests were skipped. The settings page was also rendered and visually inspected at desktop size; mobile overflow is covered by the browser suite. CI was added but has not been run on GitHub in this task.

The browser suite covers direct URLs and search-only routing, custom/preset settings, all focus/modifier combinations, origin-relative placement, nested and shadow links, inputs and textareas, password/synthetic-event exclusions, ordinary/cross-origin/srcdoc frames, worker stop/restart, in-flight duplicate suppression, changed selections, oversized-selection recovery, browser API errors, legacy migration, save failure/retry, reset, and mobile layout.


## 0.2.0 settings expansion

The options page now uses plain HTML/CSS/JavaScript with compact Search, Tabs, and Sites sections, expandable advanced controls, and inline save feedback. The theme is neutral and decorative/introductory text has been removed. A compact toolbar popup offers global and current-site toggles, engine selection, and the full settings link.

Issue #15 is covered by independent browser/foreground/background link focus controls, including modifier reversal. Issue #12 is covered by exact/wildcard host allow/block lists and explicit current-host exceptions. Issue #8 is covered by opt-in clipboard copying; clipboard errors warn without canceling the tab. Top-level site rules apply to every frame. Defaults preserve browser link behavior, disable copying, and allow all sites.

An offscreen document handles clipboard writes and clears temporary text. Added permissions are activeTab, clipboardWrite, and offscreen; no clipboard-read permission is requested. The minimum Chrome version is 116. Physical mouse/touchpad behavior and macOS/Edge/Arc acceptance remain manual release checks. These additions do not claim to fix every site-specific selection issue.

Expansion verification: syntax and whitespace checks passed, all 58 unit tests passed, and all 48 browser cases passed across the full suite and targeted reruns. Real clipboard writes were checked for foreground/background searches, along with clipboard-failure feedback, cross-origin site policies, native link focus/modifiers, popup controls, and concurrent options/popup edits. Light/dark desktop and mobile options screenshots and the compact popup were visually inspected. Browser testing used the locally cached Chrome for Testing binary through EXTENSION_BROWSER_PATH.


## Page readiness and failure feedback

The popup probes the top-level frame for a live, current-version readiness response registered after gesture listeners. It distinguishes global/site disable, known restricted pages, and an inactive page, with a user-triggered refresh action. Missing receivers are simulated in the browser test; refresh recovery uses the actual page and content script. A full extension-reload lifecycle test could not be exercised with the automated browser's worker discovery and remains a manual acceptance check.

Failures and clipboard warnings produce a red per-tab ! badge and a dismissible popup diagnostic. No success badge is used. Successful retry or navigation clears failure state. Diagnostics are held only in browser session storage, not sync storage; selected text and destinations are never added to the diagnostic record. Late responses after navigation do not set a new badge on the next page.


## Final reliability review

The final review added guards for source-document disappearance before clipboard work and immediately before tab creation, bounded ordinary-link requests, and fixed clipboard initialization shared by simultaneous requests. Each tab's diagnostic writes are now serialized, with navigation identity tokens preventing late replies from marking a replaced or closed tab.

Content scripts subscribe before their initial settings read and fail closed if that read fails. The popup reports that initialization failure, follows navigation and live preference changes, and clean options forms follow changes from elsewhere. Saving no longer depends on a read after the write has already committed. Native-link overrides run after document-level cancellation handlers, and synchronous messaging errors are caught.

Remaining constraints: source validation and tab creation are separate browser API operations, so navigation can still happen between them. Sync storage has no atomic read-modify-write operation: simultaneous edits to the site-exception map in multiple settings windows can still conflict, although ordinary sequential edits and unrelated preference changes are preserved. Capturing selected text before page handlers run remains necessary on pages that clear their selection on mousedown; site exclusions handle pages with incompatible gestures. Physical mouse/touchpad behavior and a real extension upgrade/reload remain manual release checks.

Review verification: all 66 unit tests passed. All 59 browser cases passed across the full suite and targeted reruns; the new cross-origin popup navigation regression initially exposed omitted tab URLs and passed after the readiness-message fix. Syntax and whitespace checks passed. No checks were skipped. This does not replace the manual release checks above.


## ChatGPT context destination

The shared **Search engine / AI** picker now supports ChatGPT in both settings and the popup. Search-engine defaults and stored custom URLs are preserved. AI mode expands a configurable template with `{text}` and optional `{url}` placeholders, allowing context and URL placement anywhere in the prompt. Earlier instruction-only preferences convert to equivalent templates. URL inclusion defaults to on; normal middle-clicked links continue using their separate focus settings. The options page validates the required `{text}` placeholder and shows the editable template directly, without a prompt preview. No permissions or API credentials are added.

AI prompt instructions are bounded for sync storage, and encoded handoff URLs have an 8,000-character extension limit. Oversized context produces an error before copying or opening a tab; content is never silently truncated. Only HTTP(S) source URLs are included, with embedded credentials removed. Privacy documentation describes sending the selection and optional URL to the chosen AI provider.

The implementation opens `https://chatgpt.com/?q=<encoded prompt>`. Official documentation searched did not establish a supported web-prompt link contract, and live automated verification encountered ChatGPT's browser-verification challenge. This is a website integration whose final prompt handling still needs signed-in browser acceptance. Automated integration tests intercept the ChatGPT destination to verify the real extension's generated prompt, persistence, live URL opt-out, normal-link behavior, and clipboard semantics without submitting test content to the provider.


**Send automatically** is opt-in. The ignored `submit=true` parameter has been removed. Auto-send tabs carry an unguessable marker; the worker registers a short-lived session ticket with a prompt fingerprint and source-document metadata. A ChatGPT-only content script waits for the matching composer and enabled send button, claims authorization once, clicks once, and checks for composer clearing or generation state. Manual edits or submission cancel automation. No ticket means no sending. Expired tickets, different tabs, origins, frames, nonces, and prompt fingerprints cannot claim authorization. Failure to confirm submission produces a diagnostic on the still-live source document; there is no automatic retry.

The actual signed-in ChatGPT page was inspected read-only: its editor uses `role="textbox"`, `aria-label="Ask ChatGPT"`, and additional paragraph line breaks; its button uses `aria-label="Send"` inside `form[data-chatgpt-composer]`. These selectors and paragraph normalization are supported alongside the older layout. Integration fixtures exercise both layouts. Full live submission after extension reload remains a manual acceptance check.

The default template now ends with `From Page: {url}`. Existing exact defaults and legacy instruction-only preferences upgrade to this format; other custom templates are preserved. When URL inclusion is off, the entire default page line is omitted.


## Additional AI providers and experimental behavior

The picker supports ChatGPT, Gemini, Claude, and Perplexity through one provider registry and shared prompt builder. The existing ChatGPT URL handoff is retained. Experimental auto-send is off by default and only shown for ChatGPT and Gemini. Claude uses native draft prefilling and manual submission; Perplexity uses native URL submission, with that behavior stated in settings.

Chromium's Gemini shortcut uses `/app?q=…`, but that URL left the signed-in editor empty in a live check. Gemini therefore has a scoped draft-filling fallback in the same small content-script controller used for ChatGPT submission. It needs a matching provider, tab, nonce, and prompt fingerprint before filling an empty editor. Preparation and submission are authorized separately. Existing drafts, edits, and unregistered URLs are preserved. No new permissions or dependencies are introduced. Real Gemini submission and signed-in Claude prefilling remain manual acceptance checks.

Provider verification: 88 unit tests passed; the full 78-case browser suite and the additional clipboard-warning regression passed (79 distinct browser cases). Syntax/whitespace checks and runtime packaging in an isolated temporary directory passed. The provider registry is included in web-accessible resources so content-script settings imports work. Gemini multiline filling uses text-only paragraphs rather than HTML parsing. Successful handoffs preserve earlier clipboard warnings and later page errors. Signed-in live Gemini sending and Claude prefilling remain unverified; no release was published during this change.

Content-script startup now catches module import failures before registering gestures. An unavailable dependency reports a refreshable popup status and a source-tab failure badge; invalidated extension contexts exit quietly. The static check follows content-script module imports and rejects any transitive dependency missing from web-accessible resources. A browser regression with an intentionally blocked provider module reproduced the settings import failure and verified no unhandled rejection, no gestures, and the popup/badge diagnostic. All 88 unit tests and the eight startup/status browser tests passed; the static guard also rejected a deliberately incomplete manifest in an isolated copy.


## Custom AI destination

The picker distinguishes Custom search from Custom AI. Custom AI stores a separate validated URL template using `%s` for the complete encoded prompt, while Custom search continues using the encoded selection. Custom AI preserves fixed-host HTTP(S) validation, required placeholders, credential rejection, prompt length limits, and literal context tokens. Missing or invalid custom URLs fail before clipboard work or opening a tab. Arbitrary custom sites receive no extension DOM automation; the website controls submission. The options page only validates the URL when Custom AI is selected, so an unfinished draft cannot block other destinations.

Custom-destination verification: 90 unit tests, ten options/custom-AI browser cases, and nineteen existing AI browser cases passed. The unchanged 45-second timeout case was excluded from this targeted AI rerun; it passed in the previous full suite. The two custom-AI cases also passed after adding preservation of a previously saved URL when an invalid draft is abandoned. Syntax and manifest dependency checks passed. Custom search and custom AI remained independent across popup switching and reloads; both final destinations were exercised against a local HTTP fixture.


## 0.2.1 release acceptance

The user verified Gemini and Claude live on October 1, 2026 and selected 0.2.1 as the release following 0.2.0. This supersedes the earlier Gemini/Claude acceptance gaps recorded above. Experimental labels and opt-in automatic sending remain. Final readiness checks passed all 90 unit tests and all 82 browser tests; isolated runtime packaging also passed. No new permissions or dependencies are introduced. The release includes updated store copy and AI settings screenshots and is published from master.
