chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== 'copy-text' || sender.id !== chrome.runtime.id || sender.tab ||
      typeof request.text !== 'string' || request.text.length > 20_000) return;
  const field = document.querySelector('#copy');
  try {
    field.value = request.text;
    field.select();
    sendResponse({ ok: document.execCommand('copy') });
  } catch { sendResponse({ ok: false }); }
  finally { field.value = ''; }
});
