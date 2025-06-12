chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const text = request.text;
  let targetUrl;

  const processedUrl = processUrl(text);
  if (processedUrl) {
    targetUrl = processedUrl;
  } else {
    const searchText = encodeURIComponent(text);
    chrome.storage.sync.get(['searchEngine'], function(result) {
      let searchEngineUrl = result.searchEngine || 'https://www.google.com/search?q=%s';
      if (searchEngineUrl.includes('%s')) {
        targetUrl = searchEngineUrl.replace('%s', searchText);
      } else {
        targetUrl = "https://www.google.com/search?q=%25s+is+not+in+the+search+engine+URL";
      }
      createTabNextToActive(targetUrl, request.ctrlKey);
    });
  }
});

function processUrl(url) {
  const invalidChars = /[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/;

  if (invalidChars.test(url)) {
    return null;
  }

  // Option to disable domain checking (fixes #13)
  let disableDomainCheck = false;
  try {
    // Synchronously get the option from storage (chrome.storage.sync is async, so we use a workaround)
    if (window && window.localStorage) {
      disableDomainCheck = window.localStorage.getItem('disableDomainCheck') === 'true';
    }
  } catch (e) {}

  try {
    new URL(url);
    return url;
  } catch (e) {
    if (disableDomainCheck) {
      return null;
    }
    const domainRegex = /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,10}$/;
    if (domainRegex.test(url)) {
      return `https://${url}`;
    }
    return null;
  }
}

function createTabNextToActive(url, ctrlKey) {
  chrome.storage.sync.get({newTabActive: true}, function(data) {
    let shouldBeActive = data.newTabActive ? !ctrlKey : ctrlKey;
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const activeTab = tabs[0];
      chrome.tabs.create({url: url, index: activeTab.index + 1, active: shouldBeActive});
    });
  });
}

