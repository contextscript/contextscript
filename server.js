#!/bin/env node
var express = require('express');
var fs      = require('fs');
var _ = require('underscore')._;

//Database:
var mongo = require('mongoskin');
var db;
var config = require('./config');

var app  = express();

var passport = require('passport');

app.set('views', __dirname + '/authViews');
app.set('view engine', 'ejs');
//app.use(express.logger()); TODO: require('morgan')
//app.use(express.cookieParser());
app.use(bodyParser.json());
app.use(require('body-parser').urlencoded({ extended: true }));
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
    /*
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
    */
  });

});
app.post('/v0/scripts', function(req, res, next){
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  //TODO: Check key
  //TODO: Validation
  delete req.body.key;
  req.body.lastModified = new Date();
  db.collection('scripts').save(req.body, {
    upsert: true,
    safe: true
  }, function(err, result) {
    if(err) next(err);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(JSON.stringify({
      error: err,
      result: result
    }));
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

//  Get the environment variables we need.
var ipaddr, port;
if(config.openshift){
    ipaddr = process.env.OPENSHIFT_INTERNAL_IP;
    port = process.env.OPENSHIFT_INTERNAL_PORT || 8080;
} else {
    ipaddr = process.env.IP;
    port = process.env.PORT;
}

if (typeof ipaddr === "undefined") {
   console.warn('No OPENSHIFT_INTERNAL_IP environment variable');
}

//  terminator === the termination handler.
function terminator(sig) {
   if (typeof sig === "string") {
      console.log('%s: Received %s - terminating Node server ...',
                  Date(Date.now()), sig);
      process.exit(1);
   }
   console.log('%s: Node server stopped.', Date(Date.now()) );
}

//  Process on exit and signals.
process.on('exit', function() { terminator(); });

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'
].forEach(function(element, index, array) {
    process.on(element, function() { terminator(element); });
});

app.listen(port, ipaddr, function() { 
    var reinit = true;
    db = mongo.db("mongodb://" + config.databaseUrl);
    db.dropCollection('scripts');
    db.createCollection('scripts', function(err, collection) {
      var createScriptCode = fs.readFileSync('createScript.js', 'utf8');
      db.collection('scripts').insert({
        context: {
          platform: { javascript: true },
          q: "Create a script for this context"
        },
        script: createScriptCode
      }, {
        upsert: true,
        safe: true
      },
      function(err, result) {
        if(err) {
          throw err;
        }
        console.log("create script inserted");
        db.collection('scripts').ensureIndex( { 'context.q': "text" }, function(){});
        
      });
    });
    db.createCollection('users', function(err, collection) {
        if(reinit){
          db.collection('users').remove(function() {
            console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ipaddr, port);
          });
        } else {
          console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ipaddr, port);
        }
    });
});
