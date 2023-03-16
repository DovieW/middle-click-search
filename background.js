chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const text = request.text;
  let targetUrl;

  const processedUrl = processUrl(text);
  if (processedUrl) {
    targetUrl = processedUrl;
  } else {
    const searchText = encodeURIComponent(text);
    targetUrl = `https://www.google.com/search?q=${searchText}`;
  }

  createTabNextToActive(targetUrl);
});

function processUrl(url) {
  const invalidChars = /[^a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]/;

  if (invalidChars.test(url)) {
    return null;
  }

  try {
    new URL(url);
    return url;
  } catch (e) {
    const domainRegex = /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,10}$/;
    if (domainRegex.test(url)) {
      return `https://${url}`;
    }
    return null;
  }
}

function createTabNextToActive(url) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    chrome.tabs.create({url: url, index: activeTab.index + 1});
  });
}