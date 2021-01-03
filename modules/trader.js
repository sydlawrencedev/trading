var moment = require("moment");
var chalk = require("chalk");
var settings = require("../settings");
var tickers = require('./tickers');
var MarketData = require('./marketdata');
var Trade = require('./trade');
var logger = require('./logger');
var portfolio = require('./portfolio');
var cache = require('persistent-cache');
var myCache = cache();


const Alpaca = require('@alpacahq/alpaca-trade-api')

process.env.APCA_API_KEY_ID = settings.alpaca.key;
process.env.APCA_API_SECRET_KEY = settings.alpaca.secret;
process.env.APCA_API_BASE_URL = settings.alpaca.endpoint;

const alpaca = new Alpaca({
    usePolygon: false
});
const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.

var supportPartialShares = settings.supportPartialShares;

var trader = {
    strategies: [],
    stocks: {},
    portfolio: portfolio
}

trader.addStocks = async function(stocks) {
    for (var i = 0; i < stocks.length; i++) {
        await this.addStock(stocks[i]);
    }
    return this;
}

trader.getLastTradeTime = async function() {
    var m = myCache.getSync("last-trade-time");
    if (m) {
        return Math.max(moment(settings.tradingStart), moment(m));
    }
    return moment(settings.tradingStart);
}

trader.saveLastTradeTime = function() {
    myCache.putSync("last-trade-time", moment())
}

trader.backtest = async function(andThenPerformTrades = false) {
    return await this.determineTrades(andThenPerformTrades);
}

trader.determineTrades = async function(andThenPerformTrades = false) {
    logger.setup("Determining possible trades")
    var combinedStockData = {};
    var combinedTrades = [];
    for (i in this.stocks) {
        try {
            var stockData = this.stocks[i];
            
            stockData = stockData.withSeries({
                sellOut: stockData => stockData.select(row => (row.sellSignal > settings.thresholds.sell)),
                buyIn: stockData => stockData.select(row => row.buySignal > settings.thresholds.buy)
            });
    
            const buyInMoment = stockData.rollingWindow(2) // Group into lots of 7 (for 7 days).
                .select(window => {
                    return [ window.last().time, 
                        (window.last().isHolding && !window.first().isHolding) ? true : undefined
                    ]; 
                })
                .withIndex(pair => pair[0]) // Promote index.
                .select(pair => pair[1]); // Restore values.

            const sellOutMoment = stockData.window(2) // Group into lots of 7 (for 7 days).
                .select(window => {
                    return [ window.last().time, 
                        !window.last().isHolding && window.first().isHolding ? true : undefined
                    ]; 
                })
                .withIndex(pair => pair[0]) // Promote index.
                .select(pair => pair[1]); // Restore values.

            stockData = stockData.withSeries({
                ticker: stockData.deflate(row => i),
                buyInMoment: buyInMoment,
                sellOutMoment: sellOutMoment,
                buyInAmount: stockData => stockData.select(row => (row.buyInMoment) ? trader.getBuyInValue(row.buySignal) : 0),
            });

            

            var holdings = [];
            var boughtInPrices = [];
            var previousRow;
            var previousHolding;
            var previousBuyInPrice = undefined;
            for (const row of stockData) {
                var isNowHolding = false;
                var stopLoss = false;
                var limitOrder = false;
                if (previousHolding == true) {
                    isNowHolding = true;
                }
                if (row.buyIn) {
                    isNowHolding = true;
                    if (previousBuyInPrice === undefined) {
                        previousBuyInPrice = row.close;
                    }
                }

                if (previousRow && previousRow.sellOut && !row.buyIn) {
                    isNowHolding = false;
                    previousBuyInPrice = undefined;
                }
                var strategy = this.strategies[0];

                if (isNowHolding && strategy.stopLoss !== undefined) {
                    if (((row.open - previousBuyInPrice) / previousBuyInPrice) <= strategy.stopLoss) {
                        stopLoss = Math.round((row.open - previousBuyInPrice) / previousBuyInPrice * 1000)/10 + "%";
                    }
                }

                if (isNowHolding && strategy.limitOrder !== undefined) {
                    if (((row.open - previousBuyInPrice) / previousBuyInPrice) >= strategy.limitOrder) {
                        limitOrder = Math.round((row.open - previousBuyInPrice) / previousBuyInPrice * 1000)/10 + "%";
                    }
                }

                holdings.push({time: row.time, limitOrder:limitOrder, stopLoss: stopLoss, isHolding: isNowHolding, previousBuyInPrice: previousBuyInPrice});
                previousRow = row;
                previousHolding = isNowHolding;
                // Do something with row.
            }
            holdings = new dataForge.DataFrame({
                values: holdings
            }).setIndex("time");

            stockData = stockData.withSeries({
                boughtShares: stockData => stockData.select(row => (row.buyInMoment) ? (supportPartialShares) ? row.buyInAmount / row.close : Math.floor(row.buyInAmount / row.close) : 0),
                previousBuyInPrice: holdings.deflate(row => row.previousBuyInPrice),
                stopLoss: holdings.deflate(row => row.stopLoss),
                limitOrder: holdings.deflate(row => row.limitOrder),
                isHolding: holdings.deflate(row => row.isHolding)
            });

            var tradesData = stockData.where(row => (row.buyIn || (row.isHolding && row.sellOut) || (row.isHolding && row.stopLoss) || (row.isHolding && row.limitOrder)));
            
            for (const trade of tradesData) {
                combinedTrades.push(trade);
            }

            logger.setup([i,tradesData.count() + " possible trades"]);
            
            combinedStockData[i] = stockData;
        } catch (e) {
            logger.error([
                "ERROR",
                i,
                e.message
            ]);

        }
    }    

    if (combinedTrades.length === 0) {
        logger.setup("no possible trades?");
    }

    // tradesData = tradesData.subset(["time", "buyIn", "isHolding", "sellOut", "open", "close"]);
    combinedTrades = combinedTrades.sort((a,b) => { 
        if (a.time == b.time) 
            return (a.buySignal > b.buySignal) ? 1 : -1
        return a.time > b.time ? 1 : -1
    });
    if (andThenPerformTrades) {
        this.performTrades(combinedStockData, combinedTrades);
    }
    return combinedTrades;
}

