'use strict';

/**
 * @param {string} key
 * @param {Object} val
 * @return {Function} This is a valid middleware that attaches a new key
 *   value pair to the 'req' object 
 */
function attach(key, val) {
  return function(req, res, next) {
    req[key] = val;
    next();
  };
}

module.exports = attach;