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

let addIndicators = strat.addIndicators;



gotBars = function(bars, moreToTry) {
   
    (async function() {


        var requiresActivty = false;  
        var  df;
        for (var j = 0; j < stocks.length; j++) {
            var stock = stocks[j];
            df = new dataForge.DataFrame(bars[stock])
                .transformSeries({
                    startEpochTime: value => new Date(value*1000)
                })
            df = df.setIndex("startEpochTime") // Index so we can later merge on date.
                    .renameSeries({ startEpochTime: "time" })
                    .renameSeries({ openPrice: "open" })
                    .renameSeries({ highPrice: "high" })
                    .renameSeries({ lowPrice: "low" })
                    .renameSeries({ closePrice: "close" });
            await trader.addStock(stock, df);
                
            // save to file
            df.reverse().renameSeries({time: "timestamp"}).asCSV()                            // Write out data file in CSV (or other) format.
                .writeFileSync(process.mainModule.path+"/data/"+marketdata.filename(stock,"minute","1min")+"-live-"+moment().format("YYYY-MM-DD-HH")+".csv");



        }

        var trades = [];
        try {
            trades = await trader.backtest();
        } catch (e) {
            console.log("ERROR");
            console.log(e);
            trades = [];
        }




        trader.portfolio.holdings = {};

        var attemptedTrades = {};

        trades = trades.filter(trade => trade.time >= df.last().time - 30 * 1000); 

        logger.status("Latest data: " + moment(df.last().time).format("DD/MM/YYYY HH:mm"));
        logger.status(trades.length + " potential trades found")

        
        for (var i = 0; i < trades.length; i++) {
            var trade = trades[i];

            if (trade.sellSignal > trade.buySignal) {
                try {
                    var position = await getStock(trade.ticker)
                    var toSell = true;
                    if (trader.strategies[0].acceptableLoss !== undefined) {
                        acceptableLoss = trader.strategies[0].acceptableLoss;
                        if (position.unrealized_plpc * 1 < acceptableLoss) {
                            toSell = false;
                            logger.warn([
                                "SELL",
                                trade.ticker,
                                chalk.colorize(
                                    position.market_value*1,
                                    position.cost_basis*1,
                                    (position.market_value - position.cost_basis).toFixed(2) + " ("+(position.unrealized_plpc * 100).toFixed(1)+"%)",
                                    false
                                ),
                                "Not selling at a loss",
                                trade.sellSignal,
                                trade.sellReason
                            ]);                         
                        }
                    }
                    if (toSell) {

                        requiresActivty = true;

                        attemptedTrades[trade.ticker] = true;
                        var sellResponse = await sellStock(trade.ticker, position.qty);

                        logger.alert([
                            chalk.green("SELL"),
                            trade.ticker,
                            chalk.colorize(
                                position.market_value*1,
                                position.cost_basis*1,
                                (position.market_value - position.cost_basis).toFixed(2) + " ("+(position.unrealized_plpc * 100).toFixed(1)+"%)"
                            ),
                            Math.round(position.current_price)+"", Math.round(position.market_value)+"  ",
                            trade.sellSignal,
                            trade.sellReason
                        ]); 

                        var account = await alpaca.getAccount();
                        var positions = await alpaca.getPositions();
                        portfolio.updateFromAlpaca(account, positions);
                    }
                } catch (e) {
                    if (e.error !== undefined && e.error.code == 40410000) {
                        // simply position doesn't currently exist
                    } else {
                        logger.warn([
                            "SELL",
                            trade.ticker,
                            chalk.colorize(
                                position.market_value*1,
                                position.cost_basis*1,
                                (position.market_value - position.cost_basis).toFixed(2) + " ("+(position.unrealized_plpc * 100).toFixed(1)+"%)"
                            ),
                            e.error.code,
                            e.error.message,
                            Math.round(position.current_price)+"", Math.round(position.market_value)+"  ",
                            trade.sellSignal,
                            trade.sellReason
                        ]);
                        
                    }
                }
            }

            else if (trade.buySignal > trade.sellSignal) {
                try {
                    requiresActivty = true;
                    var account = await alpaca.getAccount();
                    var positions = await alpaca.getPositions();
                    portfolio.updateFromAlpaca(account, positions);
                    var amountToSpend = portfolio.getAmountToSpend(trade);
                    var quantity = Math.floor(amountToSpend / trade.close);
                    amountToSpend = quantity * trade.close;
                    if (quantity > 0) {
                        
                        
                        var purchase = await buyStock(trade.ticker, quantity, trade.close)

                        portfolio.openTrade(trade.ticker, moment(), trade.close, trade);
                        var account = await alpaca.getAccount();
                        var positions = await alpaca.getPositions();
                        portfolio.updateFromAlpaca(account, positions);
                    }
                } catch (e) {
                    logger.error([
                        "BUY",
                        trade.ticker,
                        "ERROR",
                        e.message,
                        trade.buySignal,
                        trade.buyReason
                    ]);

                }
                
            }
        }

        var account = await alpaca.getAccount();
        var positions = await alpaca.getPositions();
        portfolio.updateFromAlpaca(account, positions);
        portfolio.logProfits();
        portfolio.logStatus();
        if (settings.alpacaRange == "day") {
            logger.success("There are no more trades for today");
        }

    })().catch(e => {
        logger.error([
            "ERROR",
            e.message
        ]);
        console.log(e);
    });
}


async function main(repeating) {
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

        alpaca.getPositions().then(positions => {
            portfolio.updateFromAlpaca(account, positions);
            trader.portfolio.logStatus();
        });
          
        alpaca.getBars(
            settings.alpacaRange,
            stocks
        ).then(response => {
            gotBars(response, true);   
        }).catch(e => 
            logger.error([
                "ERROR",
                "Failed to get market data from alpaca",
                e.error,
                e.message
            ]) 
        );
    });
}



getStock = function(stock) {
    return alpaca.getPosition(stock);
}

sellStock = function(stock, qty) {
    if (qty < 1) { return; }
    return orderStock("sell", stock, qty);
}

buyStock = function(stock, qty, currentPrice) {
    if (qty < 1) { return; }
    return orderStock("buy", stock, qty, currentPrice);
}

orderStock = function(order, stock, qty, currentPrice) {
    qty = Math.max(1,Math.round(qty));
    if (order == "buy") {
        var take_profit = currentPrice * 1.05;
        var stop_loss = currentPrice * 0.98;
    }
    return alpaca.createOrder({
        symbol: stock, // any valid ticker symbol
        qty: Math.max(1,qty),
        side: order,
        type: 'market',
        time_in_force: 'day',
        take_profit: {
            limit_price: take_profit
        },
        stop_loss: {
            stop_price: stop_loss
        },
    })
    .catch(e => logger.error(["ERROR",e.message]))
    .error(e => logger.error(["ERROR",e.message]));
}

logger.setup([
    "Stocklist: "+chalk.yellow(settings.stockFile),
    "Strategy: "+chalk.yellow(settings.strategy)
]);

main().then(e => {
    
}).catch(e => {
    logger.error(["ERROR",e.message])
});

if (settings.alpacaRange == "minute") {
    setInterval(function() {
        trader.portfolio.logStatus();
    }, 5 * 60 * 1000);
}


// setInterval(function() {
//     main(true).catch(e => {
//         logger.error(["ERROR",e.message])
//     });
// }, settings.tradingTimeout)
