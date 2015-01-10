# I'm using coffeescript here so I can write ES queries in YAML-like syntax
esclient = require('./esclient')
app = require('./app')

###
The location queries require mappings.
curl -XPUT 'http://localhost:9200/contextscripts/_mapping/contextscript' -d '
{
    "contextscript" : {
        "properties" : {
            "context.location.host" : {"type" : "string", "index" : "not_analyzed"},
            "context.location.href" : {"type" : "string", "index" : "not_analyzed"}
        }
    }
}
'
###
app.post "/v0/search", (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  must_terms = []
  if req.body.context.location
    for prop of req.body.context.location
      term = {}
      fieldname = "context.location." + prop
      term[fieldname] = req.body.context.location[prop]
      # i.e. if the location is defined it should match the query.
      must_terms.push
        "or": [
          {
            term: term
          }
          {
            missing:
              field: fieldname
          }
        ]
          
  esclient.search(
    index: "contextscripts"
    body:
      explain: true
      query:
        filtered:
          query:
            bool:
              must:
                fuzzy_like_this_field:
                  "context.q":
                    # More data is needed for tf to be useful.
                    ignore_tf: true
                    like_text: req.body.context.q
              should:
                match_phrase:
                  "context.q":
                    query: req.body.context.q
                    slop: req.body.context.q.split(' ').length / 2
          filter:
            bool:
              must: must_terms
  ).then (result) ->
    res.writeHead 200,
      "Content-Type": "text/plain"
    res.end JSON.stringify(result.hits)

app.post "/v0/scripts", (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  
  #TODO: Check use key
  #TODO: Context validation
  # Index is used so that the whole document is replaced
  
  #This will cause perf problems
  esclient.index(
    index: "contextscripts"
    type: "contextscript"
    id: req.body._id
    refresh: true
    body:
      context: req.body.context
      script: req.body.script
      lastModified: new Date()
      lastModifiedBy: req.body.user
  ).then (result) ->
    res.writeHead 200,
      "Content-Type": "text/plain"

    res.end JSON.stringify(result)
