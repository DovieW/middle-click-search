import { aiProvider } from './ai-providers.js';
import { normalizeSettings } from './settings.js';

// Short-lived, per-tab authorization. Never persist the selected text or full prompt.
const key = tabId => `ai-handoff-${tabId}`;
const locks = new Set();
export async function promptHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function registerAiHandoff(api, tabId, nonce, prompt, sourceTabId, sourceDocumentId, provider = 'chatgpt', autoSend = true) {
  await api.storage.session.set({ [key(tabId)]: {
    nonce, provider, autoSend, prepared: false, promptHash: await promptHash(prompt), sourceTabId, sourceDocumentId, expires: Date.now() + 90_000, claimed: false,
  } });
}
export async function handleAiHandoff(api, request, sender) {
  if (sender.id !== api.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0) return { ok: false };
  let url;
  try { url = new URL(sender.url); } catch { return { ok: false }; }
  const tabId = sender.tab.id;
  if (locks.has(tabId)) return { ok: false };
  locks.add(tabId);
  try {
    const entry = (await api.storage.session.get(key(tabId)))[key(tabId)];
    if (!entry) return { ok: false, waiting: true };
    if (entry.expires < Date.now()) {
      await api.storage.session.remove(key(tabId)); return { ok: false };
    }
    const provider = aiProvider(entry.provider);
    if (!provider || url.origin !== new URL(provider.url).origin || request.nonce !== entry.nonce) return { ok: false };
    if (['ai-claim', 'ai-prepare'].includes(request.type)) {
      const settings = normalizeSettings(await api.storage.sync.get(null));
      if (!settings.enabled || url.pathname !== new URL(provider.url).pathname || request.promptHash !== entry.promptHash) return { ok: false };
      if (request.type === 'ai-prepare') {
        if (entry.provider !== 'gemini' || entry.prepared || entry.claimed) return { ok: false };
        await api.storage.session.set({ [key(tabId)]: { ...entry, prepared: true, autoSend: entry.autoSend && settings.aiAutoSend } });
        return { ok: true, autoSend: entry.autoSend && settings.aiAutoSend };
      }
      if (entry.claimed || !entry.autoSend || !settings.aiAutoSend) return { ok: false };
      await api.storage.session.set({ [key(tabId)]: { ...entry, claimed: true } });
      return { ok: true };
    }
    if (request.type === 'ai-finish') {
      await api.storage.session.remove(key(tabId));
      return { ok: true, sourceTabId: entry.sourceTabId, sourceDocumentId: entry.sourceDocumentId,
        error: request.cancelled === true || request.sent === true && entry.claimed || request.prepared === true && entry.prepared && !entry.autoSend ? '' : `${provider.name} could not ${entry.autoSend ? 'send automatically' : 'prepare the draft'}. Review the prompt and send it manually.` };
    }
    return { ok: false };
  } finally { locks.delete(tabId); }
}
export async function clearAiHandoff(api, tabId) {
  await api.storage.session.remove(key(tabId));
}
