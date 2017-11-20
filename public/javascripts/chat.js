'use strict';

var localUsername = '';

// A queue consisting of received offers. An offer (message) doesn't leave
// the queue until it is accepted or declined.
// The first offer from a user will always be in a modal waiting for user input
var pendingNewCallRequests = [];

var socket = {
  ws_url: 'ws' + location.protocol.substring(4) + '//' + window.location.host,
  ws: null
};

var call = {
  remoteUsername: '',
  pc: null,
  isActive: false,
  stream: null
};

/******************************* Miscellaneous - Begin ***************************/

/**
 * @return {string} The username of the user who is logged in
 */
function getUsername() {
  let allCookies = document.cookie;
  let requiredCookie = allCookies.split(';').find(function(cookie) {
    return (cookie.split('=')[0] === 'username');
  });
  return requiredCookie.split('=')[1];
}

/**
 * @param {string} msg The message to show on the webpage
 * @param {string} which Which logs to add the message to. Should be one of
 * 'call', 'internal'
 */
function addToLogs(msg, which) {
  let now = new Date();
  let displayTime = now.getHours() + ':' + now.getMinutes();
  $('#' + which + '-logs-list').append(
    '<li class="list-group-item">' + displayTime + ' - ' + msg + '</li>');
}

/**
 * Displays a modal whose content incluedes |msg|. Depending on the value
 * of 'type' the message might be present in an alert box
 *
 * @param {string} msg The message to show
 * @param {string} type Is one of possible alert box types or 'none' in
 * which case |msg| is displayed without any alert box
 */
function showNotice(msg, type) {
  if (type === 'none') {
    $('#template-modal-text').attr('class', '');
  } else {
    $('#template-modal-text').attr('class', 'alert alert-' + type);
  }
  $('#template-modal-text').html(msg);
  $('#template-modal').modal('show');
}

/**
 * Shows an alert box below the active users list with some text in it
 *
 * @param {string} msg The message to show. If empty, then the the alert
 * box is removed if present.
 * @param {string} type Is one of possible alert box types
*/
function showCallInfo(msg, type) {
  if (msg === '' ) {
    $('#current-call-info-alert').attr('class', '');
    $('#current-call-info-alert').html('');
  } else {
    $('#current-call-info-alert').attr('class', 'alert alert-' + type);
    $('#current-call-info-alert').html(msg);
  }
}

/**
 * @param {Object} msg The message to be sent to the server
 */
function sendToServer(msg) {
  socket.ws.send(JSON.stringify(msg));
}

function exitCall(send) {
  if (!call.isActive) {
    addToLogs('exitCall: no active call', 'internal');
    return;
  }

  showCallInfo('Disconnecting..', 'warning');

  if (send) {
    if (call.remoteUsername !== '') {
      sendToServer({
        to: call.remoteUsername,
        action: 'quit-call',
        payload: null
      });
    }
  }

  if (call.pc !== null) {
    call.pc.onicecandidate = null;
    if (call.pc.addTrack) {
      call.pc.ontrack = null;
    } else {
      call.pc.onaddstream = null;
    }
    call.pc.onnegotiationneeded = null;
    call.pc.oniceconnectionstatechange = null;
    call.pc.onconnectionstatechange = null;
    call.pc.close();
    call.pc = null;
  }

  let localVideo = document.getElementById('local-video');
  let remoteVideo = document.getElementById('remote-video');
  if (localVideo.srcObject) {
    localVideo.srcObject.getTracks().forEach(function (track) {
      track.stop();
    });
  }
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(function (track) {
      track.stop();
    });
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  $('#exit-call-button').css('display', 'none');
  showCallInfo('Successfully Disconnected', 'danger');

  addToLogs('Ended call with ' + call.remoteUsername, 'call');

  call.remoteUsername = '';
  call.isActive = false;
  call.stream = null;
}

function showNewCallRequest() {
  if (pendingNewCallRequests.length !== 0) {
    $('#incoming-call-username').html(pendingNewCallRequests[0].from);
    $('#incoming-call-modal').modal('show');
  }
}

/******************************* Miscellaneous - End ***************************/

/*********************** Peer Connection  - begin ***********************************/

