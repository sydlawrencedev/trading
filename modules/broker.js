// var fs = require("fs");
var https = require("https");
var settings = require("../settings");
// var MarketData = require('./marketdata');
// var Trade = require('./trade');
// const moment = require('moment');
// const tickers = require('./tickers');
// const logger = require('./logger');

// const Alpaca = require('@alpacahq/alpaca-trade-api')

// try {
//     const alpaca = new Alpaca({
//         usePolygon: false
//     });
// } catch (e) {}
const querystring = require('querystring');


Broker = function(broker = false) {
    if (broker) {
        this.broker = broker;
    }
    if (settings.isCrypto) {

        const FTXRest = require('ftx-api-rest');

        const ftx = new FTXRest({
            key: settings.ftx.key,
            secret: settings.ftx.secret,
            subaccount:  settings.ftx.subaccount
        });
        this.broker = {
            getBars: function(range, symbols) {
                return ftx.request({
                    method: 'GET',
                    path: '/markets/BTC/USD/candles?resolution='+settings.cryptoDelay+'&limit=40',
                });
            },
            getAccount: function() {
                return ftx.request({
                    method: 'GET',
                    path: '/account'
                });
            },
            getPositions: async function() {
                return ftx.request({
                    method: 'GET',
                    path: '/wallet/balances',
                    
                });
            },
            getPosition: async function(stock) {
                var x = 0;
                return ftx.request({
                    method: 'GET',
                    path: '/wallet/balances',
                    
                })
            },
            getSpotPrice: async function(ticker) {
                return ftx.request({
                    method: 'GET',
                    path: '/markets/'+ticker,
                });
            },
            createOrder: async function(order, stock, qty, currentPrice) {
                qty = Math.floor(qty * 10000) / 10000
                if (qty < 0.0001) {
                    return;
                }
                console.log(order, qty,currentPrice);
                var options = {
                    method: 'POST',
                    path: '/orders',
                    data: {
                        'market': "BTC/USD",
                        'side': order,
                        'size': qty,
                        'type': "limit",
                        'price': currentPrice
                    }
                }

                return ftx.request(options)
            }
        }
        // console.log(this.broker.getAcccount());
    } else {
        process.env.APCA_API_KEY_ID = settings.alpaca.key;
        process.env.APCA_API_SECRET_KEY = settings.alpaca.secret;
        process.env.APCA_API_BASE_URL = settings.alpaca.endpoint;

        const Alpaca = require('@alpacahq/alpaca-trade-api');

        this.broker = new Alpaca({
            usePolygon: false
        });
    }
}
Broker.prototype.getBars = function(range, symbols) {
    return this.broker.getBars(range, symbols);
}
Broker.prototype.getAccount = function() {
    return this.broker.getAccount();
}
Broker.prototype.getPositions = function() {
    return this.broker.getPositions();
}
Broker.prototype.getPositions = function() {
    return this.broker.getPositions();
}
Broker.prototype.getSpotPrice = async function(ticker) {
    return this.broker.getSpotPrice(ticker);
}
Broker.prototype.getPosition = function(stock) {
    return this.broker.getPosition(stock);
}
Broker.prototype.createOrder = async function(order, stock, qty, currentPrice) {
    if (settings.isCrypto) {
        return this.broker.createOrder(order,stock,qty,currentPrice);
    } else {
        return this.broker.createOrder({
            symbol: stock, // any valid ticker symbol
            qty: Math.max(1,qty),
            side: order,
            type: 'market',
            time_in_force: 'day',
            take_profit: {
                limit_price: take_profit
            },
            stop_loss: {
                stop_price: stop_loss
            },
        })
    }
}
Broker.prototype.ifOpen = function(cb, elseCb) {
    if (settings.isCrypto) {
        cb();
    } else {
        alpaca.getClock().then((clock) => {
            if (clock.is_open) {
                cb();
            } else {
                elseCb();
            }
        });
    }
}




module.exports = Broker;