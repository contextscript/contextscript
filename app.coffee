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
  audience: config.serverHttpsUrl
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
  esclient.get
    index: "users"
    type: "user"
    id: req.body.user.id
  .then (user)->
    if user._source.key == req.body.user.key
      req.user = user
      next()
    else
      res.status(401).send({ error: 'Invalid key' })
  .catch (e)->
    res.status(401).send({ error: 'Invalid user' })  


ensureAuthenticated = (req, res, next) ->
  if req.isAuthenticated()
    next()
  else
    res.redirect('/login?redirect=' + req.originalUrl)

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

app.get '/pages/:page', (req, res, next) ->
  res.render 'pages/' + req.params.page,
    user: req.user
    config:
      url: config.serverUrl
      user: req.user

app.get '/contextscripts/:id', (req, res, next) ->
  res.render 'contextscripts',
    id: req.params.id
    user: req.user
    config:
      url: config.serverUrl
      user: req.user

app.get '/myscripts', ensureAuthenticated, (req, res, next) ->
  Promise.all [
    esclient.search
      index: "contextscripts"
      body:
        # TODO: Pagination
        # It would be better use data end-points that are loaded on the page
        # over AJAX.
        size: 200
        query:
          term:
            "savedBy": req.user.id
        _source:
          exclude: ["script"]
    esclient.search
      index: "contextscripts"
      body:
        size: 200
        query:
          term:
            "changes.author": req.user.id
        _source:
          exclude: ["script"]
  ]
  .then (result) ->
    res.render 'myscripts',
      user: req.user
      createdScripts: result[0]
      editedScripts: result[1]
      config:
        url: config.serverUrl
        user: req.user
  .catch next

app.get "/login", (req, res) ->
  res.render "login",
    user: req.user
    config:
      url: config.serverUrl
      user: req.user

app.post "/auth/browserid", passport.authenticate("persona",
  failureRedirect: "/login"
), (req, res) ->
  res.redirect (if req.query.redirect then req.query.redirect else "/")

app.get "/logout", (req, res) ->
  req.logout()
  res.redirect("/")

