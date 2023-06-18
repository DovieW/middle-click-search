document.addEventListener('mousedown', (e) => {
  if (e.button === 1) {
    const t = e.target;
    const p = t.parentElement;

    // trying to find a link, won't always work and could cause 2 tabs to be opened, i think?
    if (t.tagName === 'A' || t.hasAttribute('data-link') || t.hasAttribute('href') || t.getAttribute('role') === 'link'
    || p.tagName === 'A' || p.hasAttribute('data-link') || p.hasAttribute('href') || p.getAttribute('role') === 'link') {
      return;
    }

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        text: selectedText,
        ctrlKey: e.ctrlKey
      });
    }
  }
});

// document.addEventListener('mousedown', (e) => {
//   console.log("in preventdefault listner: " + e);
//   if (e.button === 1 && window.getSelection().toString().trim()) {
//     chrome.storage.sync.get({'preventAutoscroll': false}, function(data) {
//       console.log("in preventdefault block: " + data.preventAutoscroll);
//       if (!data.preventAutoscroll) return;

//       const t = e.target;
//       const p = t.parentElement;

//       // if (t.tagName === 'A' || t.hasAttribute('data-link') || t.hasAttribute('href') || t.getAttribute('role') === 'link'
//       // || p.tagName === 'A' || p.hasAttribute('data-link') || p.hasAttribute('href') || p.getAttribute('role') === 'link') {
//       //   const url = t.href || p.href;
//       //   chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
//       //     const activeTab = tabs[0];
//       //     chrome.tabs.create({url: url, index: activeTab.index + 1, active: false});
//       //   });
//       // }

//       e.preventDefault();
//       e.stopPropagation();
//     });
//   }
// });