// Route directional TV remote keys to the paired display shell when the iframe has focus.
if(window.parent!==window){
 const keys={4:'BrowserBack',23:'Enter',13:'Enter',38:'ArrowUp',40:'ArrowDown',37:'ArrowLeft',39:'ArrowRight',27:'Escape',10009:'BrowserBack',461:'BrowserBack'};
 document.addEventListener('keydown',e=>{const key=keys[e.keyCode]||(['OK','Select','Accept'].includes(e.key)?'Enter':e.key);if(!['Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','Backspace','BrowserBack','GoBack'].includes(key)||e.target.closest?.('button,input,select,textarea,a'))return;e.preventDefault();window.parent.postMessage({type:'epc-tv-remote-key',key},location.origin)},true);
}
