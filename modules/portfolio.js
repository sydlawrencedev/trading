var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var Trade = require('./trade');
var portfolio = require('./portfolio');
const moment = require('moment');

chalk.colorize = function(val, base, str) {
    if (val > base) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val < base) {
        return chalk.bgRed(chalk.white(str))
    } else {
        return chalk.bgYellow(chalk.black(str))
    }
}

log = function(text) {
    if (settings.verbose) {
        console.log(text);
    }
}

var startingCash = settings.startingCapital;

var portfolio = {
    cash: startingCash,
    getProfit: function() {
        this.calculate();
        var x = this.portfolioValue - startingCash;
        return x.toFixed(2);
    },
    completedTrades: [],
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
        this.portfolioValue += openTrades[i].currentValue();
    }
    this.portfolioValue += this.cash;
    this.portfolioValue = this.portfolioValue.toFixed(2);
}

portfolio.getAmountToSpend = function(info) {
    var tradesLeftToOpen = settings.maxTradesOpen - this.uniqueOpenTrades().length;
    if (tradesLeftToOpen == 1) {
        return this.cash;
    }
    var perTrade = this.cash / tradesLeftToOpen;

    var amount = perTrade * (info.buySignal / settings.cashBaseWeighting)
    return Math.min(amount, this.cash);
}

portfolio.openTrade = function(stock, time, price, info) {
    var cashToSpend = this.getAmountToSpend(info);

    var quantity = cashToSpend / price;
    if (!settings.supportPartialShares) {
        quantity = Math.floor(quantity);
        cashToSpend = quantity * price;
    }
    cashToSpend = cashToSpend;
    if (quantity <= 0) {
        log(chalk.red(moment(time).format("DD/MM/YYYY") + " Attempted to buy " + stock + " but had no cash: " + this.cash +" "+info.buySignal));
        return;
    }
    
    log([moment(time).format("DD/MM/YYYY"), "BUY ",stock,Math.round(quantity),price, Math.round(cashToSpend)+"  ", info.buySignal, info.buyReason].join("\t"));
    
    if (this.cash < cashToSpend) {
        console.log(chalk.red("NOT ENOUGH CASH AVAILABLE",stock, time, this.cash, cashToSpend));
        console.log(chalk.red("Buy signal: "+info.buySignal));
        console.log(info);
        process.exit();
    }
    var trade = new Trade(
        time, stock, quantity, price, info
    );
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

    for ( var i = 0; i < this.holdings[stock].length; i++) {
        var trade = this.holdings[stock][i];
        var total = details.price * trade.quantity;
        trade.exitPosition(details.time, details.price, details.info, details.reason);
        log([moment(details.time).format("DD/MM/YYYY"), "SELL",stock,chalk.colorize(Math.round(trade.data.profit), 0, Math.round(trade.data.profit)),details.price, Math.round(total)+"  ", details.info.sellSignal, details.reason].join("\t"));
        this.cash = this.cash * 1 + total
        this.completedTrades.push(trade);
    }
    this.holdings[stock] = [];
    if (typeof this.cash.toFixed !== "undefined") {
        this.cash = this.cash;
    }
    if (this.cash < 0) {
        console.log(chalk.red("WAT NOW? "+ details.price + " " + trade.quantity));
    }
    this.cash = Math.max(this.cash, 0);
}

class Singleton {
    constructor() {
        return portfolio;
    }
}
module.exports = new Singleton();
