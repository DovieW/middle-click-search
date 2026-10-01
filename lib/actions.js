import { normalizeSettings } from './settings.js';
import { normalizeSelection, resolveTarget } from './routing.js';

export async function openSelection(api, request, sender) {
  if (sender.id !== api.runtime.id || !Number.isInteger(sender.tab?.id)) {
    throw new Error('Search must come from a browser tab.');
  }
  const text = normalizeSelection(request.text);
  const settings = normalizeSettings(await api.storage.sync.get(null));
  const target = resolveTarget(text, settings);
  // The originating tab may move during the storage read.
  const source = await api.tabs.get(sender.tab.id);
  const tab = await api.tabs.create({
    url: target.url,
    index: source.index + 1,
    windowId: source.windowId,
    openerTabId: source.id,
    active: settings.newTabActive !== (request.invertFocus === true),
  });
  return { ok: true, tabId: tab.id, clearSelection: settings.clearSelection };
}
