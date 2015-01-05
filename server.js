#!/bin/env node
var express = require('express');
var fs      = require('fs');

//Database:
var mongo = require('mongoskin');
var db;
var config = require('./config');

var elasticsearch = require('elasticsearch');
var esclient = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'trace'
});

var app  = express();

var passport = require('passport');
var bodyParser = require('body-parser');

app.set('views', __dirname + '/authViews');
app.set('view engine', 'ejs');
//app.use(express.logger()); TODO: require('morgan')
//app.use(express.cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(express.methodOverride());
//app.use(express.session({ secret: 'keyboard cat' }));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
//app.use(passport.initialize());
//app.use(passport.session());
//app.use(app.router);
app.use(express.static(__dirname + '/static'));
//error handling should come last
//app.use(express.errorHandler({showStack: true, dumpExceptions: true}));


//require('./login').attachRoutes(app);

/*  =====================================================================  */
/*  Setup route handlers.  */
/*  =====================================================================  */

// Handler for GET /health
app.get('/health', function(req, res){
    res.send('1');
});

app.post('/v0/search', function(req, res, next){
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  esclient.search({
    index: 'contextscripts',
    body: {
      query: {
        match: {
          'context.q': req.body.context.q
        }
      }
    }
  }).then(function(result){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(JSON.stringify(result.hits));
  });
  /*
  var query = {
    $text: { $search: req.body.context.q }
  };
  if(req.body.context.url) {
    query.$or = [
      {'context.url' : {$exists: false}},
      {'context.url' : req.body.context.url}
    ];
  }
  db.collection('scripts').find(query, {
    score: { $meta: "textScore" }
  })
  .toArray(function(err, hits) {
    if(err) {
      // res.end(JSON.stringify({
      //   error : err
      // }));
      // return;
      next(err);
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(JSON.stringify({
      hits: hits
    }));

    res.end(JSON.stringify({
      result: result.filter(function(sResult){
        var s = sResult.trigger;
        var captures = [];
        var ucRegex = s.replace(/\{\{\w+\}\}/g, function(cap){
          captures.push(cap.slice(2,cap.length - 2));
          return "(\\w+)";
        });
        var matches = q.match(new RegExp(ucRegex));
        if(!matches) return false;
        matches = matches.slice(1);
        if(matches.length !== captures.length) return false;
        var parse = {};
        captures.forEach(function(capture, idx){
          parse[capture] = matches[idx];
        });
        sResult.parse = parse;
        return true;
      })
    }));
    
  });
  */
});
app.post('/v0/scripts', function(req, res, next){
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  //TODO: Check key
  //TODO: Validation
  // Index is used so that the whole document is replaced
  esclient.index({
    index: 'contextscripts',
    type: 'contextscript',
    id: req.body._id,
    //This will cause perf problems
    refresh: true,
    body: {
      context: req.body.context,
      script: req.body.script,
      lastModified: new Date()
    }
  }).then(function(result) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(JSON.stringify(result));
  });
});
if(config.debug){
    //I want most debug functions to be public,
    //however I'm going to draw a line for now at dumping the entire database.
    app.get('/dbg', function(req, res, next) {
        db.collection('langNodes').find().toArray(function(err, items){
            if(err) {
                next(err);
                return;
            }
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(items));
        });
        return;
    });
    app.get('/dbgf', function(req, res, next) {
        db.collection('files').find().toArray(function(err, items){
            if(err) {
                next(err);
                return;
            }
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(items));
        });
        return;
    });
    app.get('/bookmarklet.js', function(req, res, next) {
      fs.readFile('bookmarklet.source.js', 'utf8', function(err, script){
        if(err) return next(err);
        fs.readFile('ctxscript-core.css', function(err, css){
          if(err) return next(err);
          var cssLoadCode = "var ss = document.createElement('link');";
          cssLoadCode += "ss.rel = 'stylesheet';";
          cssLoadCode += "ss.href = 'data:text/css," + escape(css) + "';";
          cssLoadCode += "document.documentElement.childNodes[0].appendChild(ss);\n";
          res.writeHead(200, {'Content-Type': 'text/javascript'});
          res.end(cssLoadCode + script);
        });
      });
    });
    app.get('/main.js', function(req, res, next) {
      fs.readFile('ctxscriptClientMain.js', 'utf8', function(err, data){
        if(err) return next(err);
        
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(data);
      });
    });
    app.get('/ctxscript.css', function(req, res, next) {
      fs.readFile('ctxscript.css', 'utf8', function(err, data){
        if(err) return next(err);
        
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.writeHead(200, {'Content-Type': 'text/css'});
        res.end(data);
      });
    });
}

app.get('/', function(req, res, next){
  fs.readFile('index.html', 'utf8', function(err, data){
    if(err) return next(err);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});

var ipaddr = process.env.IP;
var port = process.env.PORT;

app.listen(port, ipaddr, function() { 
  //var reinit = true;
  db = mongo.db("mongodb://" + config.databaseUrl);
  //db.dropCollection('scripts');
  esclient.indices.exists({index:'scripts'})
  .then(function(itExists){
    if(!itExists) {
      return esclient.indices.create({index:'scripts'});
    } else {
      return true;
    }
  })
  .then(function(result) {
    var createScriptCode = fs.readFileSync('createScript.js', 'utf8');
    return esclient.index({
      index: 'contextscripts',
      type: 'contextscript',
      id: 'createScript',
      //This will probably cause perf problems
      refresh: true,
      body: {
        context: {
          platform: { javascript: true },
          q: "Create a script for this context"
        },
        //This is just a data field, not the script property
        //used by the update method.
        script: createScriptCode
      }
    });
  })
  .then(function(){
    console.log("create script inserted");
  });
  // db.createCollection('users', function(err, collection) {
  //     if(reinit){
  //       db.collection('users').remove(function() {
  //         console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ipaddr, port);
  //       });
  //     } else {
  //       console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ipaddr, port);
  //     }
  // });
});
