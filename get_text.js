(() => {
  let preventAutoscroll = true;
  let consumedMiddleClick = false;
  let pending = false;
  let notice;

  chrome.storage.sync.get({ preventAutoscroll: true }).then(settings => {
    preventAutoscroll = settings.preventAutoscroll !== false;
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.preventAutoscroll) {
      preventAutoscroll = changes.preventAutoscroll.newValue !== false;
    }
  });

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
    alert.style.cssText = 'font:14px/1.5 system-ui;background:#17232d;color:#fff;padding:14px 18px;border-radius:10px;max-width:320px;box-shadow:0 4px 24px #0004;';
    alert.textContent = `Middle Click to Search: ${message}`;
    root.append(alert);
    document.documentElement.append(host);
    notice = host;
    setTimeout(() => host.remove(), 6000);
  }

  document.addEventListener('mousedown', event => {
    consumedMiddleClick = false;
    if (!event.isTrusted || event.defaultPrevented || event.button !== 1 || isLink(event)) return;
    const selection = selectedText();
    if (!selection?.text) return;
    consumedMiddleClick = preventAutoscroll;
    if (preventAutoscroll) event.preventDefault();
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => chrome.runtime.sendMessage({
      type: 'search-selection',
      text: selection.text,
      invertFocus: event.ctrlKey || event.metaKey,
    })).then(response => {
      if (!response?.ok) throw new Error(response?.error || 'Could not open a tab.');
      if (response.clearSelection) selection.clear();
    }).catch(error => showError(error.message)).finally(() => { pending = false; });
  }, true);

  document.addEventListener('auxclick', event => {
    if (event.button === 1 && consumedMiddleClick && !isLink(event)) event.preventDefault();
    consumedMiddleClick = false;
  }, true);
})();
