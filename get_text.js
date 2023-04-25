document.addEventListener('mouseup', (el) => {
  if (el.button === 1) {
    const e = el.target;
    const p = e.parentElement;
    if (e.tagName === 'A' || e.hasAttribute('data-link') || e.hasAttribute('href') || e.getAttribute('role') === 'link'
    || p.tagName === 'A' || p.hasAttribute('data-link') || p.hasAttribute('href') || p.getAttribute('role') === 'link') {
      return; // trying to find a link, won't always work and could cause 2 tabs to be opened
    }

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({text: selectedText});
    }
  }
});