trader.performTrades = function(combinedStockData, combinedTrades) {

    logger.status("Performing trades");
    
    for (const trade of combinedTrades) {
        if (trade.sellOut || trade.stopLoss || trade.limitOrder) {
            var reason = trade.sellReason;
            if (trade.stopLoss) {
                reason = "Stop loss: " + trade.stopLoss;
            }
            if (trade.limitOrder) {
                reason = "Limit order: " + trade.limitOrder;
            }
            portfolio.closeAll(trade.ticker, {
                time: trade.time,
                price: trade.open,
                info: trade,
                reason: reason
            });
        } else if (trade.buyIn) {
            portfolio.openTrade(trade.ticker, trade.time, trade.close, trade);
        }
    } 

    for (i in this.stocks) {
        
        if (portfolio.holdings[i] !== undefined) {
            for (var j = 0; j < portfolio.holdings[i].length; j++) {
                if (portfolio.holdings[i][j] !== undefined) {
                    portfolio.holdings[i][j].currentValue(combinedStockData[i].last())
                }
            }
            portfolio.closeAll(i, {
                time: combinedStockData[i].last().time,
                price: combinedStockData[i].last().close,
                info: {},
                reason: "Finalizing",
                force: true
            });
        }
    }
}

trader.getSingleHodl = async function(ticker, startTime = settings.timeWindow.start) {
    

    var cacheKey = "hodl_"+ticker+"_"+startTime;

    var hodl = myCache.getSync(cacheKey); //{ color: 'red' }

    if (hodl && hodl != 0) {
        return hodl;
    }
    
    var data = this.stocks[ticker];
    var close, start;
    if (data && data.count() > 0) {
        close = data.last().close
        start = data.where(row => row.time >= moment(startTime));
        if (start.count() > 0) {
            start = start.first().close;
        } else {
            start = undefined;
        }
    }
    if (start == undefined) {
        var startBars = await alpaca.getBars( 'day', ticker, { limit: 2, end: moment(startTime).format()})
        if (startBars[ticker].length == 0) {
            startBars = await alpaca.getBars( 'day', ticker, { limit: 2, after: moment(startTime).format()})
        }
        if (startBars[ticker].length == 0) {
            start = 1;
        } else {
            start = startBars[ticker][0].closePrice;
        }
    }
    if (close == undefined) {
        var closeBars = await alpaca.getBars( 'day', ticker, { limit: 2, end: moment().format()})
        if (closeBars[ticker].length == 0) {
            close = 1;
        } else {
            close = closeBars[ticker][closeBars[ticker].length - 1].closePrice;
        }
    }
    var resp = (close - start ) / start;
    myCache.putSync(cacheKey, resp);
    return resp;
}

trader.portfolio.getHODL = trader.getHODL = async function(stocks, startTime = settings.timeWindow.start) {
    var hodl = {};
    for (var i = 0; i < stocks.length; i++) {
        hodl[stocks[i]] = await trader.getSingleHodl(stocks[i], startTime);
    }
    return hodl;
}

trader.portfolio.getHODL = trader.getHODL;

trader.addStock = async function(ticker, data) {
    logger.setup([ticker, "Getting historical data"])
    if (data == undefined) {
        data = await MarketData.getHistoricSingle(ticker, settings.timeframe, settings.interval);
    }
    if (data == false) {
        logger.error([ticker, "No data found"])
        return;
    }
    logger.setup([ticker, "Historical data found"])

    for (var i = 0; i < this.strategies.length; i++) {
        var strategy = this.strategies[i];
        logger.setup([ticker, "Adding indicators"])
        data = this.strategies[i].addIndicators(data);
        logger.setup([ticker, "Added indicators"])

        var buyStr = "buySignal_"+strategy.name;
        var sellStr = "buySignal_"+strategy.name;
        if (this.strategies.length == 1) {
            buyStr = "buySignal";
            sellStr = "sellSignal";
        }

        data = data.withSeries({
            buySignal: data.deflate(row => {
                return strategy.buySignal(row).signal
            }),
            buyReason: data.deflate(row => {
                return strategy.buySignal(row).reason
            }),
            sellSignal: data.deflate(row => {
                return strategy.sellSignal(row).signal
            }),
            sellReason: data.deflate(row => {
                return strategy.sellSignal(row).reason
            })
        });



    }

    this.stocks[ticker] = data;
    return this;
}

trader.addStrategyByName = function(strategyName) {
    this.strategies = [];
    this.portfolio.strategies = [];
    var strategy = require("../strategies/"+strategyName);
    strategy.name = strategyName;
    this.strategies.push(strategy);
    this.portfolio.strategies.push(strategy);
    return this;
}

trader.getHistoricData = async function(stocks) {
    var data = {};
    for (var i = 0; i < stocks.length; i++) {
        var ticker = stocks[i];
        var forge = MarketData.getHistoricSingle(ticker);
        forge = addIndicators(forge);
        data[ticker] = forge;
    }
}

class Singleton {
    constructor() {
        return trader;
    }
}
module.exports = new Singleton();
