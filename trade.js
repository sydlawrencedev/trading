var chalk = require("chalk");


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

chalk.colorize = function(val, base, str) {
    if (val > base) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val < base) {
        return chalk.bgRed(chalk.white(str))
    } else {
        return chalk.bgYellow(chalk.black(str))
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

        log("About to commence backtesting")

        var requiresActivty = false;   
        for (var j = 0; j < stocks.length; j++) {
            var stock = stocks[j];
            var df = new dataForge.DataFrame(bars[stock])
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
                
        }

        var trades = [];
        try {
            trades = await trader.backtest(true);
        } catch (e) {
            console.log("ERROR");
            console.log(e);
            trades = [];
        }
        // console.log(trades);

        var attemptedTrades = {};

        trades = trades.filter(trade => trade.time >= df.last().time - 30 * 1000); 

        log("Latest data: " + moment(df.last().time).format("DD/MM/YYYY HH:mm"));
        log(trades.length + " suggested trades");
        
        console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "STATUS",trades.length + " potential trades found"].join("\t"))

        
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

                            console.log(chalk.red([
                                moment().format("DD/MM/YYYY HH:mm:ss"),
                                "SELL",
                                trade.ticker,
                                chalk.colorize(
                                    position.market_value*1,
                                    position.cost_basis*1,
                                    (position.market_value - position.cost_basis).toFixed(2) + " ("+(position.unrealized_plpc * 100).toFixed(1)+"%)"
                                ),
                                "Not selling at a loss",
                                trade.sellSignal,
                                trade.sellReason
                            ].join("\t")));                            
                        }
                    }
                    if (toSell) {

                        requiresActivty = true;

                        attemptedTrades[trade.ticker] = true;
                        var sellResponse = await sellStock(trade.ticker, position.qty);

                        console.log([
                            moment().format("DD/MM/YYYY HH:mm:ss"),
                            "SELL",
                            trade.ticker,
                            chalk.colorize(
                                position.market_value*1,
                                position.cost_basis*1,
                                (position.market_value - position.cost_basis).toFixed(2) + " ("+(position.unrealized_plpc * 100).toFixed(1)+"%)"
                            ),
                            Math.round(position.current_price)+"", Math.round(position.market_value)+"  ",
                            trade.sellSignal,
                            trade.sellReason
                        ].join("\t"));
                    }
                } catch (e) {
                    if (e.error !== undefined && e.error.code == 40410000) {
                        // simply position doesn't currently exist
                    } else {
                        // console.log("position doesn't exist with "+stock);
                        console.log(chalk.red([
                            moment().format("DD/MM/YYYY HH:mm:ss"),
                            "ERROR",
                            trade.ticker,
                            e.error.code,
                            e.error.message
                        ].join("\t")));
                    }
                }
            }
            else if (trade.buySignal > trade.sellSignal) {
                // console.log(trade);
                requiresActivty = true;
                var account = await alpaca.getAccount();
                var positions = await alpaca.getPositions();
                portfolio.updateFromAlpaca(account, positions);
                var amountToSpend = portfolio.getAmountToSpend(trade);
                var quantity = Math.floor(amountToSpend / trade.close);
                amountToSpend = quantity * trade.close;
                if (quantity > 0) {
                    console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "BUY ",trade.ticker,Math.round(quantity),Math.round(trade.close)+"", Math.round(amountToSpend)+"   ", trade.buySignal, trade.buyReason].join("\t"));
                    var purchase = await buyStock(trade.ticker, quantity, trade.close)
                }
                
            }
        }

        var account = await alpaca.getAccount();
        var positions = await alpaca.getPositions();
        portfolio.updateFromAlpaca(account, positions);


    })().catch(e => {
        console.log(chalk.red([
            moment().format("DD/MM/YYYY HH:mm:ss"),
            "ERROR",
            e.message,
            // e.error,
        ].join("\t")))
        
    });
}


async function main(repeating) {
    if (repeating !== true) {
        console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "STATUS","Connecting to the markets and analyzing trades"].join("\t"))
        await trader.addStrategyByName(settings.strategy);
    }
    stocks = await tickers.fetch(settings.stockFile)
    log("Adding " + stocks.length + " stocks")
    alpaca.getAccount().then((account, err) => {
        if (!account) {
            console.log(chalk.red("eurgh"));
            console.log(account);
            console.log(err);
        }
        // console.log(account);
        var color = "yellow";
        if (account.equity > startingCash )
            color = "green";
        else if (account.equity < startingCash)
            color = "red";
    
        // console.log(account);

        alpaca.getPositions().then(positions => {
            portfolio.updateFromAlpaca(account, positions);
        });
          

        alpaca.getBars(
            'minute',
            stocks
        ).then(response => {
            gotBars(response, true);   
        }).catch(e => 
            console.log(chalk.red([
                moment().format("DD/MM/YYYY HH:mm:ss"),
                "ERROR",
                "Failed to get market data from alpaca",
                e.error,
                e.message
            ].join("\t"))) 
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
        }, // optional,
        stop_loss: {
            stop_price: stop_loss
        }, // optional,
    }).catch(e => {
        // console.log("catch");
        // console.log(e);
    }).error(e => {
        console.log("error");
        // console.log(e);
    });
}

// sellStock("RIOT",2).then(e => console.log(e)).catch(e => console.log("error"));

console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "STATUS","Setting up", "Stocklist: "+chalk.yellow(settings.stockFile), "Strategy: "+chalk.yellow(settings.strategy)].join("\t"))



statusUpdate = function() {
    alpaca.getAccount().then(account => {

        alpaca.getPositions().then(positions => {
            portfolio.updateFromAlpaca(account, positions);

            var profit = trader.portfolio.getProfit();

            console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "STATUS",chalk.colorize(profit,0,"ROI: "+ (profit / startingCash).toFixed(5)), "Cash: $"+portfolio.cash.toFixed(0), "Portfolio: $"+Math.round(portfolio.portfolioValue), chalk.colorize(profit,0,"Total Profit: $"+profit.toFixed(0))].join("\t"))
            console.log([moment().format("DD/MM/YYYY HH:mm:ss"), "STATUS","Active positions: "+positions.length].join("\t"))

        })
    });
}
statusUpdate();
main().catch(e => {
    console.log(chalk.red([
        moment().format("DD/MM/YYYY HH:mm:ss"),
        "ERROR",
        e.message,
        // e.error,
    ].join("\t")))
});


setInterval(function() {
    statusUpdate();
}, 5 * 60 * 10000)


setInterval(function() {
    main(true).catch(e => {
        console.log(chalk.red([
            moment().format("DD/MM/YYYY HH:mm:ss"),
            "ERROR",
            e.message,
            // e.error,
        ].join("\t")))
    });
}, settings.tradingTimeout)
