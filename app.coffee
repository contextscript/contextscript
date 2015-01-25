# I'm using coffeescript here so I can write ES queries in YAML-like syntax
esclient = require('./esclient')
config = require('./config')
fs = require('fs')
express = require("express")
bodyParser = require("body-parser")
passport = require("passport")
PersonaStrategy = require("passport-persona").Strategy
methodOverride = require("method-override")
session = require("express-session")
partials = require("express-partials")
uuid = require("node-uuid")
Promise = require('promise')
validate = require('jsonschema').validate

# Passport session setup.
#   To support persistent login sessions, Passport needs to be able to
#   serialize users into and deserialize users out of the session.  Typically,
#   this will be as simple as storing the user ID when serializing, and finding
#   the user by ID when deserializing.
passport.serializeUser (user, done) ->
  done null, user.email

passport.deserializeUser (email, done) ->
  esclient.search(
    index: "users"
    body:
      query:
        term:
          email: email
  ).then((result) ->
    return done("No user found")  if result.hits.total is 0
    userInfo = result.hits.hits[0]._source
    userInfo.id = result.hits.hits[0]._id
    done null, userInfo
  )["catch"] done

passport.use new PersonaStrategy(
  audience: config.serverUrl
, (email, done) ->
  #TODO: TOS
  esclient.search(
    index: "users"
    body:
      query:
        term:
          email: email
  ).then((result) ->
    userInfo = undefined
    userInfo = email: email
    if result.hits.hits.length is 0
      userInfo.key = uuid.v4()
      esclient.index(
        index: "users"
        type: "user"
        refresh: true
        body: userInfo
      ).then (createUserResult) ->
        userInfo.id = createUserResult._id
        done null, userInfo
    else if result.hits.hits.length is 1
      userInfo = result.hits.hits[0]._source
      userInfo.id = result.hits.hits[0]._id
      done null, userInfo
    else
      done "error"
  ).catch done
)

app = express()
module.exports = app
app.set "views", __dirname + "/views"
app.set "view engine", "ejs"
#logging
app.use require("morgan")("combined")
app.use bodyParser.json()
app.use bodyParser.urlencoded(extended: true)
app.use methodOverride()
app.use session(secret: config.sessionSecret)
app.use passport.initialize()
app.use passport.session()
app.use express.static(__dirname + "/static")
app.use partials()

#### Middleware helpers ####
#TODO Index on users
requireUserKey = (req, res, next) ->
  if not req.body.user?.id
    return res.status(401).send({ error: 'User id and key is required' })
  esclient.get(
    index: "users"
    type: "user"
    id: req.body.user.id
  ).then((user)->
    if user._source.key == req.body.user.key
      next()
    else
      res.status(401).send({ error: 'Invalid key' })
  ).catch((e)->
    res.status(401).send({ error: 'Invalid user' })  
  )
  
ensureAuthenticated = (req, res, next) ->
  if req.isAuthenticated()
    next()
  else
    res.redirect('/login')

allowXorigin = (req, res, next) ->
  res.header "Access-Control-Allow-Origin", "*"
  res.header "Access-Control-Allow-Headers", "X-Requested-With"
  next()

app.get "/", (req, res) ->
  res.render "index",
    user: req.user
    config:
      url: config.serverUrl
      user: req.user

app.get "/login", (req, res) ->
  res.render "login",
    user: req.user

app.post "/auth/browserid", passport.authenticate("persona",
  failureRedirect: "/login"
), (req, res) ->
  res.redirect (if req.query.redirect then req.query.redirect else "/")

app.get "/logout", (req, res) ->
  req.logout()
  res.redirect("/")

app.post "/v0/search", allowXorigin, (req, res, next) ->
  console.log(req.user);
  userOverrides = []
  if req.body.user
    orConditions = [{
      term:
        "savedBy": req.body.user.id
    }]
    #TODO: find all scriptIds the user has an override for.
    userOverrides = []
  else
    orConditions = []
  orConditions.push([
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
  ])
  console.log orConditions
  mustTerms = [{
    "or" : orConditions
  }]
  if req.body.context.location
    for prop of req.body.context.location
      term = {}
      fieldname = "context.location." + prop
      term[fieldname] = req.body.context.location[prop]
      # i.e. if the location is defined it should match the query.
      mustTerms.push
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
              must: mustTerms
  ).then (result) ->
    res.json result.hits

