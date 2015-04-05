---
q: get page text
---
```javascript
System.import("github:contextscript-packages/text-extractor")
.then(({"default": extractText})=>{
  var result = extractText({skipSelector:".ctxscript-container"});
  cxsAPI.$el.empty().append(
    "<h3>Text Extracted:</h3>",
    $("<p>").text(result.text));
  cxsAPI.setResult(result);
})
.catch((err)=>{
  console.log(err);
});
```