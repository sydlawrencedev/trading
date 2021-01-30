var fs = require("fs");
var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var Trade = require('./trade');
const moment = require('moment');
const tickers = require('./tickers');
const logger = require('./logger');

const Alpaca = require('@alpacahq/alpaca-trade-api')

try {
    const alpaca = new Alpaca({
        usePolygon: false
    });
} catch (e) {}

chalk.colorize = function(val, base, str) {
    if (val * 1 > base * 1) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val * 1 < base * 1) {
        return chalk.bgRed(chalk.white(str))
    } else {
        return chalk.bgYellow(chalk.black(str))
    }
}
var startingCash = settings.startingCapital;

var portfolio = {
    cash: startingCash,
    startingCash: startingCash,
    liveFromAlpaca: false,
    strategies: [],
    
    getROI: function() {
        return (this.portfolioValue - startingCash) / startingCash;
    },
    completedTrades: [],
    takings: {},
    spendings: {},
    holdings: {},
    portfolioValue: startingCash
}

portfolio.logProfits = async function(time = settings.timeWindow.start, end = settings.timeWindow.start) {
    this.calculate();
    var profits = this.getProfits();
    var hodl = await this.getHODL(Object.keys(profits), time, end);
    for (var i in profits) {
        logger.log([
            "STOCK",
            i,
            chalk.colorize(profits[i],0,"ROI: " + profits[i].toFixed(5)),
            chalk.colorize(profits[i],0,"Profit: " + (profits[i] * 100).toFixed(2)+"%"),
            chalk.colorize(profits[i],hodl[i] * 1,"HODL: " + (hodl[i] * 100).toFixed(2)+"%"),
            "Out: $"+Math.round(this.spendings[i]),
            "In: $"+Math.round(this.takings[i]),
            "Diff: $"+Math.round(this.takings[i] - this.spendings[i]),

        ]);
    }
}

portfolio.logHoldings = async function(time = settings.timeWindow.start) {
    this.calculate();
    var holdings = Object.values(this.holdings);
    var hodl = await this.getHODL(Object.keys(this.holdings), time);
    var holdings = Object.values(this.holdings);

    holdings.sort((a,b) => {
        return a[0].data.entry.info.market_value * 1 - b[0].data.entry.info.market_value * 1;
    });

    for (var i in holdings) {
        var holding = holdings[i][0];
        var profit = holding.data.entry.info.unrealized_plpc * 1;
        logger.log([
            "HOLD",
            holding.ticker,
            chalk.colorize(profit,0,"ROI: " + profit.toFixed(5)),
            chalk.colorize(profit,0,"Profit: " + (profit * 100).toFixed(2)+"%"),
            chalk.colorize(profit,hodl[holding.ticker],"HODL: " + (hodl[holding.ticker] * 100).toFixed(2)+"%"),
            "Entry: "+(holding.data.entry.info.avg_entry_price * 1).toFixed(2),
            "Now: "+(holding.data.entry.info.current_price * 1).toFixed(2),
            "Total: "+(holding.data.entry.info.market_value * 1).toFixed(2),

        ]);
    }
}

portfolio.getProfits = function() {
    var profits = {};
    for (var i in this.spendings) {
        profits[i] = (this.takings[i] - this.spendings[i]) / this.spendings[i]
    }
    return profits;
}

portfolio.openTrades = function() {
    var trades = [];
    for (var i in this.holdings) {
        for (var j = 0; j < this.holdings[i].length; j++) {
            trades.push(this.holdings[i][j]);
        }
    }
    return trades;
}