app.post "/v0/search", allowXorigin, (req, res, next) ->
  if not req.body.context
    return res.status(400).send({ error: "No context provided" })
  accessConditions = [{
    term:
      published: true
  }]
  if req.body.user
    accessConditions.push
      term:
        "savedBy": req.body.user.id
  mustTerms = [{
    "or" : accessConditions
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
  if req.body.context.prevCtxScriptId
    mustTerms.push
      "or": [
        {
          term:
            prevCtxScriptId: req.body.context.prevCtxScriptId
        }
        {
          missing:
            field: "prevCtxScriptId"
        }
      ]
  else
    mustTerms.push
      missing:
        field: "prevCtxScriptId"
  
  esclient.search
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
  .then (result) ->
    parentOverrides = (
      hit._source.parentId\
      for hit in result.hits.hits\
      when hit._source.parentId and hit._source.savedBy is req.body.user.id
    )
    result.hits.hits = result.hits.hits.filter (hit)->
      parentOverrides.indexOf(hit._id) < 0
    res.json result.hits
  .catch next

app.post "/v0/scripts", allowXorigin, requireUserKey, (req, res, next) ->
  jsvResult = validate(req.body.context, {
    type: "object"
    properties:
      q:
        type: [ "string", "array" ]
        items:
          type: "string"
      location:
        type: "object"
        properties:
          host: { type: "string" }
          href: { type: "string" }
      prevResultSchema:
        type: "object"
      prevCtxScriptId:
        type: "string"
		required: ["q"]
		additionalProperties: false
  })
  if(!jsvResult.valid)
    res.status(400).send({ error: jsvResult.errors.map((e)-> e.message) })
    return
  saveScript = ()->
    body = {
      context: req.body.context
      script: req.body.script
      parentId: req.body.parentId
      lastModified: new Date()
      savedBy: req.body.user.id
    }
    # Provided if the script is forked from another
    # and publishing should overwrite it.
    if req.body.parentId
      body.parentId = req.body.parentId
    esclient.index
      index: "contextscripts"
      type: "contextscript"
      id: req.body._id
      # This will cause perf problems
      refresh: true
      body: body
    .then (r)-> res.json(r)
    .catch next
  
  esclient.get
    index: "contextscripts"
    type: "contextscript"
    id: req.body._id
  .then (script)->
    if script._source.savedBy != req.body.user.id
      res.status(401).send
        error: 'Only the creator can save this script.'
    else if script._source.published
      res.status(401).send
        error: 'Published scripts can only be updated by publishing a fork.'
    else
      saveScript()
  .catch (err)->
    if err.status == 404
      # Save a new script
      saveScript()
    else
      next(err)

app.get "/v0/contextscripts/:id", allowXorigin, (req, res, next) ->
  esclient.get
    index: "contextscripts"
    type: "contextscript"
    id: req.params.id
  .then (r)-> res.json(r)
  .catch next

app.post "/v0/delete/:id", ensureAuthenticated, (req, res, next) ->
  esclient.get
    index: "contextscripts"
    type: "contextscript"
    id: req.params.id
  .then (script)->
    if script._source.published and not req.user.admin
      res.status(401).send
        error: 'Published scripts can only be deleted by admins.'
    else if script._source.savedBy == req.user.id
      esclient.delete
        index: "contextscripts"
        type: "contextscript"
        id: req.params.id
        refresh: true
      .then (r)-> res.json(r)
      .catch next
    else
      res.status(401).send
        error: 'Only the creator can delete this script.'
  .catch next

app.post "/v0/publish/:id", ensureAuthenticated, (req, res, next) ->
  if not req.user.admin
    return res.status(401).send
      error: 'Must be admin'
  esclient.get
    index: "contextscripts"
    type: "contextscript"
    id: req.params.id
  .then (script)->
    if script._source.parentId
      esclient.get
        index: "contextscripts"
        type: "contextscript"
        id: script._source.parentId
      .then (parentScript)->
        change = {
          author: script._source.savedBy
          date: new Date()
        }
        esclient.update
          index: "contextscripts"
          type: "contextscript"
          id: script._source.parentId
          refresh: true
          body:
            doc:
              context: script._source.context
              script: script._source.script
              lastModified: new Date()
              # TODO: Store previous version of the code somehow
              changes: (
                if parentScript._source.changes \
                then parentScript._source.changes.concat([change]) \
                else [change]
              )
        .then ->
          esclient.delete
            index: "contextscripts"
            type: "contextscript"
            id: req.params.id
            refresh: true
          .then (r)-> res.json(r)
          .catch next
        .catch next
      .catch next
    else
      esclient.update(
        index: "contextscripts"
        type: "contextscript"
        id: req.params.id
        refresh: true
        body:
          doc:
            published: true
      )
      .then (r)-> res.json(r)
      .catch next
  .catch next

# A endpoints for editing google sheets.
# TODO: Things like this should be independent services

googleapis = require('googleapis')
EditGoogleSheet = require('edit-google-spreadsheet')

oauth2Client = new googleapis.auth.OAuth2(
  config.googleapis.CLIENT_ID,
  config.googleapis.CLIENT_SECRET,
  config.serverHttpsUrl + '/oauth2callback'
)

app.get '/oauth2callback', ensureAuthenticated, (req, res)->
  unless req?.query?.code then return res.status(401).send({ error: 'No code' })
  oauth2Client.getToken req.query.code, (err, tokens)->
    if err then return res.status(401).send({ error: err })
    esclient.update
      index: "users"
      type: "user"
      id: req.user.id
      refresh: true
      body:
        doc:
          googleCredentials: tokens
    .then ->
      res.render "googleAuth",
        user: req.user
        config:
          url: config.serverUrl
          user: req.user
    .catch (err)-> res.status(401).send({ error: err })

requireGoogleCredentials = (req, res, next) ->
  requireUserKey req, res, ()->
    expiryDate = req.user?._source?.googleCredentials?.expiry_date
    unless expiryDate and expiryDate > Number(new Date())
      oauth2URL = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive'
        ]
      })
      return res.json
        oauth2URL: oauth2URL
    req.credentials = req.user._source.googleCredentials
    next()

