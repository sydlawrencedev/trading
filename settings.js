var keys = require("./.keys");

var stocks = "watch";
// stocks = "june2020undervalued";
// stocks = "syd";
// stocks = "bear";
settings = {   
    stockFile: stocks,
    stocks: stocks,
    strategy: "test",
    // strategy: "holdall",
    comparisons: ["h3ka", "rsi", "sma", "ema", "bollinger", "trendwatcher", "holdall"],
    comparisons: ["h3ka"],
    alphavantagekey: keys.alphavantage.key,
    alpaca: keys.alpaca,
    supportPartialShares: false,
    startingCapital: 100000,
    verbose: false,
    tradingTimeout: 1 * 60 * 1000,
    timeWindow: {
        start: "2020-01-01",
        end: "2020-08-01"
    },
    thresholds: {
        buy: 0,
        sell: 0
    },
    cashBaseWeighting: 50
}

module.exports = settings;