portfolio.logStatus = async function(time = settings.timeWindow.start) {
    this.calculate();
    var roi = this.getROI();
    var hodl = await this.getHODL(tickers.active,time);
    function average(nums) {
        return nums.reduce((a, b) => (a + b)) / nums.length;
    }
    var hodlAverageText = "HODL: N/A";
    var hodlAverage = 0;
    if (Object.values(hodl).length > 0) {
        hodlAverage = average(Object.values(hodl))
        hodlAverageText = chalk.colorize(roi , hodlAverage, "HODL: "+(hodlAverage*100).toFixed(2)+"%");
    }

    logger.log([
        "STATUS",
        "Strategy: "+chalk.yellow(this.strategies[0].description),
        "Stocklist: "+chalk.yellow(settings.stockFile),
        "Range: "+chalk.yellow(settings.alpacaRange),
        "Trading start: "+chalk.yellow(moment(time).format("DD/MM/YY")),
    ])
    logger.log([
        "STATUS",
        chalk.colorize(roi,0,"ROI: "+ roi.toFixed(5)),
        chalk.colorize(roi,0,"Profit: "+(roi * 100).toFixed(2)+"%"),
        hodlAverageText,
        "Portfolio: $"+Math.round(this.portfolioValue),
        "Cash: $"+this.cash.toFixed(0),            
    ]);
    var params = [];
    var obj = {
        portfolio: "$"+Math.round(this.portfolioValue) + " vs $" + Math.round((1+hodlAverage) * this.startingCash),
        strategy: this.strategies[0].description,
        stocklist: settings.stockFile
    };
    for (var i in obj) {
        params.push(i+"="+obj[i]);
    }
    // try {
    // var url = "https://hook.integromat.com/rqpl6bxa21vqm1ki6kodi8gh7arwr3qj?"+params.join("&");
    // const https = require("https");

    // https.get(url, response => {});
    // } catch (e) {}
}

portfolio.uniqueOpenTrades = function() {
    var trades = {};
    for (var i in this.holdings) {
        for (var j = 0; j < this.holdings[i].length; j++) {
            trades[i] = this.holdings[i][j];
        }
    }
    return Object.values(trades);
}

portfolio.currentValue = function() {
    this.calculate();
    return this.portfolioValue;
}

portfolio.calculate = function() {
    if (this.liveFromAlpaca) {
        return;
    }
    this.portfolioValue = 0; 
    var openTrades = this.openTrades();
    for (var i = 0; i < openTrades.length; i++) {
        if (openTrades[i]) {
            this.portfolioValue += openTrades[i].currentValue();
        }
    }
    this.portfolioValue += this.cash;
    this.portfolioValue = this.portfolioValue.toFixed(2);
}

portfolio.updateFromAlpaca = function(account, holdings, checkIfWatched = false) {
    this.liveFromAlpaca = true;
    this.cash = account.cash * 1;
    this.portfolioValue = account.portfolio_value * 1;


    for (var index = 0; index < holdings.length; index++) {
        (function(i) {
            var holding = holdings[i];
            var trade = new Trade(
                (new Date()).getTime(), holding.symbol, holding.qty, holding.avg_entry_price, holding
            );
            
            if (portfolio.holdings[holding.symbol] == undefined) {
                portfolio.holdings[holding.symbol] = []
            }
            portfolio.holdings[holding.symbol].push(trade);
            
            // if no longer in watchlist
            if (checkIfWatched && !tickers.isWatched(holding.symbol)) {
                // attempt to sell holding
                alpaca.getBars(
                    settings.alpacaRange,
                    holding.symbol
                ).then(response => {
                    for (var i in response) {
                        var data = response[i];
                        portfolio.closeAll(i, {
                            time: (new Date()).getTime(),
                            price: data[data.length - 1].closePrice,
                            info: "",
                            trade: trade,
                            reason: "No longer watched"
                        }, trade);
                    }
                    // var symbol = response.keys()[0]; 
                    // console.log(response);
                    
                }).catch(e => 
                    logger.error([
                        "ERROR",
                        "Failed to get market data from alpaca",
                        e.error,
                        e.message
                    ]) 
                );
                
            }
        })(index)
        
    }

    // this.holdings = holdings;
}

portfolio.getAmountToSpend = function(info) {
    return this.strategies[0].amountToSpend(
        info,
        this.cash,
        this.uniqueOpenTrades(),
        this.holdings[info.ticker],
        this.holdings,
        this
    );
}

