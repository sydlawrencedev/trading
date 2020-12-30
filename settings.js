var keys = require("./.keys");


var verbose = false;
if (process.argv[2] == "-verbose" || process.argv[1].indexOf("index") > -1) {
    verbose = true;
    console.log("Running in verbose mode");
}

// var stocks = "watch";
// stocks = "june2020undervalued";
stocks = "watch";
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
    verbose: verbose,
    tradingTimeout: 1 * 60 * 1000,
    timeframe: "daily", // daily, minute
    interval: false, // 1min, 5min, 15min, 30min, 60min, false if daily
    timeWindow: {
        start: "2020-10-01 00:00:00",
        end: "2020-12-29 00:00:00",
        // start: false // use all available data
    },
    thresholds: {
        buy: 0,
        sell: 0
    },
    cashBaseWeighting: 50
}

module.exports = settings;