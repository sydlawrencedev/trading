var chalk = require("chalk");
var settings = require("../settings");
var MarketData = require('./marketdata');
var portfolio = require('./portfolio');

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

trader.backtest = async function() {
    console.log("soooo ermmmmm");
    return this;
}

trader.addStock = async function(ticker) {
    var data = await MarketData.getHistoricSingle(ticker);

    for (var i = 0; i < this.strategies.length; i++) {
        var strategy = this.strategies[i];
        data = this.strategies[i].addIndicators(data);

        var buyStr = "buySignal_"+strategy.name;
        var sellStr = "buySignal_"+strategy.name;
        if (this.strategies.length == 1) {
            buyStr = "buySignal";
            sellStr = "sellSignal";
        }

        data = data.withSeries(buyStr, data.deflate(row => strategy.buySignal(row) ));
        data = data.withSeries(sellStr, data.deflate(row => strategy.sellSignal(row) ));

        console.log(data.deflate(row => row["buySignal_"+strategy.name]).toString())
    }

    

    // console.log(data.toString());

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
