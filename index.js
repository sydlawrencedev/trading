const settings = require('./settings');
const chalk = require('chalk');

chalk.colorize = function(val, base, str) {
    if (val > base) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val < base) {
        return chalk.bgRed(chalk.white(str))
    } else {
        return chalk.bgYellow(chalk.black(str))
    }
}

var stratName = settings.strategy;
var strat;
try {
    strat = require('./strategies/'+stratName);
} catch (e) {
    console.log(chalk.red("ERROR: Cannot find strategy: ./strategies/"+stratName));
    console.log(e);
    process.exit();
}
const strategy = strat.strategy;

const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
const axios = require('axios');
const { plot } = require('plot');
require('@plotex/render-image')
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
var Table = require('easy-table');
const fs = require('fs');
const moment = require('moment');
const terminalImage = require('terminal-image');
const trader = require('./modules/trader');
const tickers = require('./modules/tickers');

var firstTrade = moment();
var lastTrade = moment("1980-01-01");


const startingCapital = settings.startingCapital;



var totalProfit = 0;
var marketProfit = 0;
var totalTrades = 0;

var baseAlgoProfit = 0;

var verbose = settings.verbose;

log = function(text) {
    if (verbose) {
        console.log(text);
    }
}

function processArgs(args) {
    var options = {};
    args.forEach(element => {
        if (element[0] == "-") {
            var x = element.replace("-","");
            options[x] = true;
        }
    });
    return options;
}


async function main() {
 
    var myArgs = process.argv.slice(2);
    var options = processArgs(myArgs);;
    var allResults = [];

    log("Strategy: " + chalk.yellow(settings.strategy))
    await trader.addStrategyByName(settings.strategy);
    var stocks = await tickers.fetch(settings.stocks)
    log("Adding " + stocks.length + " stocks")
    await trader.addStocks(stocks);
    log("About to commence backtesting")
    await trader.backtest(true);


    return trader;
}


main()
    .then(results => {
        console.log(trader.portfolio.profits);
        for (var i in trader.portfolio.profits) {
            if (trader.portfolio.profits[i] < 0) {
                console.log(chalk.red(i + "\t " + trader.portfolio.profits[i]))
            } else if (trader.portfolio.profits[i] > 0) {
                console.log(chalk.green(i + "\t " + trader.portfolio.profits[i]))
            } else {
                console.log(chalk.yellow(i + "\t " + trader.portfolio.profits[i]))
            }
        }

        trader.portfolio.calculate();
        console.log("Portfolio value: ",trader.portfolio.portfolioValue);   

        var profit = trader.portfolio.getProfit();

        console.log(chalk.colorize(profit,0,"Total Profit: $"+profit));   
        console.log("ROI: "+ (profit / startingCapital).toFixed(3));   

        console.log(trader.portfolio.holdings);

    })
    .catch(err => {
        console.error(chalk.red("An error occurred."));
        console.error(err && err.stack || err);
    });


