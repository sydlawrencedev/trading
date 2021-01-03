const settings = require('./settings');
const logger = require('./modules/logger');

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
 
    var hodl = await trader.getSingleHodl("AAPL", "2019-01-01");
    console.log("hodl aapl");
    console.log(hodl);


    var myArgs = process.argv.slice(2);
    var options = processArgs(myArgs);;
    var allResults = [];

    logger.log([
        "STATUS",
        "Initialising backtesting",
        "Strategy: "+chalk.yellow(settings.strategy),
        "Stocklist: "+chalk.yellow(settings.stockFile),
        "Starting capital: $"+settings.startingCapital         
    ])


    await trader.addStrategyByName(settings.strategy);
    var stocks = await tickers.fetch(settings.stocks)
    logger.setup("Adding " + stocks.length + " stocks")
    await trader.addStocks(stocks);
    logger.setup("About to commence backtesting")
    await trader.backtest(true).catch(e => {
        logger.error(["BACKTEST ERROR", e.message])
        console.log(e)
    });


    return trader;
}

main()
    .then(results => {
        
        trader.portfolio.logProfits();

        logger.log(["Finished backtesting", settings.timeWindow.start, "=>",settings.timeWindow.end]);
        trader.portfolio.logStatus();

    })
    .catch(e => {
        logger.error(e.message);
        console.log(e.stack);        
    });


