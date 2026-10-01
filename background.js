import { copyText } from './lib/clipboard.js';
import { openSelection } from './lib/actions.js';
import { setTabError } from './lib/errors.js';

import { registerAiHandoff, handleAiHandoff, clearAiHandoff } from './lib/ai-handoff.js';

const navigations = new Map();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (request?.type === 'page-startup-error') {
    if (sender.id !== chrome.runtime.id || !Number.isInteger(tabId) || sender.frameId !== 0 || !sender.documentId) return;
    if (!navigations.has(tabId)) navigations.set(tabId, {});
    const navigation = navigations.get(tabId);
    chrome.tabs.sendMessage(tabId, { type: 'page-status' }, { documentId: sender.documentId }).then(async live => {
      if (live?.ready === false && navigations.get(tabId) === navigation) {
        await setTabError(chrome, tabId, 'Could not load extension files. Reload the extension and refresh this page.');
      }
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (['ai-claim', 'ai-prepare', 'ai-finish'].includes(request?.type)) {
    handleAiHandoff(chrome, request, sender).then(async result => {
      // Successful handoffs must preserve clipboard warnings or later page errors.
      if (Number.isInteger(result.sourceTabId) && result.error) {
        try {
          await chrome.tabs.get(result.sourceTabId);
          const live = result.sourceDocumentId ? await chrome.tabs.sendMessage(result.sourceTabId, { type: 'page-status' }, { documentId: result.sourceDocumentId }) : { ready: true };
          if (live?.ready) await setTabError(chrome, result.sourceTabId, result.error);
        } catch { /* The original page closed or navigated away. */ }
      }
      sendResponse({ ok: result.ok, waiting: result.waiting, autoSend: result.autoSend });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
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
  openSelection(chrome, request, sender, copyText, registerAiHandoff)
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
  void clearAiHandoff(chrome, tabId).catch(() => {});
  void setTabError(chrome, tabId);
});
