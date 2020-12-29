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

trader.backtest = async function(display) {
    return await this.determineTrades(display);
}

trader.determineTrades = async function(display) {
    log("Determining possible trades")
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

            // manipulate sellOut, if it has stop Loss


            // console.log(stockData.subset(["previousBuyInPrice", "isHolding", "close", "stopLoss"]).toString())


            var tradesData = stockData.where(row => (row.buyIn || (row.isHolding && row.sellOut) || (row.isHolding && row.stopLoss) || (row.isHolding && row.limitOrder)));
            
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
    
    // loop though each trade
    portfolio.display = display;
    if (display) {
        log(["DATE","", "BUY ","STOCK","QTY","PRICE   ", "TOTAL", "SIGNAL", "REASON"].join("\t"));
        log(["DATE","", "SELL ","STOCK","PROFIT","PRICE   ", "TOTAL", "SIGNAL", "REASON"].join("\t"));    
    }
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
            if (display === true) {
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
    return combinedTrades;
}

trader.addStock = async function(ticker, data) {
    log("Getting historical data for: " + ticker)
    if (data == undefined) {
        data = await MarketData.getHistoricSingle(ticker);
    }
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
