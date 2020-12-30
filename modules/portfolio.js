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
    display:false,
    strategies: [],
    
    getROI: function() {
        return (this.portfolioValue - startingCash) / startingCash;
    },
    completedTrades: [],
    profits: {},
    holdings: {},
    portfolioValue: startingCash
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
    var hodlAverage = "N/A";
    if (Object.values(hodl).length > 0) {
        hodlAverage = average(Object.values(hodl)).toFixed(5);
        hodlAverage = chalk.colorize(roi , hodlAverage, hodlAverage);
    }
    console.log(hodl);

    logger.log([
        "STATUS",
        chalk.colorize(roi,0,"ROI: "+ roi.toFixed(5)),
        "Cash: $"+this.cash.toFixed(0),
        "Portfolio: $"+Math.round(this.portfolioValue),
        chalk.colorize(roi,0,"Profit: "+(roi * 100).toFixed(2)+"%"),
        "HODL: "+ hodlAverage,    
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
        if (this.display) {
            logger.error([
                "BUY ",
                stock,
                e.message,
                info.buySignal,
                info.buyReason
            ], moment(time));
        }
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

    logger.alert([
        "BUY ",
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
            if (this.profits[stock] == undefined) {
                this.profits[stock] = 0;
            }
            this.profits[stock] += trade.data.profit;
            
            logger.alert([
                "SELL",
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
