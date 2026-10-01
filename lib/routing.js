import { normalizeSettings } from './settings.js';

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

export function resolveTarget(text, values) {
  const selection = normalizeSelection(text);
  const settings = normalizeSettings(values);
  if (!settings.disableDomainCheck) {
    const direct = webUrl(selection);
    if (direct) return { url: direct, kind: 'website' };
  }
  return { url: settings.searchEngine.replaceAll('%s', encodeURIComponent(selection)), kind: 'search' };
}
