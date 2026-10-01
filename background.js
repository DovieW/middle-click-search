import { openSelection } from './lib/actions.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== 'search-selection') return;
  openSelection(chrome, request, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true; // Keep the channel alive through storage and tab creation.
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
