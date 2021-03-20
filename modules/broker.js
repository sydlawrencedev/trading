var settings = require("../settings");

var broker = {
    getAccount: function(cb) {

    },
    getPositions: function(cb) {

    },
    getBars: function(symbol, cb) {

    },
    isOpen: function(openCb, closedCb) {

    }
}

broker = require("./brokers/" + settings.broker.name);


class Singleton {
    constructor() {
        return broker;
    }
}
module.exports = new Singleton();