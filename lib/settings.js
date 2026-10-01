import { parseSiteRules, normalizeOverrides } from './sites.js';

export const DEFAULT_SEARCH_ENGINE = 'https://www.google.com/search?q=%s';
export const DEFAULT_SETTINGS = Object.freeze({
  searchEngine: DEFAULT_SEARCH_ENGINE,
  enabled: true,
  linkFocus: 'browser',
  copyOnSearch: false,
  siteMode: 'block',
  siteRules: Object.freeze([]),
  siteOverrides: Object.freeze({}),
  newTabActive: true,
  disableDomainCheck: false,
  clearSelection: true,
  preventAutoscroll: true,
});
export const SEARCH_ENGINES = Object.freeze([
  { name: 'Google', template: DEFAULT_SEARCH_ENGINE },
  { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q=%s' },
  { name: 'Bing', template: 'https://www.bing.com/search?q=%s' },
  { name: 'Brave', template: 'https://search.brave.com/search?q=%s' },
]);

export function validateSearchEngine(template) {
  if (typeof template !== 'string' || !template.includes('%s')) {
    return 'Include %s where the search text should go.';
  }
  if (new TextEncoder().encode(template).length > 8000) {
    return 'The search URL is too long (up to 8,000 UTF-8 bytes).';
  }
  try {
    const url = new URL(template.replaceAll('%s', 'middle-click-preview'));
    if (!['https:', 'http:'].includes(url.protocol)) return 'Use an HTTP or HTTPS search URL.';
    if (url.username || url.password) return 'Remove credentials from the search URL.';
    // The selection must never determine the destination host or protocol.
    const authority = template.match(/^https?:\/\/([^/?#]*)/i)?.[1];
    if (!authority || authority.includes('%s')) {
      return 'Put %s in the path, query, or fragment, not the domain.';
    }
    if (/[\s\\]/.test(template)) return 'Remove spaces and backslashes from the search URL.';
    return '';
  } catch {
    return 'Enter a complete search URL, such as https://example.com/search?q=%s.';
  }
}

export function normalizeSettings(values = {}) {
  if (!values || typeof values !== 'object') values = {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(settings)) {
    if (key === 'searchEngine') {
      const template = typeof values[key] === 'string' ? values[key].trim() : '';
      if (!validateSearchEngine(template)) settings[key] = template;
    } else if (key === 'linkFocus') {
      if (['browser', 'foreground', 'background'].includes(values[key])) settings[key] = values[key];
    } else if (key === 'siteMode') {
      if (['block', 'allow'].includes(values[key])) settings[key] = values[key];
    } else if (key === 'siteRules') {
      try { settings[key] = parseSiteRules(Array.isArray(values[key]) ? values[key].join('\n') : ''); } catch {}
    } else if (key === 'siteOverrides') {
      settings[key] = normalizeOverrides(values[key]);
    } else if (typeof values[key] === 'boolean') {
      settings[key] = values[key];
    }
  }
  return settings;
}