portfolio.openTrade = function(stock, time, price, info) {
    try {
    var cashToSpend = this.getAmountToSpend(info);
    } catch (e) {
        logger.error([
            "BUY ",
            stock,
            e.message,
            info.buySignal,
            info.buyReason
        ], moment(time));
        return;
    }
    if (price <= 0) {
        logger.error([
            "BUY ",
            stock,
            "Price cannot be less than 0"
        ], moment(time))
        return;
    }
    var quantity = cashToSpend / price;
    if (!settings.supportPartialShares) {
        quantity = Math.floor(quantity);
        cashToSpend = quantity * price;
    }
    cashToSpend = cashToSpend;
    if (quantity <= 0) {

        logger.error([
            "BUY ",
            stock,
            "Not enough cash",
            this.cash.toFixed(2),
            info.buySignal,
            info.buyReason
        ], moment(time));

        return;
    }
    if (this.spendings[stock] == undefined) {
        this.spendings[stock] = 0;
    }
    this.spendings[stock] += cashToSpend;

    logger.alert([
        chalk.green("BUY "),
        stock,
        Math.round(quantity),
        Math.round(price)+"     ",
        Math.round(cashToSpend)+"  ",
        info.buySignal,
        info.buyReason
    ], moment(time));
    
    var trade = new Trade(time, stock, quantity, price, info);
    this.cash = this.cash - cashToSpend;
    if (this.holdings[stock] == undefined) {
        this.holdings[stock] = [];
    }
    this.holdings[stock].push(trade);
}

portfolio.closeAll = function(stock, details, trade = false) {
    if (portfolio.holdings[stock] == undefined) {
        portfolio.holdings[stock] = [];
    }
    if (trade) {
        portfolio.holdings[stock] = [trade];
    }

    if (portfolio.holdings[stock].length == 0) {
        logger.error([
            "SELL",
            stock,
            "No holding found?",
            details.reason
        ], moment(details.time));
    }

    // console.log("wat now", stock);
    // console.log(portfolio.holdings[stock]);
    // console.log(holdings);
    // console.log("hide");
    var didNotSellAtALoss = false;
    // console.log(details);
    // console.log("wat",stock, portfolio.holdings[stock].length);
    
    for ( var i = 0; i < portfolio.holdings[stock].length; i++) {
        var trade = portfolio.holdings[stock][i];
        
        var total = details.price * trade.quantity;
        // never sell at a loss
        var acceptableLoss = 0;
        if (this.strategies[0].acceptableLoss !== undefined) {
            acceptableLoss = this.strategies[0].acceptableLoss;
            acceptableLoss = trade.data.entry.price * (1 + acceptableLoss);
        }

        if (acceptableLoss <= details.price || details.force == true) {
            if (portfolio.sellStock !== undefined) {
                portfolio.sellStock(stock, trade.quantity);
            }
            trade.exitPosition(details.time, details.price, details.info, details.reason);
            if (this.takings[stock] == undefined) {
                this.takings[stock] = 0;
            }

            // if (details.force) {
            // }
            this.takings[stock] += total;
            
            logger.alert([
                chalk.green("SELL"),
                stock,
                chalk.colorize(
                    trade.data.profit,
                    0,
                    Math.round(trade.data.profit) + " ("+(trade.data.profitPct * 100).toFixed(1)+"%)"
                ),
                Math.round(details.price) + "     ",
                Math.round(total)+"  ",
                details.info.sellSignal,
                details.reason,
                "Entry: "+moment(trade.data.entry.time).format("DD/MM/YYYY HH:mm:ss")
            ], moment(details.time));

            this.cash = this.cash * 1 + total
            this.completedTrades.push(trade);
            this.holdings[stock][i] = null;
        } else if (!didNotSellAtALoss) {

            trade.currentValue({close: details.price});
            didNotSellAtALoss = true;
            
            logger.error([
                "SELL",
                stock,
                chalk.colorize(
                    trade.data.profit,
                    0,
                    Math.round(trade.data.profit) + " ("+(trade.data.profitPct * 100).toFixed(1)+"%)"
                ),
                "Not accepting a loss",
                details.info.sellSignal,
                details.reason,
                "Entry: "+moment(trade.data.entry.time).format("DD/MM/YYYY HH:mm:ss")
            ], moment(details.time));
        }
       
    }
    this.holdings[stock] = this.holdings[stock].filter(holding => holding != null);

    for (var i in this.holdings) {
        if (this.holdings[i].length > 0) {

        } else {
            delete this.holdings[i];
        }
    }

    this.cash = Math.max(this.cash, 0);
}

class Singleton {
    constructor() {
        return portfolio;
    }
}
module.exports = new Singleton();