app.post "/v0/scripts", allowXorigin, requireUserKey, (req, res, next) ->
  jsvResult = validate(req.body.context, {
    type: "object"
    properties:
      q:
        type: [ "string", "array" ]
      location:
        type: "object"
        properties:
          host: { type: "string" }
          href: { type: "string" }
      prevResultSchema:
        type: "object"
      prevContextScript:
        type: "string"
		required: ["q"]
		additionalProperties: false
  })
  if(!jsvResult.valid)
    res.status(400).send({ error: jsvResult.errors.map((e)-> e.message) })
    return
  saveScript = ()->
    esclient.index(
      index: "contextscripts"
      type: "contextscript"
      id: req.body._id
      # This will cause perf problems
      refresh: true
      body:
        context: req.body.context
        script: req.body.script
        lastModified: new Date()
        savedBy: req.body.user.id
        # Provided if the script is forked from another
        # and publishing should overwrite it.
        baseScriptId: req.body.baseScriptId
    )
    .then (result) ->
      res.json(result)
    .catch (e)-> next(e)
  esclient.get(
    index: "contextscripts"
    type: "contextscript"
    id: req.body._id
  )
  .then (script)->
    # TODO: Add forking
    if script._source.savedBy != req.body.user.id
      res.status(401).send({ error: 'Only the creator can save this script.' })
    else
      saveScript()
  .catch -> saveScript()

app.get "/v0/contextscripts/:id", allowXorigin, (req, res, next) ->
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

mainJs = fs.readFileSync("ctxscriptClientMain.js", "utf8")
app.get "/main.js", allowXorigin, (req, res, next) ->
  mainJs = fs.readFileSync("ctxscriptClientMain.js", "utf8")  if config.debug
  res.writeHead 200,
    "Content-Type": "text/javascript"
  res.end mainJs

ctxscriptCss = fs.readFileSync("ctxscript.css", "utf8")
app.get "/ctxscript.css", allowXorigin, (req, res, next) ->
  res.writeHead 200,
    "Content-Type": "text/css"
  res.end ctxscriptCss

ipaddr = process.env.IP
port = process.env.PORT
server = app.listen port, ipaddr, ->
  (new Promise (r)->r())
    .then ->
      return esclient.indices.putMapping
        type: "contextscript"
        body:
          contextscript:
            properties:
              savedBy: {type : "string", index : "not_analyzed"}
              "context.location.host" : {type : "string", index : "not_analyzed"}
              "context.location.href" : {type : "string", index : "not_analyzed"}
    .then ->
      return esclient.indices.putMapping
        type: "user"
        body:
          user:
            properties:
              email: {type : "string", index : "not_analyzed"}
              key: {type : "string", index : "not_analyzed"}
    .then ->
      yamlhead = require('yamlhead')
      path = require('path')
      return Promise.all([
        "contextScripts/createScript.md"
        "contextScripts/getText.md"
        "contextScripts/starfleet.md"
      ].map (curPath) ->
        return new Promise (resolve, reject)->
          yamlhead curPath, (err, yaml, content)->
            if err
              reject(err)
            else
              esclient.index
                index: "contextscripts"
                type: "contextscript"
                id: path.basename(curPath, '.md')
                refresh: true
                body:
                  published: true
                  context: yaml
                  # The first and last lines are markdown formatting.
                  script: content.split('\n').slice(1,-1).join('\n')
              .then(resolve)
              .catch(reject)
      )
    .then ->
      console.log "base scripts indexed"
    .catch (e)->
      console.log("ERROR:", e)
      server.close()

  console.log "%s: Node server started on %s:%d ...", Date(Date.now()), ipaddr, port
