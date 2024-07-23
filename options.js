document.addEventListener('DOMContentLoaded', function() {
  let newTabActive = document.getElementById('newTabActive');
  // let preventAutoscroll = document.getElementById('preventAutoscroll');

  chrome.storage.sync.get({newTabActive: true, preventAutoscroll: false}, function(data) {
    newTabActive.checked = data.newTabActive;
    // preventAutoscroll.checked = data.preventAutoscroll;
    // preventAutoscroll.disabled = data.newTabActive;
  });

  newTabActive.addEventListener('change', function() {
    chrome.storage.sync.set({newTabActive: this.checked});
    // preventAutoscroll.disabled = this.checked;
    // if (this.checked) {
    //   preventAutoscroll.checked = false;
    //   chrome.storage.sync.set({preventAutoscroll: false});
    // }
  });

  let searchEngine = document.getElementById('searchEngine');
  chrome.storage.sync.get({searchEngine: 'https://www.google.com/search?q=%s'}, function(data) {
    if (data.searchEngine === "") {
      data.searchEngine = 'https://www.google.com/search?q=%s';
    }
    searchEngine.value = data.searchEngine;
  });
  searchEngine.addEventListener('change', function() {
    chrome.storage.sync.set({searchEngine: this.value});
  });

  // preventAutoscroll.addEventListener('change', function() {
  //   chrome.storage.sync.set({preventAutoscroll: this.checked});
  // });
});
