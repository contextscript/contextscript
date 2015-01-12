#!/bin/env node
require('coffee-script/register');
var fs = require('fs');
var config = require('./config');
var esclient = require('./esclient');
var app = require('./app');

require('./esroutes');

app.get('/bookmarklet.js', function(req, res, next) {
  var markletConfig = {
    url: config.serverUrl
  };
  if(req.user) {
    markletConfig.user = req.user;
  }
  fs.readFile('bookmarklet.source.js', 'utf8', function(err, script){
    if(err) return next(err);
    fs.readFile('ctxscript-core.css', function(err, css){
      if(err) return next(err);
      var cssLoadCode = "var ss = document.createElement('link');";
      cssLoadCode += "ss.rel = 'stylesheet';";
      cssLoadCode += "ss.href = 'data:text/css," + escape(css) + "';";
      cssLoadCode += "document.documentElement.childNodes[0].appendChild(ss);\n";
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end(cssLoadCode + script + "(" + JSON.stringify(markletConfig) +")");
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

var ipaddr = process.env.IP;
var port = process.env.PORT;
app.listen(port, ipaddr, function() { 
  var createScriptCode = fs.readFileSync('createScript.js', 'utf8');
  esclient.index({
    index: 'contextscripts',
    type: 'contextscript',
    id: 'createScript',
    //This will probably cause perf problems
    refresh: true,
    body: {
      context: {
        published: true,
        q: "Create a script for this context"
      },
      //This is just a data field, not the script property
      //used by the update method.
      script: createScriptCode
    }
  }).then(function(){
    console.log("create script inserted");
  });
  console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ipaddr, port);
});
