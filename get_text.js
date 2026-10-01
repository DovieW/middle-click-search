(async () => {
  const { normalizeSettings } = await import(chrome.runtime.getURL('lib/settings.js'));
  const { siteEnabled } = await import(chrome.runtime.getURL('lib/sites.js'));
  let preferences;
  const originUrl = location.ancestorOrigins?.length ? location.ancestorOrigins[location.ancestorOrigins.length - 1] : location.href;
  let consumedMiddleClick = false;
  let pending = false;
  let notice;

  let stored = {};
  let startupError = false;
  let loaded = false;
  const pendingChanges = {};
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || startupError) return;
    if (!loaded) { Object.assign(pendingChanges, changes); return; }
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) delete stored[key];
      else stored[key] = change.newValue;
    }
    preferences = normalizeSettings(stored);
  });

  try { stored = await chrome.storage.sync.get(null); }
  catch { stored = { enabled: false }; startupError = true; }
  for (const [key, change] of Object.entries(pendingChanges)) {
    if (change.newValue === undefined) delete stored[key];
    else stored[key] = change.newValue;
  }
  preferences = normalizeSettings(stored);
  loaded = true;

  function isLink(event) {
    return event.composedPath().some(node => node instanceof Element &&
      node.matches('a[href], area[href], [role="link"], [data-link]'));
  }

  function selectedText() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (active instanceof HTMLInputElement &&
          !['text', 'search', 'url', 'tel'].includes(active.type)) return null;
      const { selectionStart: start, selectionEnd: end } = active;
      if (start === null || end === null || start === end) return null;
      return {
        text: active.value.slice(start, end).trim(),
        clear() {
          if (active.selectionStart === start && active.selectionEnd === end &&
              active.value.slice(start, end).trim() === this.text) {
            active.setSelectionRange(end, end);
          }
        },
      };
    }
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) return null;
    const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
    return {
      text,
      clear() {
        if (selection.anchorNode === anchorNode && selection.anchorOffset === anchorOffset &&
            selection.focusNode === focusNode && selection.focusOffset === focusOffset &&
            selection.toString().trim() === text) selection.removeAllRanges();
      },
    };
  }

  function showError(message) {
    notice?.remove();
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.style.cssText = 'font:14px/1.5 system-ui;background:#18181b;color:#fff;border-left:3px solid #dc2626;padding:14px 18px;border-radius:10px;max-width:320px;box-shadow:0 4px 24px #0004;';
    alert.textContent = `Middle Click to Search: ${message}`;
    root.append(alert);
    document.documentElement.append(host);
    notice = host;
    setTimeout(() => host.remove(), 6000);
  }

  document.addEventListener('mousedown', event => {
    consumedMiddleClick = false;
    if (!event.isTrusted || event.defaultPrevented || event.button !== 1 || !siteEnabled(originUrl, preferences) || isLink(event)) return;
    const selection = selectedText();
    if (!selection?.text) return;
    consumedMiddleClick = preferences.preventAutoscroll;
    if (preferences.preventAutoscroll) event.preventDefault();
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => chrome.runtime.sendMessage({
      type: 'search-selection',
      text: selection.text,
      invertFocus: event.ctrlKey || event.metaKey,
    })).then(response => {
      if (!response?.ok) throw new Error(response?.error || 'Could not open a tab.');
      if (response.clearSelection) selection.clear();
      if (response.warning) showError(response.warning);
    }).catch(error => showError(error.message)).finally(() => { pending = false; });
  }, true);

  window.addEventListener('auxclick', event => {
    if (event.button !== 1) return;
    if (consumedMiddleClick && !isLink(event)) event.preventDefault();
    consumedMiddleClick = false;
    if (!event.isTrusted || event.defaultPrevented || !siteEnabled(originUrl, preferences) ||
        preferences.linkFocus === 'browser') return;
    const link = event.composedPath().find(node => node instanceof Element && node.matches('a[href], area[href]'));
    // Downloads and non-web schemes retain native semantics.
    if (!link || link.hasAttribute('download') || !/^https?:\/\//i.test(link.href)) return;
    const destination = new URL(link.href);
    if (destination.username || destination.password) return;
    event.preventDefault();
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => chrome.runtime.sendMessage({ type: 'open-link', url: link.href,
      invertFocus: event.ctrlKey || event.metaKey,
    })).then(response => {
      if (!response?.ok) throw new Error(response?.error || 'Could not open the link.');
    }).catch(error => showError(error.message)).finally(() => { pending = false; });
  });
  // Register only after gesture handlers are installed: a reply proves readiness.
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type !== 'page-status' || sender.id !== chrome.runtime.id) return;
    sendResponse({ ready: !startupError, error: startupError ? 'Could not load preferences. Try refreshing.' : '',
      version: chrome.runtime.getManifest().version, url: location.href });
  });
  if (window === top) void chrome.runtime.sendMessage({ type: 'page-ready' }).catch(() => {});

})();
