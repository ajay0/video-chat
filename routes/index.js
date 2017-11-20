var express = require('express');

var router = express.Router();

router.get('/', function(req, res) {
  res.redirect('/pages/login');
});

module.exports = router;