var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var Trade = require('./trade');
const moment = require('moment');
const tickers = require('./tickers');
const logger = require('./logger');



chalk.colorize = function(val, base, str) {
    if (val > base) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val < base) {
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

portfolio.logProfits = function(time = settings.timeWindow.start) {
    this.calculate();
    var hodl = this.getHODL(time);
    var profits = this.getProfits();
    for (var i in profits) {
        logger.log([
            "STOCK",
            i,
            chalk.colorize(profits[i],0,"ROI: " + profits[i].toFixed(5)),
            chalk.colorize(profits[i],0,"Profit: " + (profits[i] * 100).toFixed(2)+"%"),
            chalk.colorize(profits[i],hodl[i],"HODL: " + (hodl[i] * 100).toFixed(2)+"%"),
            "Out: $"+Math.round(this.spendings[i]),
            "In: $"+Math.round(this.takings[i]),

        ]);
    }
}

portfolio.logHoldings = function(time = settings.timeWindow.start) {
    this.calculate();
    var hodl = this.getHODL(time);
    var holdings = this.holdings;
    for (var i in holdings) {
        var holding = holdings[i][0];
        var profit = holding.data.entry.info.unrealized_plpc * 1;
        logger.log([
            "STOCK",
            i,
            chalk.colorize(profit,0,"ROI: " + profit.toFixed(5)),
            chalk.colorize(profit,0,"Profit: " + (profit * 100).toFixed(2)+"%"),
            chalk.colorize(profit,hodl[i],"HODL: " + (hodl[i] * 100).toFixed(2)+"%"),
            "Entry: "+(holding.data.entry.info.avg_entry_price * 1).toFixed(2),
            "Now: "+(holding.data.currentPrice * 1).toFixed(2),
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

portfolio.logStatus = function(time = settings.timeWindow.start) {
    this.calculate();
    var roi = this.getROI();
    var hodl = this.getHODL(time);
    function average(nums) {
        return nums.reduce((a, b) => (a + b)) / nums.length;
    }
    var hodlAverage = "HODL: N/A";
    if (Object.values(hodl).length > 0) {
        hodlAverage = average(Object.values(hodl))
        hodlAverage = chalk.colorize(roi , hodlAverage, "HODL: "+(hodlAverage*100).toFixed(2)+"%");
    }

    logger.log([
        "STATUS",
        "Strategy: "+chalk.yellow(this.strategies[0].description),
        "Stocklist: "+chalk.yellow(settings.stockFile),
        "Range: "+chalk.yellow(settings.alpacaRange),
    ])
    logger.log([
        "STATUS",
        chalk.colorize(roi,0,"ROI: "+ roi.toFixed(5)),
        chalk.colorize(roi,0,"Profit: "+(roi * 100).toFixed(2)+"%"),
        hodlAverage,
        "Portfolio: $"+Math.round(this.portfolioValue),
        "Cash: $"+this.cash.toFixed(0),            
    ])
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

portfolio.updateFromAlpaca = function(account, holdings) {
    this.liveFromAlpaca = true;
    this.cash = account.cash * 1;
    this.portfolioValue = account.portfolio_value * 1;


    for (var i = 0; i < holdings.length; i++) {
        var holding = holdings[i];
        var trade = new Trade(
            (new Date()).getTime(), holding.symbol, holding.qty, holding.avg_entry_price, holding
        );
        
        if (this.holdings[holding.symbol] == undefined) {
            this.holdings[holding.symbol] = []
        }
        this.holdings[holding.symbol].push(trade);
    }

    // this.holdings = holdings;
}

portfolio.getAmountToSpend = function(info) {
    return this.strategies[0].amountToSpend(
        info,
        this.cash,
        this.uniqueOpenTrades(),
        this.holdings[info.ticker]
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

portfolio.closeAll = function(stock, details) {
    if (this.holdings[stock] == undefined) {
        this.holdings[stock] = [];
    }
    var didNotSellAtALoss = false;
    for ( var i = 0; i < this.holdings[stock].length; i++) {
        var trade = this.holdings[stock][i];
        var total = details.price * trade.quantity;
        // never sell at a loss
        var acceptableLoss = 0;
        if (this.strategies[0].acceptableLoss !== undefined) {
            acceptableLoss = this.strategies[0].acceptableLoss;
            acceptableLoss = trade.data.entry.price * (1 + acceptableLoss);
        }

        if (acceptableLoss <= details.price || details.force == true) {
            trade.exitPosition(details.time, details.price, details.info, details.reason);
            if (this.takings[stock] == undefined) {
                this.takings[stock] = 0;
            }
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
