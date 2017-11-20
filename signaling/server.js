'use strict';

var ws = require('ws');

/************************************ Helper Functions *********************************************/
/**
 * @param {string} cookies String as received from the Cookie header in a
 *   response
 * @return {Object} Object Object representation of the cookie
 */
function createCookieObj(cookies) {
  if (!cookies) {
    return {};
  }
  let allCookies = cookies.split(';');
  let allCookiesObj = {};
  for (let cookie of allCookies) {
    cookie = cookie.split('=');
    allCookiesObj[cookie[0].replace(/\s/g, '')] = cookie[1];
  }
  return allCookiesObj;
}

/**
 * Checks is an array contains an object
 * @param {Array} arr
 * @param {Object} obj
 * @return {boolean} 'true' if the array contains the object
 */
function arrayContains(arr, obj) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === obj) {
      return true;
    }
  }
  return false;
}

/**************************************************************************************************/

function genResponse(from, action, payload) {
  return JSON.stringify({
    from: from,
    action: action,
    payload: payload
  });
}

/**
 * Checks is a message sent by some client is valid
 * @param {string} message
 * @param {Object} conns An instance of 'UserConnections'
 * @return {boolean} 'true' if 'message' is valid
 */
function isValid(message, conns) {
  let jsonMessage = '';
  try {
    jsonMessage = JSON.parse(message);
  } catch (e) {
    return false;
  }
  let validActions = ['offer', 'ice-candidate', 'answer', 'new-call-request', 'new-call-request-accepted', 'new-call-request-declined', 'quit-call'];
  if (Object.keys(jsonMessage).length === 3
    && jsonMessage.to && jsonMessage.action
    && arrayContains(validActions, jsonMessage.action)
    && conns.isActive(jsonMessage.to)) {
    return true;
  } else {
    return false;
  }
}

/**
 * @param {string} webSocket The websocket associated with the user
 * who sent the message
 * @param {string} username The user who has sent the message
 * @param {string} message The actual message
 * @param {Object} conns An instance of 'UserConnections'
 */
function messageHandler(webSocket, username, message, conns) {
  if (!webSocket) {
    conns.update(username, 'webSocket', null);
    return;
  }
  if (!isValid(message, conns)) {
    webSocket.send(genResponse('', 'error', 'Invalid Message'));
    return;
  }
  let jsonMessage = JSON.parse(message);
  jsonMessage.from = username;
  let to = jsonMessage.to;
  delete jsonMessage.to;
  conns.get(to).webSocket.send(JSON.stringify(jsonMessage));
}

function setUpWebSocketServer(httpServer, conns) {
  let wss = new ws.Server({ server: httpServer });
  wss.on('connection', function(webSocket, request) {
    let allCookies = createCookieObj(request.headers.cookie);

    if (conns.isLoggedIn(allCookies)) {
      // webSocket is rewritten if the chat page is reloaded
      conns.update(allCookies.username, 'webSocket', webSocket);

      webSocket.on('close', function(code, reason) {
        console.log('******************************Web Socket closed. Code:', code, 'Reason:', reason);
        conns.update(allCookies.username, 'webSocket', null);
      });

      webSocket.on('message', function(message) {
        console.log('Web Socket Message from:', allCookies.username, '|content:', message);
        messageHandler(webSocket, allCookies.username, message, conns);
      });

      webSocket.on('error', function(error) {
        console.log('Web Socket error:', error);
      });
    } else {
      webSocket.close(1002, 'Authentication Failed');
    }
  });
}

module.exports = {
  setUpWebSocketServer: setUpWebSocketServer
};