import { aiProvider } from './ai-providers.js';
import { normalizeSettings } from './settings.js';
import { siteEnabled } from './sites.js';
import { normalizeSelection, resolveTarget, webUrl, MAX_SELECTION_LENGTH } from './routing.js';

export async function openSelection(api, request, sender, copyText, registerAiHandoff) {
  if (sender.id !== api.runtime.id || !Number.isInteger(sender.tab?.id)) {
    throw new Error('Search must come from a browser tab.');
  }
  if (request.type === 'open-link' && (typeof request.url !== 'string' || request.url.length > MAX_SELECTION_LENGTH)) {
    throw new Error('This link is too long to open.');
  }
  const settings = normalizeSettings(await api.storage.sync.get(null));
  const sourceUrl = sender.tab.url || sender.url;
  if ((sourceUrl && !siteEnabled(sourceUrl, settings)) || settings.enabled === false) {
    throw new Error('Middle Click to Search is disabled on this site.');
  }
  const isLink = request.type === 'open-link';
  const text = isLink ? null : normalizeSelection(request.text);
  const target = isLink ? { url: webUrl(request.url) } : resolveTarget(text, settings, /^https?:\/\//i.test(sender.url || '') ? sender.url : sender.tab.url);
  if (isLink && (settings.linkFocus === 'browser' || !/^https?:\/\//i.test(request.url) || !target.url)) {
    throw new Error('This link should use the browser’s normal behavior.');
  }
  // Verify the original frame still exists before touching the clipboard or opening a tab.
  async function checkDocument() {
    if (!sender.documentId) return;
    const reply = await api.tabs.sendMessage(sender.tab.id, { type: 'page-status' }, { documentId: sender.documentId });
    if (!reply?.ready) throw new Error('The source page is no longer available.');
  }
  await api.tabs.get(sender.tab.id);
  await checkDocument();
  let warning;
  if (!isLink && settings.copyOnSearch) {
    try { await copyText(text); } catch { warning = 'The tab opened, but copying to the clipboard failed.'; }
  }
  // The originating tab may move during the storage read.
  const source = await api.tabs.get(sender.tab.id);
  await checkDocument();
  const provider = aiProvider(target.provider);
  const autoSend = provider?.send === 'experimental' && settings.aiAutoSend;
  const handoff = autoSend || provider?.id === 'gemini';
  const nonce = handoff ? crypto.randomUUID() : '';
  const tab = await api.tabs.create({
    url: nonce ? `${target.url}#mcs-auto-send=${nonce}` : target.url,
    index: source.index + 1,
    windowId: source.windowId,
    openerTabId: source.id,
    active: (isLink ? settings.linkFocus === 'foreground' : settings.newTabActive) !== (request.invertFocus === true),
  });
  if (handoff) {
    try {
      if (!registerAiHandoff) throw new Error('Missing handoff handler');
      await registerAiHandoff(api, tab.id, nonce, new URL(target.url).searchParams.get('q'), sender.tab.id, sender.documentId, provider.id, autoSend);
    } catch { warning = `${provider.name} opened, but the prompt handoff could not start. Enter or send the prompt manually.`; }
  }
  return { ok: true, tabId: tab.id, clearSelection: !isLink && settings.clearSelection, ...(warning ? { warning } : {}) };
}
