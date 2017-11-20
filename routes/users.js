'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var uuidv4 = require('uuid/v4');

var router = express.Router();
var urlencodedParser = bodyParser.urlencoded({ extended: true });

router.post('/', urlencodedParser, function(req, res) {
  if (req.conns.isLoggedIn(req.cookies) || req.conns.has(req.body.username)) {
    res.json({'message': 'failure'});
  } else {
    let sessionId = uuidv4();
    req.conns.store(req.body.username, {'sessionId': sessionId, 'webSocket': null});
    res.cookie('username', req.body.username, {path: '/'});
    res.cookie('sessionId', sessionId, {path: '/'});
    res.json({'message': 'success'});
  }
});

router.delete('/:username', function(req, res) {
  if (req.conns.isLoggedIn(req.cookies) && 
    req.params.username == req.cookies.username) {
    // close webSocket if open
    let obj = req.conns.get(req.cookies.username);
    if (obj.webSocket) {
      //obj['webSocket'].close(200, 'Logout initiated');
    }

    // delete from list of connections
    req.conns.delete(req.cookies.username);
    res.clearCookie('username', {path: '/'});
    res.clearCookie('sessionId', {path: '/'});
    res.json({message: 'success'});
  } else {
    res.status(401).json({message: 'failure'});
  }
});

router.get('/active', function(req, res) {
  if (req.conns.isLoggedIn(req.cookies)) {
    let reqList = req.conns.getActiveUsers();
    let index = reqList.indexOf(req.cookies.username);
    reqList.splice(index, 1);
    res.json({
      message: 'success',
      list: reqList
    });
  } else {
    res.status(401).json({message: 'failure'});
  }
});

module.exports = router;