chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    let url;
    try {url = new URL(request.query);} catch (e) {}
    if (url){
      chrome.tabs.create({url: url.href});
      return;
    }
    chrome.tabs.create({
        url: 'https://www.google.com/search?q=' + request.query
    });
  }
);