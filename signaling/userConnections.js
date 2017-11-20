'use strict';

class UserConnections {
  // Logged in users are those who have a valid 'username', 'sessionId' pair
  // in 'this.connections'. Active users are those who are logged in and have a
  // valid (non null) 'webSocket' value. The value of 'webSocket' is actually an
  // instance of the class 'ws.WebSocket'
  constructor() {
    this.connections = new Map();
  }

  /**
   * @param {string} username
   * @param {val} Object
   * @return {boolean} 'true' if 'username' exists
   */
  store(username, val) {
    if (this.connections.has(username)) {
      return false;
    }
    this.connections.set(username, val);
    return true;
  }

  /**
   * @param {string} username
   * @param {string} key
   * @param {Object|null} value
   * @return {boolean} 'true' if |username| doesn't already exist
   */
  update(username, key, value) {
    if (!this.connections.has(username)) {
      return false;
    }
    let old = this.connections.get(username);
    old[key] = value;
    this.connections.delete(username);
    this.connections.set(username, old);
    return true;
  }

  /**
   * @param {string} username
   * @return {boolean}
   */
  has(username) {
    return this.connections.has(username);
  }

  /**
   * @param {string} username
   * @return {Object|undefined}
   */
  get(username) {
    return this.connections.get(username);
  }

  /**
   * @param {string} username
   * @return {boolean} 'true' if 'username' exists
   */
  delete(username) {
    this.connections.delete(username);
  }

  /**
   * @return {Array} List of usernames
   */
  getActiveUsers() {
    let list = [];
    for (let [username, obj] of this.connections) {
      if (obj.webSocket) {
        list.push(username);
      }
    }
    console.log(list);
    return list;
  }

  /**
   * @param {string} username
   * @return {boolean}
   */
  isActive(username) {
    return (this.connections.has(username) && this.connections.get(username).webSocket);
  }

  /**
   * @param {Object} cookies
   * @return {boolean}
   */
  isLoggedIn(cookies) {
    return (cookies.username && cookies.sessionId &&
      this.has(cookies.username) &&
      this.get(cookies.username).sessionId == cookies.sessionId);
  }
}

module.exports = UserConnections;