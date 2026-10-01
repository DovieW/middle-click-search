const key = tabId => `tab-error-${tabId}`;
export async function getTabError(api, tabId) {
  if (!Number.isInteger(tabId)) return '';
  return (await api.storage.session.get(key(tabId)))[key(tabId)] || '';
}
const updates = new Map();
export function setTabError(api, tabId, message = '') {
  if (!Number.isInteger(tabId)) return Promise.resolve();
  // Serialize each tab's storage/badge updates so a late write cannot undo a clear.
  const previous = updates.get(tabId) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const text = String(message).replace(/https?:\/\/\S+/gi, '[URL]').slice(0, 300);
    await Promise.allSettled([
      Promise.resolve().then(() => text ? api.storage.session.set({ [key(tabId)]: text }) : api.storage.session.remove(key(tabId))),
      Promise.resolve().then(() => api.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' })),
      Promise.resolve().then(() => api.action.setBadgeTextColor({ tabId, color: '#ffffff' })),
      Promise.resolve().then(() => api.action.setBadgeText({ tabId, text: text ? '!' : '' })),
    ]);
  });
  updates.set(tabId, next);
  void next.finally(() => { if (updates.get(tabId) === next) updates.delete(tabId); });
  return next;
}
