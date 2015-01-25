---
q: get page text
---
```javascript
var walk = document.createTreeWalker(document, NodeFilter.SHOW_ALL, null, false);
var fragments = [];
var n;
var text;
while(n=walk.nextNode()) {
  if(n.classList && (n.classList.contains('ctxscript-container'))) {
    n = walk.nextSibling();console.log(123);
  }
  if(n.nodeType !== 3) continue;
  if(n.parentElement.tagName in {"STYLE":"", "SCRIPT":"", "NOSCRIPT":""}) continue;
  text = n.nodeValue.trim();
  if(text === '') continue;
  fragments = fragments.concat(text);
}
var allText = fragments.join(' ');
cxsAPI.setResult(allText);
```