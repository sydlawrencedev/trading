var settings = require("../../settings");

const Alpaca = require('@alpacahq/alpaca-trade-api');
const logger = require("../logger");

process.env.APCA_API_KEY_ID = settings.broker.keys.key;
process.env.APCA_API_SECRET_KEY = settings.broker.keys.secret;
process.env.APCA_API_BASE_URL = settings.broker.keys.endpoint;

const alpaca = new Alpaca({
    usePolygon: false
});

var broker = {
    getAccount: function(cb) {
        alpaca.getAccount().then(cb);
    },
    getPosition: function(stock, cb) {
        alpaca.getPosition(stock).then(cb);
    },
    getPositions: function(cb) {
        alpaca.getPositions().then(cb);
    },
    getBars: function(symbol, cb) {
        alpaca.getBars(settings.timeRange, symbol).then(cb);
    },
    isOpen: function(openCb, closedCb) {
        alpaca.getClock().then(clock => {
            if (clock.is_open) {
                openCb();
            } else {
                openCb();
            }
        })
    },
    createOrder: function(order, stock, qty, limitPrice, stopLoss) {

        try {
            return alpaca.createOrder({
                symbol: stock, // any valid ticker symbol
                qty: Math.max(1, qty),
                side: order,
                type: 'market',
                time_in_force: 'day',
                take_profit: {
                    limit_price: limitPrice
                },
                stop_loss: {
                    stop_price: stopLoss
                },
            })
        } catch (e) {
            logger.error(["ERROR", e.message])
        }
    }
}

class Singleton {
    constructor() {
        return broker;
    }
}
module.exports = new Singleton();