function onIceCandidate(event) {
  if (event.candidate) {
    let message = {
      to: call.remoteUsername,
      action: 'ice-candidate',
      payload: event.candidate
    };
    sendToServer(message);
    addToLogs('onIceCandidate: ICE candidate sent to: ' + call.remoteUsername, 'internal');
  } else {
    addToLogs('onIceCandidate: ICE gathering finished', 'internal');
  }
}

function onTrack(event) {
  addToLogs('onTrack: Stream added by remote and that will be added locally', 'internal');
  document.getElementById('remote-video').srcObject = event.streams[0];
  showCallInfo('Successfully Connected', 'success');
}

function onAddStream(event) {
  document.getElementById('remote-video').srcObject = event.stream;
}

function onNegotiationNeeded(config) {
  addToLogs('onNegotiationNeeded: called/fired', 'internal');
  let msgToSend = {
    to: call.remoteUsername,
    action: 'offer',
    payload: null
  };
  if (!config) {
    config = {};
  }
  call.pc.createOffer(config).then(function(offer) {
    msgToSend.payload = offer;
    return call.pc.setLocalDescription(new RTCSessionDescription(offer));
  }).then(function() {
    // now ICE candidates will start gathering because of which iceCandidate
    // will be fired
    sendToServer(msgToSend);
    addToLogs('onNegotiationNeeded: Negotiation offer sent to: ' + call.remoteUsername, 'internal');
  }).catch(function(err) {
    addToLogs('onNegotiationNeeded: err in promise chain: ' + err, 'internal');
  });
}

function onIceConnectionStateChange(event) {
  addToLogs('onIceConnectionStateChange: ' + call.pc.iceConnectionState, 'internal');
  switch (call.pc.iceConnectionState) {
  case 'failed':
    addToLogs('onIceConnectionStateChange: ICE Restart', 'internal');
    onNegotiationNeeded({iceRestart: true});
  case 'disconnected':
    break;
  default:
    break;
  }
}

function onConnectionStateChange(event) {
  addToLogs('onConnectionStateChange: new state: ' + call.pc.connectionstate, 'internal');
}

function createRTCPeerConnection() {
  let config = {
    iceServers: [
      {
        urls: []
      }
    ]
  };
  call.pc = new RTCPeerConnection();
  call.pc.onicecandidate = onIceCandidate;
  if (call.pc.addTrack) {
    call.pc.ontrack = onTrack;
  } else {
    call.pc.onaddstream = onAddStream;
  }
  call.pc.onnegotiationneeded = null;
  call.pc.oniceconnectionstatechange = onIceConnectionStateChange;
  call.pc.onconnectionstatechange = onConnectionStateChange;
}


/*********************** Peer Connection  - end ***********************************/


/*************************** Active Users - Begin *********************************/

/**
 * Updates the active users list
 */
function updateActiveUsersList() {
  $.ajax({
    url: '/users/active',
    method: 'get',
    dataType: 'json',
    success: function(data, textStatus, jqXHR) {
      $('#active-users-list').html('');
      if (data.message === 'success') {
        for (let username of data.list) {
          $('#active-users-list').append(
            '<button type="button" class="list-group-item list-group-item-action">' + username + '</button>');
        }
      } else {
        addToLogs('updateActiveUsersList: Couldn\'t update active users list', 'internal');
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      addToLogs('updateActiveUsersList: Couldn\'t update active users list', 'internal');
    }
  });
}

function onClickActiveUser(event) {
  if (call.isActive) {
    showNotice('There already exists a call in progress', 'danger');
    return;
  }
  
  call.isActive = true;
  call.remoteUsername = event.target.textContent;
  addToLogs('Started call with ' + call.remoteUsername, 'call');
  let constraints = {
    video: {
      aspectRatio: {
        ideal: 16 / 9
      }
    },
    audio: true
  };
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    showCallInfo('Connecting..', 'warning');
    
    document.getElementById('local-video').srcObject = stream;
    call.stream = stream;
    $('#exit-call-button').css('display', 'block');

    sendToServer({
      to: call.remoteUsername,
      action: 'new-call-request',
      payload: null
    });
  }).catch(function(err) {
    addToLogs('Ended call with ' + call.remoteUsername, 'call');
    call.isActive = false;
    call.remoteUsername = '';
    showNotice('Error: You probably haven\'t given permissions to access video and audio<br>Details: getUserMedia error: ' + err, 'danger');
  });

}

