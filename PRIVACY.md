# Privacy

Middle Click to Search does not collect data for its developer, use analytics or advertising, or contact an extension-operated server. No account is required.

When you select text and middle-click, the extension opens a search using your configured search engine. That engine receives the selected text as part of the search URL and applies its own privacy policy. Selected web addresses can open directly instead. Ordinary middle-clicked links can use your chosen tab-focus preference.

If you enable copy-on-search, selected text is written to your clipboard when you search. This is off by default. The extension does not read your clipboard. Temporary text in the hidden clipboard document is cleared after the write.

Preferences, including search URLs and site rules, are stored using Chrome sync storage. Chrome may synchronize them through your browser account according to your browser settings and Google's policies. Short error diagnostics are kept in browser session storage; the extension does not intentionally include selected text or destination URLs in them. Diagnostics are cleared on navigation, dismissal, or successful retry.

The extension reads selected text to perform the gesture and checks the current site's address to apply site controls. It does not maintain browsing or search history. Password fields are ignored. All extension code is bundled locally; no remote code is executed.

Source and support: https://github.com/DovieW/middle-click-search