app.post "/v0/googleSheet/info/:id", allowXorigin, requireGoogleCredentials, (req, res, next) ->
  EditGoogleSheet.load({
    debug: true
    spreadsheetId: req.params.id
    # TODO: Add query param for this
    worksheetId: 'od6'
    accessToken:
      type: req.credentials.token_type
      token: req.credentials.access_token
  }, (err, spreadsheet) ->
    if err then return res.status(401).send({ error: err })
    spreadsheet.receive (err, rows, info) ->
      if err then return res.status(401).send({ error: err })
      info.header = rows["1"]
      # TODO: Don't download the full sheet
      res.json
        info: info
  )

app.post "/v0/googleSheet/addRows/:id", allowXorigin, requireGoogleCredentials, (req, res, next) ->
  if req?.body?.rows?.length == 0
    return res.status(401).send({ error: "No rows were posted" }) 
  EditGoogleSheet.load({
    debug: true
    spreadsheetId: req.params.id
    # TODO: Add query param for this
    worksheetId: 'od6'
    accessToken:
      type: req.credentials.token_type
      token: req.credentials.access_token
  }, (err, spreadsheet) ->
    if err then return res.status(401).send({ error: err })
    spreadsheet.receive (err, rows, info) ->
      if err then return res.status(401).send({ error: err })
      appendSpec = {}
      appendSpec[info.nextRow] = req.body.rows
      spreadsheet.add appendSpec
      # TODO: Allocate size more efficiently
      spreadsheet.send {autoSize: true}, (err) ->
        if err then return res.status(401).send({ error: err })
        res.json
          success: true
  )

mainJs = fs.readFileSync("ctxscriptClientMain.js", "utf8")
app.get "/main.js", allowXorigin, (req, res, next) ->
  mainJs = fs.readFileSync("ctxscriptClientMain.js", "utf8") if config.debug
  res.writeHead 200,
    "Content-Type": "text/javascript"
  res.end mainJs

ctxscriptCss = fs.readFileSync("ctxscript.css", "utf8")
app.get "/ctxscript.css", allowXorigin, (req, res, next) ->
  ctxscriptCss = fs.readFileSync("ctxscript.css", "utf8") if config.debug
  res.writeHead 200,
    "Content-Type": "text/css"
  res.end ctxscriptCss

esclient.ping(
  requestTimeout: 10000
  hello: "elasticsearch!"
)
  .then ->
    return esclient.indices.putMapping
      requestTimeout: 300000
      type: "contextscript"
      body:
        contextscript:
          properties:
            "changes.author": {type : "string", index : "not_analyzed"}
            savedBy: {type : "string", index : "not_analyzed"}
            parentId: {type : "string", index : "not_analyzed"}
            "context.location.host": {type : "string", index : "not_analyzed"}
            "context.location.href": {type : "string", index : "not_analyzed"}
            "context.prevCtxScriptId": {type : "string", index : "not_analyzed"}
  .then ->
    return esclient.indices.putMapping
      type: "user"
      body:
        user:
          properties:
            email: {type : "string", index : "not_analyzed"}
            key: {type : "string", index : "not_analyzed"}
            'googleCredentials.access_token': {type : "string", index : "not_analyzed"}
            'googleCredentials.refresh_token': {type : "string", index : "not_analyzed"}
            'googleCredentials.token_type': {type : "string", index : "not_analyzed"}
            'googleCredentials.expiry_date': {type : "integer"}
  .then ->
    yamlhead = require('yamlhead')
    path = require('path')
    # Modifications to these scripts will be overwritten when the server restarts.
    return Promise.all([
      "contextScripts/createScript.md"
      "contextScripts/getText.md"
      "contextScripts/starfleet.md"
      "contextScripts/extractTables.md"
      "contextScripts/editGoogleSheet.md"
      "contextScripts/getLinks.md"
      "contextScripts/plotLocations.md"
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
                savedBy: "ContextScriptInit"
                lastModified: new Date()
                context: yaml
                # The first and last lines are markdown formatting.
                script: content.trim().split('\n').slice(1,-1).join('\n')
            .then(resolve)
            .catch(reject)
    )
  .then ->
    console.log "base scripts indexed"
  .then ->
    ipaddr = process.env.IP
    port = process.env.PORT
    app.listen port, ipaddr, ->
      console.log "#{Date.now()}: Node server started on #{ipaddr}:#{port} ..."
  .catch (e)->
    esclient.close()
    console.log("ERROR:", e)
