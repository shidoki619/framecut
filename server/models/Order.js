const store = require('../db/store');

module.exports = store.Order;
module.exports.getThreadMessages = require('../lib/orders').getThreadMessages;