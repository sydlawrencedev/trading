var chalk = require("chalk");

const logger = require('./modules/logger');
const marketdata = require('./modules/marketdata');
const readline = require('readline');
const moment = require('moment');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

chalk.colorize = function(val, base, str, isBG = true) {
    if (isBG) {
        if (val > base) {
            return chalk.bgGreen(chalk.black(str))
        } else if (val < base) {
            return chalk.bgRed(chalk.white(str))
        } else {
            return chalk.bgYellow(chalk.black(str))
        }
    }
    if (val > base) {
        return chalk.green(str)
    } else if (val < base) {
        return chalk.red(str)
    } else {
        return chalk.yellow(str)
    }
}



const settings = require('./settings');
const Alpaca = require('@alpacahq/alpaca-trade-api')
const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');

process.env.APCA_API_KEY_ID = settings.alpaca.key;
process.env.APCA_API_SECRET_KEY = settings.alpaca.secret;
process.env.APCA_API_BASE_URL = settings.alpaca.endpoint;

const alpaca = new Alpaca({
    usePolygon: false
});

var startingCash = settings.startingCapital;
var maxActiveHoldings = 20;

var stocks;

var usdPerPot = startingCash / maxActiveHoldings;

var tickers = require('./modules/tickers');
var trader = require('./modules/trader');
var portfolio = require('./modules/portfolio');

var stratName = settings.strategy;
const strat = require('./strategies/'+stratName);
const strategy = strat.strategy;


async function main(repeating) {

    logger.setMode("status_"+settings.strategy+"_"+settings.stockFile);

    logger.setup([
        "Stocklist: "+chalk.yellow(settings.stockFile),
        "Strategy: "+chalk.yellow(settings.strategy)
    ]);

    if (repeating !== true) {
        logger.setup("Connecting to the markets and analyzing trades")
    }
    await trader.addStrategyByName(settings.strategy);
    stocks = await tickers.fetch(settings.stockFile)

    logger.setup("Adding " + stocks.length + " stocks")
    
    alpaca.getAccount().then((account, err) => {
        if (!account) {
            console.log(chalk.red("eurgh"));
            console.log(account);
            console.log(err);
        }

        alpaca.getPositions().then(async positions => {
            await portfolio.updateFromAlpaca(account, positions);
            await trader.portfolio.logProfits(settings.tradingStart);
            await trader.portfolio.logHoldings(settings.tradingStart);
            await trader.portfolio.logStatus(settings.tradingStart);
        });
    });
}






main().then(e => {
    
}).catch(e => {
    logger.error(["ERROR",e.message])
});
