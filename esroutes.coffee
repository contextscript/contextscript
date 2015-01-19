# I'm using coffeescript here so I can write ES queries in YAML-like syntax
esclient = require('./esclient')
app = require('./app')
config = require('./config')

app.post "/v0/search", (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  
  #TODO: find all scriptIds the user has an override for.
  userOverrides = []
  
  must_terms = [
    {
      match_all: {}
    }
  ]
  if req.body.user?.id
    must_terms = [{
      "or": [
        {
          term:
            "savedBy": req.body.user.id
        }
        {
          "and": [
            {
              term:
                published: true
            }
            {
              "not": 
                ids:
                  values: userOverrides
            }
          ]
        }
        # TODO: Remove this, it is only for testing.
        {
          match_all: {}
        }
      ]
    }]
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
      #explain: true
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
    res.json result.hits

app.post "/v0/scripts", (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  
  #TODO: Check user key
  #TODO: Context validation
  # Index is used so that the whole document is replaced
  #TODO: Get existing document with the id
  #      if published or uname does not match,
  #      create a new id and add prev-ctscript value.
  esclient.index(
    index: "contextscripts"
    type: "contextscript"
    id: req.body._id
    #This will cause perf problems
    refresh: true
    body:
      context: req.body.context
      script: req.body.script
      lastModified: new Date()
      savedBy: req.body.user.id
  ).then (result) ->
    res.writeHead 200,
      "Content-Type": "text/plain"

    res.end JSON.stringify(result)

ensureAuthenticated = (req, res, next) ->
  if req.isAuthenticated()
    next()
  else
    res.redirect('/login')

app.get "/v0/contextscripts/:id", (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  console.log(13)
  esclient.get(
    index: "contextscripts"
    type: "contextscript"
    id: req.params.id
  ).then((result)->
    res.json(result)
  ).catch(next)

app.get '/contextscripts/:id', (req, res, next) ->
  res.render 'contextscripts', {
    id: req.params.id,
    user: req.user,
    config: {
      url: config.serverUrl,
      user: req.user
    }
  }

app.get '/myscripts', ensureAuthenticated, (req, res, next) ->
  console.log(req.user);
  esclient.search(
    index: "contextscripts"
    body:
      query:
        term:
          "savedBy": req.user.id
      _source:
        exclude: ["script"]
  ).then (result) ->
    res.render 'myscripts', {
      user: req.user,
      result: result
    }
  .catch(next)
