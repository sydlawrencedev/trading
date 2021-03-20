var keys = require("./.keys");
var chalk = require("chalk");

var verbose = false;
if (process.argv[2] == "-verbose" || process.argv[1].indexOf("index") > -1) {
    verbose = true;
}

var stocks = "watch";
var strategy = "test";
var timeWindow = {
    start: "2020-01-01 00:00:00",
    end: "2020-12-31 00:00:00",
};

if (process.argv[2] == "-cli") {
    if (process.argv[3] !== undefined) {
        stocks = process.argv[3];
        if (process.argv[4] !== undefined) {
            strategy = process.argv[4]
        }
    }
}

settings = {
    stockFile: stocks,
    stocks: stocks,
    strategy: strategy,
    // strategy: "holdall",
    comparisons: ["h3ka", "rsi", "sma", "ema", "bollinger", "trendwatcher", "holdall"],
    comparisons: ["h3ka"],
    alphavantagekey: keys.alphavantage.key,
    analyze: false,
    coinApiKey: keys.coinAPI.key,
    supportPartialShares: true,
    startingCapital: 100000,
    verbose: verbose, //verbose,
    tradingTimeout: 1 * 60 * 1000,
    timeframe: "daily", // daily, minute
    interval: false, // 1min, 5min, 15min, 30min, 60min, false if daily
    tradingStart: "2021-01-04 00:00:00",
    timeWindow: timeWindow,
    thresholds: {
        buy: 0,
        sell: 0
    },
    cashBaseWeighting: 50,
    broker: {
        name: "alpaca",
        keys: keys.alpaca
    }
}

if (settings.verbose) {
    console.log(chalk.green("Running in verbose mode"));
}

if (settings.timeframe == "daily") {
    settings.timeRange = "day";
} else {
    settings.timeRange = "minute";
}

module.exports = settings;