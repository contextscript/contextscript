var express = require('express');
var passport = require('passport');
var bodyParser = require('body-parser');

var app = express();
module.exports = app;
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
