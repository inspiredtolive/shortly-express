var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var app = express();
var sess;


var passport = require('passport');
var GithubStrategy = require('passport-github2').Strategy;

passport.use(new GithubStrategy(
  {
    clientID: 'a321cce1e64b50b9401b',
    clientSecret: '823eba1ba38562a565fe23354271a440513e0ad3',
    callbackURL: 'http://127.0.0.1:4568/auth/github/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    // placeholder for translating profile into your own custom user object.
    // for now we will just use the profile object returned by GitHub
    // console.log('GITHUB PROFILE', profile);
    return done(null, profile);
  }
));
app.use(session({secret: 'ssshhhhh'}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  // placeholder for custom user serialization
  // null is for errors
  // console.log('serializeuser!!!', user);
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  // placeholder for custom user deserialization.
  // maybe you are getoing to get the user from mongo by id?
  // null is for errors
  // console.log('deserializeuser', user);
  done(null, user);
});


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)

app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//GITHUB GET REQS

// we will call this to start the GitHub Login process
app.get('/auth/github', passport.authenticate('github'));

//GitHub will call this URL
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect('/');
});

app.get('/logout', function(req, res) {
  console.log('logging out');
  req.logout();
  res.redirect('/login');
});

var ensureAuthenticated = function(req, res, next) {
  console.log(req.url, req.isAuthenticated());
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
};

//REST OF APP
app.get('/', ensureAuthenticated, function(req, res) {
  res.render('index');
});

app.get('/login', (req, res)=>{
  // res.redirect('/auth/github');
  // if (req.session.loginFail === 'true') {
  //   res.render('loginFail');  
  // } else {
  res.render('login');
  // }
});

// app.post('/login', (req, res)=>{
//   db.knex('users')
//     .where({username: req.body.username})
//     .then((rows)=>{
//       if (rows.length < 1) {
//         req.session.loginFail = 'true';
//         res.redirect('/login');
//       } else {
//         bcrypt.compare(req.body.password, rows[0].password, function(err, truth) {
//           console.log(rows[0].password);
//           if (truth) {
//             req.session.isValid = 'true';
//             req.session.loginFail = '';
//             res.redirect('/');
//           } else {
//             req.session.loginFail = 'true';
//             res.redirect('/login');
//           }
//         });
//       }
//     });
// });

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', (req, res) => {
  sess = req.session;
  new User({username: req.body.username, password: req.body.password})
    .save().then(()=>{
      console.log('User created... I think');
      sess.isValid = 'true';
      res.redirect('/');
    });
});

// app.get('/logout', (req, res)=> {
//   req.session.destroy((err)=> {
//     if (err) {
//       console.log(err);
//       res.sendStatus(500);
//       return;
//     }
//     res.redirect('/login');
//   });
// });

app.get('/create', ensureAuthenticated, 
function(req, res) {
  // util.checkUser(req, res);
});

app.get('/links', ensureAuthenticated,
function(req, res) {
  // if (req.session.isValid === 'true') {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
  // } else {
  //   res.redirect('/');
  // }
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
