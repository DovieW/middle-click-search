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

  // preventAutoscroll.addEventListener('change', function() {
  //   chrome.storage.sync.set({preventAutoscroll: this.checked});
  // });
});
