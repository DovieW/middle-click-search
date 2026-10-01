// A plain hostname matches itself; *.example.com also matches its subdomains.
export function siteHost(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase().replace(/\.$/, '') : '';
  } catch { return ''; }
}
export function parseSiteRules(text) {
  const rules = [...new Set(text.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean))];
  if (rules.length > 100 || new TextEncoder().encode(JSON.stringify(rules)).length > 7000) {
    throw new Error('Use up to 100 site rules (7,000 bytes total).');
  }
  return rules.map(rule => {
    const host = rule.startsWith('*.') ? rule.slice(2) : rule;
    if (!host || /[\s/?#@]/.test(host) || siteHost(`https://${host}`) !== host ||
        (!/^\[[a-f\d:]+\]$/i.test(host) && /[:*]/.test(host))) {
      throw new Error(`Invalid site: ${rule}. Use a hostname, such as example.com or *.example.com.`);
    }
    return rule;
  });
}
export function normalizeOverrides(values) {
  const result = {};
  if (!values || typeof values !== 'object' || Array.isArray(values)) return result;
  for (const [host, enabled] of Object.entries(values)) {
    if (Object.keys(result).length >= 100) break;
    if (typeof enabled === 'boolean' && siteHost(`https://${host}`) === host &&
        !/[/?#@*]/.test(host) && host !== '__proto__') result[host] = enabled;
  }
  return new TextEncoder().encode(JSON.stringify(result)).length <= 7000 ? result : {};
}
export function siteEnabled(url, settings) {
  const host = siteHost(url);
  if (!host || settings.enabled === false) return false;
  if (Object.hasOwn(settings.siteOverrides || {}, host)) return settings.siteOverrides[host];
  const match = (settings.siteRules || []).some(rule => rule.startsWith('*.') ?
    host === rule.slice(2) || host.endsWith(`.${rule.slice(2)}`) : host === rule);
  return settings.siteMode === 'allow' ? match : !match;
}
