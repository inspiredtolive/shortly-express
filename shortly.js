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


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(session({secret: 'ssshhhhh'}));
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
  util.checkUser(req, res);
});

app.get('/login', (req, res)=>{
  if (req.session.loginFail === 'true') {
    res.render('loginFail');  
  } else {
    res.render('login');
  }
});

app.post('/login', (req, res)=>{
  db.knex('users')
    .where({username: req.body.username})
    .then((rows)=>{
      if (rows.length < 1) {
        req.session.loginFail = 'true';
        res.redirect('/login');
      } else {
        bcrypt.compare(req.body.password, rows[0].password, function(err, truth) {
          console.log(rows[0].password);
          if (truth) {
            req.session.isValid = 'true';
            req.session.loginFail = '';
            res.redirect('/');
          } else {
            req.session.loginFail = 'true';
            res.redirect('/login');
          }
        });
      }
    });
});

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

app.get('/logout', (req, res)=> {
  req.session.destroy((err)=> {
    if (err) {
      console.log(err);
      res.sendStatus(500);
      return;
    }
    res.redirect('/login');
  });
});

app.get('/create', 
function(req, res) {
  util.checkUser(req, res);
});

app.get('/links', 
function(req, res) {
  if (req.session.isValid === 'true') {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  } else {
    res.redirect('/');
  }
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
