# Privacy

Middle Click to Search does not collect data for its developer, use analytics or advertising, or contact an extension-operated server. The extension does not require an account; your selected search or AI provider may require one.

When you select text and middle-click, the extension opens a search using your configured search engine. That engine receives the selected text as part of the search URL and applies its own privacy policy. Selected web addresses can open directly instead. Ordinary middle-clicked links can use your chosen tab-focus preference.

If you select ChatGPT, Gemini, Claude, Perplexity, or Custom AI instead of a search engine, the extension opens that website with your prompt template and selected text encoded in the navigation URL. It includes the source page URL when **Include page URL** is enabled (on by default). For Custom AI, the full expanded prompt is encoded into the configured URL in place of `%s`; the configured website receives it. The selected provider receives this information and applies its own privacy policy. Perplexity submits the query immediately through its native URL integration. Claude opens a draft for manual submission. Gemini draft filling is experimental and only applies to an empty editor in a tab opened and authorized by this extension.

**Send automatically (experimental)** is off by default. For ChatGPT and Gemini, enabling it lets the extension click Send once in the tab it opened, after matching the prepared prompt. Editing or sending manually cancels automation. Short-lived session records contain a prompt fingerprint and tab authorization metadata, not prompt text, and are removed on completion or tab closure. The extension does not use provider API keys, manage provider accounts, or retain conversations.

If you enable copy-on-search, selected text is written to your clipboard when you search. This is off by default. The extension does not read your clipboard. Temporary text in the hidden clipboard document is cleared after the write.

Preferences, including search URLs, AI prompt instructions, the URL-inclusion preference, and site rules, are stored using Chrome sync storage. Chrome may synchronize them through your browser account according to your browser settings and Google's policies. Short error diagnostics are kept in browser session storage; the extension does not intentionally include selected text or destination URLs in them. Diagnostics are cleared on navigation, dismissal, or successful retry.

The extension reads selected text to perform the gesture and checks the current site's address to apply site controls. It does not maintain browsing or search history. Password fields are ignored. All extension code is bundled locally; no remote code is executed.

Source and support: https://github.com/DovieW/middle-click-search