/*************************** Active Users - End *********************************/

/*************************** Button Handlers - Begin *********************************/

function onClickExitCallButton(event) {
  exitCall(true);
}

function onClickLogoutButton(event) {
  addToLogs('onClickLogoutButton', 'internal');
  socket.ws.close(1000, 'Logout');
  socket.ws = null;

  if (call.isActive) {
    exitCall(true);
  }

  $.ajax({
    url: '/users/' + localUsername,
    method: 'delete',
    dataType: 'json',
    success: function(data, textStatus, jqXHR) {
      if (data.message === 'success') {
        window.location.replace('/');
      } else {
        showNotice('Couldn\'t logout', 'warning');
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      showNotice('Couldn\'t log out', 'warning');
    }
  });
}

function onClickIncomingCallAcceptButton(event) {
  if (call.isActive) {
    exitCall(true);
  }

  call.isActive = true;
  call.remoteUsername = pendingNewCallRequests[0].from;
  addToLogs('Started call with ' + call.remoteUsername, 'call');
  showCallInfo('Connecting..', 'warning');
  $('#exit-call-button').css('display', 'block');

  let msgToSend = {
    to: call.remoteUsername,
    action: 'new-call-request-accepted',
    payload: null
  };
  let constraints = {
    video: {
      aspectRatio: {
        ideal: 16 / 9
      }
    },
    audio: true
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    call.stream = stream;
    document.getElementById('local-video').srcObject = stream;

    createRTCPeerConnection();
    if (call.pc.addTrack) {
      stream.getTracks().forEach(function(track){
        call.pc.addTrack(track, stream);
      });
    } else {
      call.pc.addStream(stream);
    }

    sendToServer(msgToSend);
  }).catch(function(err) {
    addToLogs('Ended call with ' + call.remoteUsername, 'call');
    call.isActive = false;
    call.remoteUsername = '';
    
    showNotice('Error: You probably haven\'t given permissions to access video and audio<br>Details: getUserMedia error: ' + err, 'danger');
    showCallInfo('Disconnected', 'danger');
    $('#exit-call-button').css('display', 'none');
    
    msgToSend.action = 'new-call-request-declined';
    sendToServer(msgToSend);
    
    addToLogs('onClickIncomingCallAcceptButton: promise chain error: ' + err, 'internal');
  });
  pendingNewCallRequests.shift();
  showNewCallRequest();
}

function onClickIncomingCallDeclineButton(event) {
  let msg = {
    to: pendingNewCallRequests[0].from,
    action: 'new-call-request-declined',
    payload: null
  };
  sendToServer(msg);
  pendingNewCallRequests.shift();
  showNewCallRequest();
}

function onClickLocalVideoToggleButton(event) {
  if ($('#local-video').css('display') === 'none') {
    $('#local-video').css('display', 'block');
  } else {
    $('#local-video').css('display', 'none');
  }
}

/*************************** Button Handlers - End *********************************/


/*************************** Web Socket - Begin *********************************/

/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnOffer(msg) {
  if (call.isActive && msg.from === call.remoteUsername) {
    let msgToSend = {
      to: call.remoteUsername,
      action: 'answer',
      payload: null
    };
    call.pc.setRemoteDescription(new RTCSessionDescription(msg.payload)).then(function() {
      call.pc.onnegotiationneeded = onNegotiationNeeded;
      return call.pc.createAnswer();
    }).then(function(answer) {
      msgToSend.payload = answer;
      return call.pc.setLocalDescription(new RTCSessionDescription(answer));
    }).then(function() {
      sendToServer(msgToSend);
    }).catch(function(err) {
      addToLogs('wsOnOffer: promise chain error: ' + err, 'internal');
    });
  } else {
    addToLogs('wsOnOffer: unexpected message from: ' + msg.from, 'internal');
  }
}


