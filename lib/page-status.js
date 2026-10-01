import { siteEnabled, siteHost } from './sites.js';

export async function getPageStatus(api, tab, settings) {
  if (!settings.enabled) return { state: 'off', text: 'Extension is off.' };
  const host = siteHost(tab?.url || '');
  if (!host || host === 'chromewebstore.google.com' ||
      host === 'chrome.google.com' && new URL(tab.url).pathname.startsWith('/webstore')) return { state: 'unavailable', text: 'Unavailable on this page.' };
  if (!siteEnabled(tab.url, settings)) return { state: 'disabled', text: 'Disabled on this site.' };
  try {
    const response = await api.tabs.sendMessage(tab.id, { type: 'page-status' }, { frameId: 0 });
    if (response?.ready && response.version === api.runtime.getManifest().version) {
      return { state: 'ready', text: '' };
    }
    if (response?.error) return { state: 'refresh', text: typeof response.error === 'string' ? response.error.slice(0, 300) : 'Could not load preferences. Try refreshing.', refresh: true };
  } catch {}
  return { state: 'refresh', text: 'Not active. Try refreshing.', refresh: true };
}
