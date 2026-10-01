# Middle Click to Search 0.2.1

Search selected text or send it as context to your preferred AI assistant.

- ChatGPT, Gemini, Claude, and Perplexity in the Search engine / AI picker, in settings and the popup.
- Editable AI prompt templates with movable `{text}` and `{url}` placeholders. Page URL inclusion is optional and on by default; the default line is `From Page: {url}`.
- Separate Custom search and Custom AI URL settings. `%s` inserts the selection for search, or the complete encoded prompt for AI.
- Optional **Send automatically (experimental)** for ChatGPT and Gemini, off by default. Authorized handoffs preserve edits and existing drafts and never retry submission.
- Claude opens a draft for manual sending. Perplexity submits through its website URL. Custom websites control their own submission behavior.
- Clear popup status and a red failure badge when page startup fails, with a build check for missing content-script module declarations.
- Successful AI handoffs preserve clipboard failure warnings.

Search-engine defaults and existing preferences are preserved. No new permissions, dependencies, or API keys are required. Refresh open webpages after updating.

Validation: 90 unit tests, all 82 real-extension browser tests, syntax/manifest dependency checks, and runtime package validation passed. Gemini and Claude were verified live by the user on October 1, 2026. Website automation remains experimental because provider interfaces may change; ChatGPT automatic sending is covered by matching composer fixtures.

## Downloads

- `middle-click-search-0.2.1.zip`: upload this package to the existing Chrome Web Store item, or extract it to load unpacked.
- `chrome-web-store-assets-0.2.1.zip`: store screenshots, the unchanged icon, promotional tile, description, and dashboard notes. This is not the extension upload package.
- `SHA256SUMS.txt`: SHA-256 checksums for both archives.

The GitHub release is published from `master`. It does not automatically update the Chrome Web Store.

[Privacy details](https://github.com/DovieW/middle-click-search/blob/v0.2.1/PRIVACY.md). Selected text, the AI prompt, and the optional source URL go to the chosen destination in a navigation URL. No analytics or extension-operated backend is used.
