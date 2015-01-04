var express = require('express')
  , passport = require('passport')
  , config = require('./config')
  , GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Google profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GoogleStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Google
//   profile), and invoke a callback with a user object.
passport.use(new GoogleStrategy({
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: config.serverUrl + "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    /*
    db.collection('users').findOrCreate(profile, function(err, user) {
      done(err, user);
    });
    */
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's Google profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Google account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

var app = express.createServer();

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
};

exports.attachRoutes = function(app){
    app.get('/requestAccess', function(req, res){
      res.render('requestAccess', { sessionId: req.params.sessionId, user: req.user });
    });
    
    app.get('/account', ensureAuthenticated, function(req, res){
      res.render('account', { user: req.user });
    });
    
    app.get('/login', function(req, res){
      res.render('login', { user: req.user });
    });
    
    // GET /auth/google
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  The first step in Google authentication will involve
    //   redirecting the user to google.com.  After authorization, Google
    //   will redirect the user back to this application at /auth/google/callback
    app.get('/auth/google',
      passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                                'https://www.googleapis.com/auth/userinfo.email'] }),
      function(req, res){
        // The request will be redirected to Google for authentication, so this
        // function will not be called.
      });
    
    // GET /auth/google/callback
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  If authentication fails, the user will be redirected back to the
    //   login page.  Otherwise, the primary route function function will be called,
    //   which, in this example, will redirect the user to the home page.
    app.get('/auth/google/callback', 
      passport.authenticate('google', { failureRedirect: '/login' }),
      function(req, res) {
        res.redirect('/requestAccess');
      });
    
    app.get('/logout', function(req, res){
      req.logout();
      res.redirect('/requestAccess');
    });
};

