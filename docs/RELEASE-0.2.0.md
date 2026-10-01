# Middle Click to Search 0.2.0

A simpler settings page, a new icon, and more control over middle-click behavior.

- Toolbar popup with global/current-site controls, search-engine selection, and page readiness.
- Independent foreground/background options for searches and ordinary links, with Ctrl/Command reversal.
- Site allow/block lists, wildcard rules, and exact-host exceptions.
- Optional copy-on-search, with clipboard failure feedback that does not block searching.
- Presets and custom search URLs, live preview, and a prominent save bar for unsaved changes.
- Red per-tab failure badges and dismissible diagnostics; no success badges.
- More reliable URL routing, source-tab placement, frame/input selection handling, worker restart behavior, and browser API error handling.
- Existing preferences preserved, with legacy domain-setting migration when settings opens.

Requires Chrome 116 or newer. Refresh existing webpages after installing/updating. Browser-protected pages cannot support the gesture. Firefox is not supported by this package.

Validation: 66 unit tests, 59 real-extension browser tests, syntax checks, and package validation. Automated testing uses Linux Chrome for Testing; physical input and other operating systems remain manual acceptance checks.

## Downloads

- `middle-click-search-0.2.0.zip`: Chrome Web Store upload package, or extract to load unpacked for development.
- `chrome-web-store-assets-0.2.0.zip`: updated store icon, screenshots, promotional tile, description, and dashboard notes. This is not the extension upload package.
- `SHA256SUMS.txt`: SHA-256 checksums for both archives.

Privacy details are in [PRIVACY.md](https://github.com/DovieW/middle-click-search/blob/v0.2.0/PRIVACY.md). Selections are sent to your chosen search destination; optional copying writes to your own clipboard. No analytics or extension-operated backend is used.
