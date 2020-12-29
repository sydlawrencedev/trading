var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var Trade = require('./trade');
var portfolio = require('./portfolio');
const moment = require('moment');
const tickers = require('./tickers');

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
    display:false,
    strategies: [],
    getProfit: function() {
        return this.portfolioValue - startingCash;
    },
    completedTrades: [],
    profits: {},
    holdings: {},
    portfolioValue: startingCash
}

log = function(text) {
    if (settings.verbose && portfolio.display == true) {
        console.log(portfolio.display);
        console.log(text);
    }
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

    var maxTradesOpen = tickers.active.length

    var tradesLeftToOpen = maxTradesOpen - this.uniqueOpenTrades().length;
    
    
    if (tradesLeftToOpen <= 1) {
        return this.cash;
    }
    var perTrade = this.cash / tradesLeftToOpen;

    var amount = perTrade * Math.max((info.buySignal / settings.cashBaseWeighting),1.5)
    // console.log("amount to spend on " + info.ticker, amount);
    return Math.max(0,Math.min(amount, this.cash));
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
        log(chalk.red(moment(time).format("DD/MM/YYYY HH:mm") + " Attempted to buy " + stock + " but had no cash: " + this.cash.toFixed(2) +" "+info.buySignal));
        return;
    }
    
    log([moment(time).format("DD/MM/YYYY HH:mm"), "BUY ",stock,Math.round(quantity),Math.round(price)+"     ", Math.round(cashToSpend)+"  ", info.buySignal, info.buyReason].join("\t"));
    
    if (this.cash < cashToSpend && this.display) {
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
            log([moment(details.time).format("DD/MM/YYYY HH:mm"), "SELL",stock,chalk.colorize(Math.round(trade.data.profit), 0, Math.round(trade.data.profit)),Math.round(details.price)+"     ", Math.round(total)+"  ", details.info.sellSignal, details.reason].join("\t"));
            this.cash = this.cash * 1 + total
            this.completedTrades.push(trade);
            this.holdings[stock][i] = null;
        } else {
            log(chalk.red([moment(details.time).format("DD/MM/YYYY HH:mm"), "SELL",stock,chalk.colorize(Math.round(trade.data.profit), 0, Math.round(trade.data.profit)),"Did not sell at a loss"].join("\t")));
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
