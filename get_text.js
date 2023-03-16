document.addEventListener('mouseup', (e) => {
  if (e.button === 1) {
    console.log(e.target.tagName.toLowerCase());
    if (e.target.tagName.toLowerCase() === 'a') return;
    const selectedText = window.getSelection().toString().trim();
    

    if (selectedText) {
      chrome.runtime.sendMessage({text: selectedText});
    }
  }
});