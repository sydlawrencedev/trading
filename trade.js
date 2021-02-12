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



const Broker = require('./modules/broker');
const broker = new Broker();

const settings = require('./settings');
const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');


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

        var  df;
        for (var j = 0; j < stocks.length; j++) {
            var stock = stocks[j];
            df = new dataForge.DataFrame(bars[stock])
                .transformSeries({
                    startEpochTime: value => new Date(value*1000)
                })
            if (settings.isCrypto) {
                df = df.setIndex("time") // Index so we can later merge on date.
            } else {

                df = df.setIndex("startEpochTime") // Index so we can later merge on date.
                        .renameSeries({ startEpochTime: "time" })
                        .renameSeries({ openPrice: "open" })
                        .renameSeries({ highPrice: "high" })
                        .renameSeries({ lowPrice: "low" })
                        .renameSeries({ closePrice: "close" });
            }
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

        var timeOfLastTrade = await trader.getLastTradeTime();

        trader.portfolio.holdings = {};

        var attemptedTrades = {};
        // timeOfLastTrade -= 15 * 60;
        // timeOfLastTrade = 0;
        trades = trades.filter(trade => trade.time > timeOfLastTrade); 
        console.log(trades);
        logger.status("Last trade: " + moment(timeOfLastTrade).format("DD/MM/YYYY HH:mm"));
        logger.status("First data: " + moment(df.first().time).format("DD/MM/YYYY HH:mm"));
        logger.status("Latest data: " + moment(df.last().time).format("DD/MM/YYYY HH:mm"));
        logger.status(trades.length + " potential trades found")
        
        var account = await broker.getAccount();
        var positions = await broker.getPositions();
        portfolio.updateFromBroker(account, positions);
        // go through all sell trades
        for (var i = 0; i < trades.length; i++) {
            var trade = trades[i];

            if (trade.sellSignal > trade.buySignal) {
                try {
                    var position = await getStock(trade.ticker);

                    var toSell = true;
                    if (trader.strategies[0].acceptableLoss !== undefined && !settings.isCrypto) {
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

                        attemptedTrades[trade.ticker] = true;
                        var didSell = await portfolio.closeAll(trade.ticker, {
                            time: trade.time,
                            price: trade.close,
                            info: trade.sellSignal,
                            reason: trade.sellReason
                        }, trade);
                        if (didSell) {
                            var sellResponse = await sellStock(trade.ticker, position.result[1].free);
                            var account = await broker.getAccount();
                            var positions = await broker.getPositions();
                            portfolio.updateFromBroker(account, positions);
                        }
                    }
                } catch (e) {
                    if (e.error !== undefined && e.error.code == 40410000) {
                        // simply position doesn't currently exist
                    } else if (e.error !== undefined) {
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
                        
                    } else {
                        console.log(e);
                    }
                }
            }
        }

        // go through all buy trades
        for (var i = 0; i < trades.length; i++) {
            var trade = trades[i];

            if (trade.buySignal > trade.sellSignal) {
                try {
                    var account = await broker.getAccount();
                    var positions = await broker.getPositions();
                    portfolio.updateFromBroker(account, positions);
                    var amountToSpend = portfolio.getAmountToSpend(trade);
                    var quantity = Math.floor((amountToSpend / trade.close) * 10000) / 10000;
                    amountToSpend = quantity * trade.close;
                    if (quantity > 0) {
                        
                        var purchase = await buyStock(trade.ticker, quantity, trade.close)

                        portfolio.openTrade(trade.ticker, moment(), trade.close, trade);
                        var account = await broker.getAccount();
                        var positions = await broker.getPositions();
                        portfolio.updateFromBroker(account, positions);
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

        var account = await broker.getAccount();
        var positions = await broker.getPositions();
        portfolio.updateFromBroker(account, positions);
        portfolio.logProfits();
        portfolio.logStatus();
        trader.saveLastTradeTime();
        if (settings.alpacaRange == "day") {
            return logger.success("There are no more trades for today");
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
    logger.setMode("trading_"+settings.strategy+"_"+settings.stockFile);

    if (repeating !== true) {
        logger.setup("Connecting to the markets and analyzing trades")
    }
    await trader.addStrategyByName(settings.strategy);
    stocks = await tickers.fetch(settings.stockFile)

    // Check if the market is open now.
    broker.ifOpen(function() {
            logger.setup("Adding " + stocks.length + " stocks")
            broker.getAccount().then((account, err) => {
                if (!account) {
                    console.log(chalk.red("eurgh"));
                    console.log(account);
                    console.log(err);
                }
                broker.getPositions().then(positions => {
                    broker.getBars(
                        settings.alpacaRange,
                        stocks
                    ).then(response => {
                        if (settings.isCrypto) {
                            response = {BTC:response.result}
                        }
                        
                        portfolio.updateFromBroker(account, positions, true);
                        gotBars(response, true);  
                        trader.portfolio.logStatus(); 
                    }).catch(e => {
                        console.log(e);
                        logger.error([
                            "ERROR",
                            "Failed to get market data from alpaca",
                            e.error,
                            e.message
                        ])
                    });
                });     
            });
    }, function()  {
        logger.error("Market is closed");
    });
}

getStock = function(stock) {
    return broker.getPosition(stock);
}

sellStock = function(stock, qty) {
    qty = Math.floor(qty * 10000) / 10000
    if (qty < 1 && !settings.supportPartialShares) { return; }
    return orderStock("sell", stock, qty);
}

portfolio.sellStock = sellStock;

buyStock = function(stock, qty, currentPrice) {
    qty = Math.floor(qty * 10000) / 10000
    if (qty < 1 && !settings.supportPartialShares) { return; }
    return orderStock("buy", stock, qty, currentPrice);
}

orderStock = async function(order, stock, qty, currentPrice) {
    if (currentPrice == undefined) {
        var t = await broker.getSpotPrice("BTC/USD");
        currentPrice = t.result.price;
    }
    qty = Math.floor(qty * 10000) / 10000

    return broker.createOrder(order, stock, qty,currentPrice)
        .catch(e => logger.error(["ERROR",e.message,order,stock,qty,currentPrice]))
        // .error(e => logger.error(["ERROR",e.message]));
}

logger.setup([
    "Stocklist: "+chalk.yellow(settings.stockFile),
    "Strategy: "+chalk.yellow(settings.strategy)
]); 

var x = function() {
    main().then(e => {
        broker.getSpotPrice("BTC/USD")
    }).catch(e => {
        logger.error(["ERROR",e.message])
    });
    if (settings.alpacaRange == "minute") {
        
    }
}
x();


// setInterval(function() {
//     main(true).catch(e => {
//         logger.error(["ERROR",e.message])
//     });
// }, settings.tradingTimeout)