/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnAnswer(msg) {
  if (call.isActive && call.remoteUsername === msg.from) {
    call.pc.setRemoteDescription(new RTCSessionDescription(msg.payload)).catch(function(err) {
      addToLogs('wsOnAnswer: setRemoteDescription error: ' + err, 'internal');
    });
  } else {
    addToLogs('wsOnAnswer: unexpected message from: ' + msg.from, 'internal');
  }
}

function wsOnNewCallRequest(msg) {
  if (pendingNewCallRequests.push(msg) === 1) {
    showNewCallRequest();
  }
}

function wsOnNewCallRequestAccepted(msg) {
  if (!call.isActive || (call.remoteUsername != msg.from)) {
    addToLogs('wsOnNewCallRequestAccepted: unexpected message from: ' + msg.from, 'internal');
    return;
  }

  createRTCPeerConnection();
  if (call.pc.addTrack) {
    call.stream.getTracks().forEach(function(track){
      call.pc.addTrack(track, call.stream);
    });
  } else {
    call.pc.addStream(call.stream);
  }
  onNegotiationNeeded();
  call.pc.onnegotiationneeded = onNegotiationNeeded;
}

/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnNewCallRequestDeclined(msg) {
  if (call.isActive && call.remoteUsername === msg.from) {
    exitCall(false);
    showCallInfo('Call Declined', 'danger');
  } else {
    addToLogs('wsOnOfferDeclined: unexpected message from: ' + msg.from, 'internal');
  }
}

/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnIceCandidate(msg) {
  if (call.isActive && call.remoteUsername === msg.from) {
    call.pc.addIceCandidate(new RTCIceCandidate(msg.payload)).then(function() {
      addToLogs('wsOnIceCandidate: ICE Candidate successfully added', 'internal');
    }).catch(function(err) {
      addToLogs('wsOnIceCandidate: addIceCandidate error: ' + err, 'internal');
    });
  } else {
    addToLogs('wsOnIceCandidate: unexpected message from: ' + msg.from, 'internal');
  }
}

/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnQuitCall(msg) {
  if (call.isActive && call.remoteUsername === msg.from) {
    exitCall(false);
  } else {
    addToLogs('wsOnQuitCall: unexpected message from: ' + msg.from, 'internal');
  }
}

/**
 * @param {Object} msg The message sent by a peer
 */
function wsOnError(msg) {
  addToLogs('wsOnError: message: ' + msg, 'internal');
}

function webSocketMessageHandler(event) {
  let msg = JSON.parse(event.data);
  addToLogs('ws: ' + ' message from: ' + msg.from + '<br>action: ' + msg.action + '<br>remote username: ' + call.remoteUsername, 'internal');
  switch (msg.action) {
  case 'offer':
    wsOnOffer(msg);
    break;
  case 'answer':
    wsOnAnswer(msg);
    break;
  case 'new-call-request':
    wsOnNewCallRequest(msg);
    break;
  case 'new-call-request-accepted':
    wsOnNewCallRequestAccepted(msg);
    break;
  case 'new-call-request-declined':
    wsOnNewCallRequestDeclined(msg);
    break;
  case 'ice-candidate':
    wsOnIceCandidate(msg);
    break;
  case 'quit-call':
    wsOnQuitCall(msg);
    break;
  case 'error':
    wsOnError(msg);
    break;
  default:
    addToLogs('Unknown message received from web socket', 'internal');
    break;
  }
}

/*************************** Web Socket - End *********************************/

$(document).ready(function() {
  localUsername = getUsername();

  // Web Socket
  socket.ws = new WebSocket(socket.ws_url);
  addToLogs('Created web socket connection', 'internal');

  socket.ws.onmessage = webSocketMessageHandler;
  socket.ws.onerror = function(err) {
    addToLogs('wserror: ' + err, 'internal');
  };

  $('#logout-button').on('click', onClickLogoutButton);

  $('#active-users-list').on('click', '.list-group-item', onClickActiveUser);

  $('#incoming-call-accept-button').on('click', onClickIncomingCallAcceptButton);

  $('#incoming-call-decline-button').on('click', onClickIncomingCallDeclineButton);

  $('#exit-call-button').on('click', onClickExitCallButton);

  $('#local-video-toggle-button').on('click', onClickLocalVideoToggleButton);

  // Update Active Users List
  updateActiveUsersList();
  setInterval(updateActiveUsersList, 3000);
});