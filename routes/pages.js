'use strict';

var express = require('express');
var path = require('path');

var router = express.Router();

router.get('/login', function(req, res) {
  if (req.conns.isLoggedIn(req.cookies)) {
    res.redirect('/pages/chat');
  } else {
    res.sendFile(path.join(__dirname, '../views/login.html'));
  }
});

router.get('/chat', function(req, res) {
  if (req.conns.isLoggedIn(req.cookies)) {
    res.render('chat', {username: req.cookies.username});
  } else {
    res.redirect('/pages/login');
  }
});

module.exports = router;