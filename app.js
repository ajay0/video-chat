'use strict';

var express = require('express');
var https = require('https');
var http = require('http');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var fs = require('fs');
var path = require('path');

var signaling = require('./signaling/server');
var UserConnections = require('./signaling/userConnections');
var attach = require('./middlewares/attach');

var users = require('./routes/users');
var pages = require('./routes/pages');
var index = require('./routes/index');

var app = express();
var conns = new UserConnections();

app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(compression());
app.use('/static', express.static('public'));
app.use('/', attach('conns', conns));
app.use('/users', users);
app.use('/pages', pages);
app.use('/', index);

var options;
var secure = true;
try {
	options = {
		key: fs.readFileSync(path.join(__dirname, 'secure/server.key')),
		cert: fs.readFileSync(path.join(__dirname, 'secure/server.pem'))	
	};
} catch (err) {
	secure = false;
}

var httpServer;
if (secure) {
	console.log("Using https");
	httpServer = https.createServer(options, app);
} else {
	httpServer = https.createServer(app);
	console.log("Using http");
}

signaling.setUpWebSocketServer(httpServer, conns);

module.exports = httpServer;