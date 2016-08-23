var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var hasher = Promise.promisify(bcrypt.hash.bind(bcrypt));

var User = db.Model.extend({
  tableName: 'users',
  initialize: function () {
    this.on('saving', (model, attrs, options) => {
      return hasher(model.get('password'), null, null)
        .then((hash)=>{
          console.log(hash);
          model.set('password', hash);
        });
    });
  }
});

module.exports = User;