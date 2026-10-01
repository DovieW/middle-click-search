(() => {
  const gemini = location.origin === 'https://gemini.google.com';
  const path = gemini ? '/app' : '/';
  if (window !== top || ![ 'https://chatgpt.com', 'https://gemini.google.com' ].includes(location.origin) || location.pathname !== path) return;
  const nonce = new URLSearchParams(location.hash.slice(1)).get('mcs-auto-send');
  const expected = new URLSearchParams(location.search).get('q');
  if (!nonce || !expected) return;
  let finished = false, busy = false, clicked = false, prepared = false, autoSend = !gemini;
  const normalize = text => text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\n+/g, '\n').trim();
  const composer = () => document.querySelector(gemini ? '.ql-editor[contenteditable="true"][role="textbox"]' : '#prompt-textarea, [contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT"]');
  const sendButton = () => document.querySelector(gemini ? 'button.send-button, button[aria-label="Send message"]' : 'button[data-testid="send-button"], button#composer-submit-button, form[data-chatgpt-composer] button[type="submit"][aria-label="Send"]');
  const text = element => element instanceof HTMLTextAreaElement ? element.value : element?.innerText || '';
  let timer, readyField, readySince = 0, preparedSince = 0;
  async function finish(sent, cancelled = false, draft = false) {
    if (finished) return;
    finished = true; clearInterval(timer);
    try { await chrome.runtime.sendMessage({ type: 'ai-finish', nonce, sent, cancelled, prepared: draft }); } catch {}
  }
  // Edits or manual submission cancel automation; never send a different prompt.
  document.addEventListener('beforeinput', event => {
    if (event.isTrusted && composer()?.contains(event.target)) void finish(false, true);
  }, true);
  document.addEventListener('click', event => {
    if (event.isTrusted && sendButton()?.contains(event.target)) void finish(false, true);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.isTrusted && event.key === 'Enter' && !event.shiftKey && composer()?.contains(event.target)) void finish(false, true);
  }, true);
  const deadline = Date.now() + 45_000;
  const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected)).then(digest =>
    Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
  async function check() {
    if (finished || busy) return;
    if (Date.now() > deadline || !clicked && location.pathname !== path) { await finish(false); return; }
    const field = composer();
    if (clicked) {
      if (field && !normalize(text(field)) || document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop generating"], button[aria-label="Stop"]')) await finish(true);
      return;
    }
    if (!field) return;
    if (gemini && !prepared) {
      if (field !== readyField) { readyField = field; readySince = Date.now(); }
      if (Date.now() - readySince < 750) return;
      busy = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'ai-prepare', nonce, promptHash: await hash });
        if (finished) return;
        if (!result?.ok) { if (!result?.waiting) await finish(false); return; }
        if (location.pathname !== path || field !== composer()) { await finish(false); return; }
        // Never replace an existing draft. Native q handling may have filled it already.
        if (normalize(text(field)) && normalize(text(field)) !== normalize(expected)) { await finish(false, true); return; }
        prepared = true; preparedSince = Date.now(); autoSend = result.autoSend;
        if (!normalize(text(field))) {
          const lines = expected.split('\n').map(line => {
            const paragraph = document.createElement('p');
            if (line) paragraph.textContent = line;
            else paragraph.append(document.createElement('br'));
            return paragraph;
          });
          field.replaceChildren(...lines);
          field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: expected }));
        }

      } catch { await finish(false); }
      finally { busy = false; }
      return;
    }
    if (gemini && prepared && !autoSend) {
      if (Date.now() - preparedSince < 500) return;
      if (field === readyField && normalize(text(field)) === normalize(expected)) await finish(false, false, true);
      else await finish(false);
      return;
    }
    if (!normalize(text(field))) return;
    if (normalize(text(field)) !== normalize(expected)) { await finish(false); return; }
    const button = sendButton();
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    busy = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'ai-claim', nonce, promptHash: await hash });
      if (finished) return;
      if (!result?.ok) { if (!result?.waiting) await finish(false); return; }
      // Recheck after awaiting the worker: the user may have edited or navigated.
      if (location.pathname !== path || normalize(text(composer())) !== normalize(expected) || button !== sendButton() || button.disabled || button.getAttribute('aria-disabled') === 'true') {
        await finish(false); return;
      }
      clicked = true;
      button.click();
    } catch { await finish(false); }
    finally { busy = false; }
  }
  timer = setInterval(() => void check(), 250);
  void check();
})();
