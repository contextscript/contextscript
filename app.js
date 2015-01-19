var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var PersonaStrategy = require('passport-persona').Strategy;
var methodOverride = require('method-override');
var session = require('express-session');
var config = require('./config');
var partials = require('express-partials');
var esclient = require('./esclient');
var uuid = require('node-uuid');

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.email);
});

passport.deserializeUser(function(email, done) {
  esclient.search({
      index: "users",
      body: {
        query: {
          term: {
            email: email
          }
        }
      }
    }).then(function(result){
      if(result.hits.hits.length === 0) return done("No user found");
      var userInfo = result.hits.hits[0]._source;
      userInfo.id = result.hits.hits[0]._id;
      done(null, userInfo);
    }).catch(done);
});

passport.use(new PersonaStrategy({
    audience: config.serverUrl
  }, function(email, done) {
    esclient.search({
      index: "users",
      body: {
        query: {
          term: {
            email: email
          }
        }
      }
    }).then(function(result) {
      var userInfo;
      userInfo = {
        email: email
      };
      if (result.hits.hits.length === 0) {
        userInfo.key = uuid.v4();
        //TODO: TOS
        return esclient.index({
          index: "users",
          type: "user",
          refresh: true,
          body: userInfo
        }).then(function(createUserResult){
          userInfo.id = createUserResult._id;
          done(null, userInfo);
        });
      } else if (result.hits.hits.length === 1) {
        userInfo = result.hits.hits[0]._source;
        userInfo.id = result.hits.hits[0]._id;
        return done(null, userInfo);
      } else {
        return done("error");
      }
    }).catch(done);
  }
));

var app = express();
module.exports = app;

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
//logging
app.use(require('morgan')('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(session({ secret: config.sessionSecret }));
app.use(passport.initialize());
app.use(passport.session());
//app.use(app.router);
app.use(express.static(__dirname + '/static'));
app.use(partials());
app.use(function(err, req, res, next) {
  if (req.xhr) {
    res.status(500).send({ error: 'Something blew up!' });
  } else {
    next(err);
  }
});

app.get('/', function(req, res){
  res.render('index', {
    user: req.user,
    config: {
      url: config.serverUrl,
      user: req.user
    }
  });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.post('/auth/browserid', 
passport.authenticate('persona', { failureRedirect: '/login' }),
function(req, res) {
  res.redirect(req.query.redirect ? req.query.redirect : '/');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
