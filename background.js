import { copyText } from './lib/clipboard.js';
import { openSelection } from './lib/actions.js';
import { setTabError } from './lib/errors.js';

const navigations = new Map();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (request?.type === 'dismiss-error') {
    // Only an extension page can dismiss the diagnostic for a chosen tab.
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || !Number.isInteger(request.tabId)) return;
    setTabError(chrome, request.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (!['search-selection', 'open-link'].includes(request?.type)) return;
  if (!Number.isInteger(tabId)) return;
  if (!navigations.has(tabId)) navigations.set(tabId, {});
  const navigation = navigations.get(tabId);
  openSelection(chrome, request, sender, copyText)
    .catch(error => ({ ok: false, error: error?.message || 'Could not open a tab.' }))
    .then(async response => {
      // A late response from an old page must not mark the page navigated to.
      if (navigations.get(tabId) === navigation) {
        await setTabError(chrome, tabId, response.error || response.warning || '');
      }
      sendResponse(response);
    });
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  navigations.set(tabId, {});
  void setTabError(chrome, tabId);
});
chrome.tabs.onRemoved.addListener(tabId => {
  navigations.delete(tabId);
  void setTabError(chrome, tabId);
});
