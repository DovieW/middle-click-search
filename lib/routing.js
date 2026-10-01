import { aiProvider } from './ai-providers.js';
import { normalizeSettings, validateCustomAiUrl } from './settings.js';

export const MAX_SELECTION_LENGTH = 20_000;

export function normalizeSelection(text) {
  if (typeof text !== 'string') throw new TypeError('Select some text first.');
  const selection = text.trim();
  if (!selection) throw new TypeError('Select some text first.');
  if (selection.length > MAX_SELECTION_LENGTH) {
    throw new RangeError('Select a shorter passage (up to 20,000 characters).');
  }
  // DOM strings may contain unmatched UTF-16 surrogates. Encode them as replacement
  // characters rather than failing encodeURIComponent for the entire selection.
  return new TextDecoder().decode(new TextEncoder().encode(selection));
}

export function webUrl(text) {
  if (/[\s\\]/.test(text)) return null;
  const explicit = /^https?:\/\//i.test(text);
  if (!explicit && (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(text))) {
    return null;
  }
  try {
    const url = new URL(explicit ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!explicit) {
      const host = url.hostname;
      const labels = host.split('.');
      const domain = labels.length >= 2 && labels.every(label =>
        label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) &&
        /^(?:[a-z]{2,63}|xn--[a-z\d-]+)$/i.test(labels.at(-1));
      const rawHost = text.split(/[/?#]/)[0].replace(/:\d+$/, '');
      const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(rawHost) && host === rawHost;
      const ipv6 = /^\[[a-f\d:]+\]$/i.test(host);
      if (!domain && !ipv4 && !ipv6 && host !== 'localhost') return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export const MAX_AI_LINK_LENGTH = 8_000;

export function buildAiPrompt(text, values, pageUrl = '') {
  const settings = normalizeSettings(values);
  let source = '';
  if (settings.aiIncludeUrl) {
    try {
      const url = new URL(pageUrl);
      if (['http:', 'https:'].includes(url.protocol)) {
        url.username = ''; url.password = '';
        source = url.href;
      }
    } catch { /* Missing or protected-page URLs are omitted. */ }
  }
  let template = settings.aiPrompt;
  // Omit a URL-only line when disabled, without changing whitespace inside context.
  if (!source) template = template.replace(/(^|\n)[ \t]*(?:From Page:[ \t]*)?\{url\}[ \t]*(?=\n|$)/g, '');
  const selection = normalizeSelection(text);
  // One pass: placeholders in the selected text or URL are always literal context.
  return template.replace(/\{text\}|\{url\}/g, token => token === '{text}' ? selection : source).trim();
}

export function resolveTarget(text, values, pageUrl = '') {
  const selection = normalizeSelection(text);
  const settings = normalizeSettings(values);
  const provider = aiProvider(settings.destination);
  if (provider) {
    if (provider.id === 'custom-ai' && validateCustomAiUrl(settings.customAiUrl)) throw new TypeError('Enter a valid Custom AI URL in settings.');
    const prompt = buildAiPrompt(selection, settings, pageUrl);
    // q is a website handoff, not an API call. Never silently truncate context.
    const encoded = encodeURIComponent(prompt.toWellFormed());
    const url = provider.id === 'custom-ai' ? settings.customAiUrl.replaceAll('%s', encoded) : `${provider.url}?q=${encoded}`;
    if (url.length > MAX_AI_LINK_LENGTH) throw new RangeError(`This context is too long for a ${provider.name} link. Select a shorter passage or turn off the page URL.`);
    return { url, kind: 'ai', provider: provider.id };
  }
  if (!settings.disableDomainCheck) {
    const direct = webUrl(selection);
    if (direct) return { url: direct, kind: 'website' };
  }
  return { url: settings.searchEngine.replaceAll('%s', encodeURIComponent(selection)), kind: 'search' };
}
