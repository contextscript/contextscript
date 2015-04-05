---
q: find starfleet engineers
---
```javascript
Promise.all([
  System.import("github:contextscript-packages/text-extractor"),
  System.import("underscore")
]).then(([
  {"default": extractText},
  _
])=>{
  var { text: pageText } = extractText({
    skipSelector:".ctxscript-container"
  });
  cxsAPI.$el.append("Querying dbpedia...");
  $.ajax({
    type: 'POST',
    url: '//spotlight.dbpedia.org/rest/annotate',
    data: {
      text: pageText,
      sparql: `SELECT DISTINCT ?person
      WHERE {
          ?person ?related
          <http://dbpedia.org/resource/Category:Starfleet_engineers>
      }`
    },
    dataType: 'json'
  }).then((resp)=>{
    if(!resp.Resources || resp.Resources.length === 0) {
      cxsAPI.$el.html("No Starfleet engineers found.");
      return;
    }
    cxsAPI.$el.html(`<ul>
    ${
      _.chain(resp.Resources)
        .groupBy("@URI")
        .map((group, uri) => `<li>
          <a href="${uri}">${group[0]['@surfaceForm']}</a>
        </li>`)
        .value()
        .join('')
    }
    </ul>`);
  });
})
.catch((err)=>{
  console.log(err);
});
```