#!/bin/env node
require('coffee-script/register');
var fs = require('fs');
//Database:;
var mongo = require('mongoskin');
var db;
var config = require('./config');
var esclient = require('./esclient');
var app = require('./app');

require('./esroutes');

//require('./login').attachRoutes(app);

app.get('/bookmarklet.js', function(req, res, next) {
  var urserConfig = {
    user: 'nathan',
    key: '123',
    // This could be a list of urls for context script servers
    // so they can be combined...
    url: config.serverUrl
  };
  fs.readFile('bookmarklet.source.js', 'utf8', function(err, script){
    if(err) return next(err);
    fs.readFile('ctxscript-core.css', function(err, css){
      if(err) return next(err);
      var cssLoadCode = "var ss = document.createElement('link');";
      cssLoadCode += "ss.rel = 'stylesheet';";
      cssLoadCode += "ss.href = 'data:text/css," + escape(css) + "';";
      cssLoadCode += "document.documentElement.childNodes[0].appendChild(ss);\n";
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end(cssLoadCode + script + "(" + JSON.stringify(urserConfig) +")");
    });
  });
});
var mainJs = fs.readFileSync('ctxscriptClientMain.js', 'utf8');
app.get('/main.js', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.writeHead(200, {'Content-Type': 'text/javascript'});
  res.end(mainJs);
});
var ctxscriptCss = fs.readFileSync('ctxscript.css', 'utf8');
app.get('/ctxscript.css', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.writeHead(200, {'Content-Type': 'text/css'});
  res.end(ctxscriptCss);
});
var indexHtml = fs.readFileSync('index.html', 'utf8');
app.get('/', function(req, res, next){
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(indexHtml);
});
var ipaddr = process.env.IP;
var port = process.env.PORT;

app.listen(port, ipaddr, function() { 
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
  }).then(function(){
    console.log("create script inserted");
  });
  //var reinit = true;
  //db = mongo.db("mongodb://" + config.databaseUrl);
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
