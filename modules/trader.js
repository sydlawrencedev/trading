var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var Trade = require('./trade');
var portfolio = require('./portfolio');

const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.

var supportPartialShares = settings.supportPartialShares;

var trader = {
    strategies: [],
    stocks: {},
    portfolio: portfolio
}

log = function(text) {
    if (settings.verbose) {
        console.log(text);
    }
}

trader.addStocks = async function(stocks) {
    for (var i = 0; i < stocks.length; i++) {
        await this.addStock(stocks[i]);
    }
    return this;
}

trader.backtest = async function() {
    return await this.determineTrades();
}

trader.determineTrades = async function() {
    log("determining trades")
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
                    var row = window.last();
                    var previous = window.first();
                    return [ window.last().time, 
                        (row.isHolding && !previous.isHolding) ? true : undefined
                    ]; 
                })
                .withIndex(pair => pair[0]) // Promote index.
                .select(pair => pair[1]); // Restore values.

            const sellOutMoment = stockData.window(2) // Group into lots of 7 (for 7 days).
                .select(window => {
                    var row = window.last();
                    var previous = window.first();
                    return [ window.last().time, 
                        !row.isHolding && previous.isHolding ? true : undefined
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
            var previousRow;
            var previousHolding;
            for (const row of stockData) {
                var isNowHolding = false;
                if (previousHolding == true) {
                    isNowHolding = true;
                }
                if (row.buyIn) {
                    isNowHolding = true;
                }
                if (previousRow && previousRow.sellOut && !row.buyIn) {
                    isNowHolding = false;
                }
                holdings.push({time: row.time, isHolding: isNowHolding});
                previousRow = row;
                previousHolding = isNowHolding;
                // Do something with row.
            }
            holdings = new dataForge.DataFrame({
                values: holdings
            }).setIndex("time");

            stockData = stockData.withSeries({
                boughtShares: stockData => stockData.select(row => (row.buyInMoment) ? (supportPartialShares) ? row.buyInAmount / row.open : Math.floor(row.buyInAmount / row.open) : 0),
                isHolding: holdings.deflate(row => row.isHolding)
            });


            // console.log(stockData.subset(["ema","close", "downTrendCounter", "buySignal", "sellSignal"]).toString())


            var tradesData = stockData.where(row => (row.buyIn || (row.isHolding && row.sellOut)));
            
            for (const trade of tradesData) {
                combinedTrades.push(trade);
            }

            log(i + ": " +tradesData.count() + " possible trades");
            
            combinedStockData[i] = stockData;
        } catch (e) {}
    }    

    // tradesData = tradesData.subset(["time", "buyIn", "isHolding", "sellOut", "open", "close"]);
    combinedTrades = combinedTrades.sort((a,b) => { 
        if (a.time == b.time) 
            return (a.buySignal > b.buySignal) ? 1 : -1
        return a.time > b.time ? 1 : -1
    });
    

    log(["DATE","", "BUY ","STOCK","QTY","PRICE", "TOTAL", "SIGNAL", "REASON"].join("\t"));
    log(["DATE","", "SELL ","STOCK","PROFIT","PRICE", "TOTAL", "SIGNAL", "REASON"].join("\t"));


    
    for (const trade of combinedTrades) {
        if (trade.sellOut) {
            portfolio.closeAll(trade.ticker, {
                time: trade.time,
                price: trade.open,
                info: trade,
                reason: trade.sellReason
            });
        } else if (trade.buyIn) {
            portfolio.openTrade(trade.ticker, trade.time, trade.open, trade);
        }
    } 

    for (i in this.stocks) {
        
        if (portfolio.holdings[i] !== undefined) {
            for (var j = 0; j < portfolio.holdings[i].length; j++) {
                portfolio.holdings[i][j].currentValue(combinedStockData[i].last())
            }
            portfolio.closeAll(i, {
                time: (new Date()),
                price: combinedStockData[i].last().close,
                info: {},
                reason: "Finalizing"
            });
        }
    }

    return this;
}

trader.addStock = async function(ticker) {
    log("Getting historical data for: " + ticker)
    var data = await MarketData.getHistoricSingle(ticker);
    log("Got historical data for: " + ticker)

    for (var i = 0; i < this.strategies.length; i++) {
        var strategy = this.strategies[i];
        log("Adding indicators to " + ticker)
        data = this.strategies[i].addIndicators(data);
        log("Added indicators to " + ticker)

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
    var strategy = require("../strategies/"+strategyName);
    strategy.name = strategyName;
    this.strategies.push(strategy);
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
