document.querySelector('body').addEventListener('mouseup', (e) => {
  if (e.button === 1){
    console.log('MIDDLE CLICK');
    if (window.getSelection) {
      text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
      text = document.selection.createRange().text;
    }
    if (text){
      chrome.runtime.sendMessage({query: text});
    }
  }
});