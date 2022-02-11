chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: searchHighlighted,
  });
});

function searchHighlighted() {
  console.log('yupo');
}
