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

## Verified result

On the completed implementation, `npm ci` succeeded with the frozen lockfile, `npm run check` passed, all **48 unit tests** passed, and all **33 real-extension browser tests** passed in Linux Chrome for Testing 145.0.7632.6. No tests were skipped. The settings page was also rendered and visually inspected at desktop size; mobile overflow is covered by the browser suite. CI was added but has not been run on GitHub in this task.

The browser suite covers direct URLs and search-only routing, custom/preset settings, all focus/modifier combinations, origin-relative placement, nested and shadow links, inputs and textareas, password/synthetic-event exclusions, ordinary/cross-origin/srcdoc frames, worker stop/restart, in-flight duplicate suppression, changed selections, oversized-selection recovery, browser API errors, legacy migration, save failure/retry, reset, and mobile layout.
