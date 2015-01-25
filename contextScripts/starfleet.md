---
q: find starfleet engineers
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
var pageText = fragments.join(' ');
cxsAPI.$el.append("Querying dbpedia...");
Promise.all([
$.ajax({
  type: 'POST',
  url: 'http://spotlight.dbpedia.org/rest/annotate',
  data: {
    text: pageText,
    sparql: `SELECT DISTINCT ?person
    WHERE {
        ?person ?related
<http://dbpedia.org/resource/Category:Starfleet_engineers>
    }`
  },
  dataType: 'json'
}),
System.import("underscore")
]).then(([resp,_])=>{
    cxsAPI.$el.html(`<ul>
    ${
        _.chain(resp.Resources)
         .groupBy("@URI")
         .map((group, uri)=>{
            return `<li><a href="${uri}">
                ${group[0]['@surfaceForm']}
            </a></li>`
         })
         .value().join('')
    }
    </ul>`);
});
```