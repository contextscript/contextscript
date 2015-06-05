---
q:
 - plot locations mentioned
 - show on map

---
```javascript
Promise.all([
cxsAPI.import("underscore"),
cxsAPI.import("github:contextscript-packages/text-extractor"),
cxsAPI.import("github:Leaflet/Leaflet"),
cxsAPI.import("github:Leaflet/Leaflet/dist/leaflet.css!")
])
.then(([
  _,
  {"default": extractText},
  L,
  noop
])=>{
  L.Icon.Default.imagePath = "https://github.jspm.io/Leaflet/Leaflet@0.7.3/dist/images/";
  var {
    text: pageText,
    nodeMappings: nodeMappings
  } = extractText({
    skipSelector:".ctxscript-container"
  });
  var resources;
  cxsAPI.$el.append("Querying dbpedia spotlight...");
  if(window.location.protocol === "https:") {
    cxsAPI.$el.append(`<p>
      You may need to allow this page's content
      to be sent over http in order to annotate it.
      In Chrome, you can do this by clicking the
      shield in the address bar.
    </p>`);
  }
  $.ajax({
    type: 'POST',
    url: 'http://spotlight.sztaki.hu:2222/rest/annotate',
    data: {
      text: pageText,
      //Using a sparql query to filter locations
      //isn't working, probably because there are
      //too many results.
      //Blacklisting might help.
      confidence: 0.9
      //support: 1,
      //spotter: "Default",
      //disambiguator: "Default",
      //policy: "whitelist",
      //types: "",
      //sparql: ""
    },
    dataType: 'json'
  }).then((resp)=>{
    if(!resp.Resources || resp.Resources.length === 0) {
      return cxsAPI.$el.html("No Locations Found");
    }
    //TODO: Update this
    resources = resp.Resources.filter((r)=>{
      return parseFloat(r["@percentageOfSecondRank"]) < .1;
    });
    var uriToResources = _.groupBy(resources, "@URI");
    var uris = _.keys(uriToResources);
    $.ajax({
      type: 'POST',
      url: 'http://dbpedia.org/sparql',
      data: {
        format: "application/sparql-results+json",
        query: `SELECT
        ?location
        (group_concat(DISTINCT ?lat;separator=";;") as ?lats)
        (group_concat(DISTINCT ?long;separator=";;") as ?longs)
        WHERE {
          ?location geo:lat ?lat ; geo:long ?long .
          FILTER (?location IN (${
            uris.map((uri)=>`<${uri}>`).join(",")
          }))
        } GROUP BY ?location`
      },
      dataType: 'json'
    }).then(({
      results: {
        bindings: matches
      }
    })=>{
      if(matches.length === 0) {
        return cxsAPI.$el.html("No Geopoints Identified");
      }
      var $map = cxsAPI.$el.html(`
        <style>
        .cxs-highlighted {
          background-color: yellow;
        }
        .text-link {
          cursor: pointer;
          text-decoration: underline;
        }
        </style>
        <div
          id="map"
          style="min-height: 500px;"></div>
      `);
      var map = L.map($map.find("#map")[0]).setView([51.505, -0.09], 13);
      L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      var markers = new L.featureGroup();
      var matchesByCoord = _.chain(matches)
        .map((match)=>{
          let {
            lats: { value: lats },
            longs: { value: longs },
            location: { value: locURI }
          } = match;
          let coords = _.zip(lats.split(";;"), longs.split(";;"))
            .map((x)=> x.map(parseFloat))
            .filter((coord)=>{
              return coord.every((x)=>{
                return !_.isNaN(x) && _.isNumber(x);
              });
            });
          return coords.map((coord)=>{
            return {
              coord: coord,
              locURI: locURI
            };
          })
        })
        .flatten(true)
        .groupBy((match)=> JSON.stringify(match.coord))
        .value()
      for(var coordKey in matchesByCoord){
        let matchesAtCoord = matchesByCoord[coordKey];
        console.log(coordKey, matchesAtCoord);
        let resourcesAtCoordByURI = _.chain(matchesAtCoord)
          .map((m)=>uriToResources[m.locURI])
          .flatten()
          .groupBy("@URI")
          .value();
        L.marker(JSON.parse(coordKey))
          .bindPopup(`
            <div style="max-height: 400px; overflow-y:auto;">
            ${ _.map(resourcesAtCoordByURI, (resourcesAtCoord, uri)=>{
              return `<p>
              <strong>${ resourcesAtCoord[0]["@surfaceForm"] }</strong>
              - <a
                class="entity-link"
                href="${uri}"
                target="_blank"
              >
                DBPedia Entity
              </a>
              <br>
              Mentions:
              ${ _.map(resourcesAtCoord, (r, i)=>{
                var offset = parseInt(r["@offset"]);
                var nodeIdx = nodeMappings.findIndex(({start, end})=>{
                  return (offset >= start && offset < end);
                });
                return `
                <a
                  class="text-link"
                  data-idx="${nodeIdx}"
                  data-ridx="${resources.indexOf(r)}"
                >${i + 1}</a>`;
              }).join(" ") }
              </p>`;
            }).join(" ") }
            </div>
          `)
          .addTo(markers);
      }
      markers.addTo(map);
      map.fitBounds(markers.getBounds());
    });
    let parentNodeMappings = nodeMappings.map(({node})=>node.parentNode);
    var prevNewNode, prevIdx;
    cxsAPI.$el.on("click", ".text-link", (evt)=>{
      let idx = parseInt($(evt.target).data("idx"), 10);
      let ridx = parseInt($(evt.target).data("ridx"), 10);
      let {
        node: oldNode,
        start,
        end
      } = nodeMappings[idx];
      parentNode = parentNodeMappings[idx];
      let resource = resources[ridx];
      console.log(resource);
      if(prevIdx) {
        let prevOldNode = nodeMappings[prevIdx].node;
        let prevParent = parentNodeMappings[prevIdx];
        prevParent.replaceChild(prevOldNode, prevNewNode);
        prevNewNode = prevOldNode;
      }
      if(prevIdx === idx) {
        prevIdx = null;
        return;
      }
      let text = oldNode.textContent;
      let firstCharIdx = text.search(/\S/g);
      let relativeStart = parseInt(resource["@offset"]) + firstCharIdx - start;
      let relativeEnd = resource["@surfaceForm"].length + relativeStart;
      newNode = $("<span>").html(
        text.slice(0, relativeStart) +
        '<span class="cxs-highlighted">' +
          text.slice(relativeStart, relativeEnd) +
        "</span>" +
        text.slice(relativeEnd)
      ).get(0);
      parentNode.replaceChild(newNode, oldNode);
      $(document.body).scrollTop($(newNode).offset().top);
      prevIdx = idx;
      prevNewNode = newNode;
    });
  });
});
```