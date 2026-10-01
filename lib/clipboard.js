let creating;
// Keep clipboard work in an extension document, independent of page focus/HTTPS.
export async function copyText(text) {
  const documents = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('clipboard.html')] });
  if (!documents.length) {
    creating ||= chrome.offscreen.createDocument({
      url: 'clipboard.html', reasons: ['CLIPBOARD'],
      justification: 'Copy selected text when the user enables copy-on-search.',
    }).finally(() => { creating = undefined; });
    await creating;
  }
  // getContexts can expose a document before its script has finished loading.
  if (creating) await creating;
  const response = await chrome.runtime.sendMessage({ type: 'copy-text', text });
  if (!response?.ok) throw new Error('Clipboard write failed.');
}
