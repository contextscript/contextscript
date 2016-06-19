---
q: 'regex {{re}}'
---
```javascript
System.import("github:contextscript-packages/text-extractor")
.then(({"default": extractText})=>{
  var result = extractText({skipSelector:".ctxscript-container"});
  var found = 0;
  for(i in result.nodeMappings) {
    var old = result.nodeMappings[i].node;
    var par = old.parentNode;
    
    var text = old.textContent;
    var newNode = $("<span>").html(
        text.replace(new RegExp('('+cxsAPI.args.re+')',"g"), "<span style='background-color: yellow'>$1</span>")
      ).get(0);
    var matches = text.match(new RegExp('('+cxsAPI.args.re+')'));
    if(matches) {
      found += matches.length;
    }
    
    par.replaceChild(newNode, old);
  }
  cxsAPI.$el.append("Found " + found + " occurences of the word.");
})
.catch((err)=>{
  console.log(err);
});
````
