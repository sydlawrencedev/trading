const readline = require('readline');

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





const settings = require('./settings');
const Alpaca = require('@alpacahq/alpaca-trade-api')
const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
const chalk = require("chalk");

process.env.APCA_API_KEY_ID = settings.alpaca.key;
process.env.APCA_API_SECRET_KEY = settings.alpaca.secret;
process.env.APCA_API_BASE_URL = settings.alpaca.endpoint;

const alpaca = new Alpaca({
    usePolygon: false
});

var startingEquity = 100000;
var maxActiveHoldings = 20;

alpaca.getAccount().then((account) => {
    var color = "yellow";
    if (account.equity > startingEquity )
        color = "green";
    else if (account.equity < startingEquity)
        color = "red";

        console.log(account);
        console.log(chalk[color]("Current account equity: $"+account.equity));

});

var usdPerPot = startingEquity / maxActiveHoldings;

var getAmountToSpend = function() {
    return startingEquity / maxActiveHoldings;
}

var stratName = settings.strategy;
const strat = require('./strategies/'+stratName);
const strategy = strat.strategy;

let addIndicators = strat.addIndicators;


var stocks = settings.stocks;

gotBars = function(response, moreToTry) {
    if (moreToTry) {
        console.log("Running algos");
    }
    (async function() {
        var requiresActivty = false;   
        for (var j = 0; j < stocks.length; j++) {
            var stock = stocks[j];
            var df = new dataForge.DataFrame(response[stock])
                .transformSeries({
                    startEpochTime: value => new Date(value*1000)
                })
            df = df.setIndex("startEpochTime") // Index so we can later merge on date.
                    .renameSeries({ startEpochTime: "time" })
                    .renameSeries({ openPrice: "open" })
                    .renameSeries({ highPrice: "high" })
                    .renameSeries({ lowPrice: "low" })
                    .renameSeries({ closePrice: "close" });

            df = addIndicators(df);
            var trades = [];
            try {
                trades = backtest(strategy, df);
                
            } catch (e) {
                // console.log("ERROR");
                // console.log(e);
                trades = [];
            }


            for (var i = 0; i < trades.length; i++) {
                var trade = trades[i];
                console.log("TRADES");
                // console.log(trade);
                // if ((new Date(args.bar.time)).getTime() > (new Date()).getTime() - 2 * 24 * 60 * 60 * 1000) {
                //     console.log(chalk.red(args.bar.time + " exit the position"));
                // }
                // if (trade.exitTime > trade.entryTime) {
                if (trade.exitTime > (new Date()).getTime() - 1 * 24 * 60 * 60 * 1000) {
                    // console.log(trade);
                    try {
                        var position = await getStock(stock)
                        console.log(chalk.red(stock + ": exit the position"));
                    
                        console.log("position");
                        console.log(position);
                        requiresActivty = true;
                        const ans = await askQuestion("Would you like to sell "+stock+"?\n");
                        if (ans.toLowerCase().indexOf("y") > -1) {
                            console.log("selling  "+stock);
                            await sellStock(stock)
                        } else {
                            console.log("roger that");
                        }
                    } catch (e) {
                        // console.log(chalk.red(stock + ": " + e.error.message));
                        // console.log("position doesn't exist with "+stock);
                    }
                }
                else if (trade.entryTime > (new Date()).getTime() - 1 * 24 * 60 * 60 * 1000) {
                    console.log(chalk.green(stock + ": enter the position"));
                    // console.log(trade);
                    requiresActivty = true;
                    var amountToSpend = getAmountToSpend();
                    const ans = await askQuestion("Would you like to buy $"+Math.round(amountToSpend)+" of "+stock+"?\n");
                    if (ans.toLowerCase().indexOf("y") > -1) {
                        console.log("buying "+stock);
                        await buyStock(stock, amountToSpend / trade.entryPrice, trade.entryPrice)
                    } else {
                        console.log("roger that");
                    }
                    
                }
            }
                
        }
        if (!requiresActivty && !moreToTry) {
            console.log(chalk.green("No trades to perform. Have a good day!"));
            process.exit();
        } else {
            alpaca.getBars(
                'day',
                stocks
            ).then(response => {
                gotBars(response, false);
            });    
        }
    })()
}

console.log("getting stocks data");
alpaca.getBars(
    'minute',
    stocks
).then(response => {
    gotBars(response, true);
   
});

getStock = function(stock) {
    return alpaca.getPosition(stock);
}

sellStock = function(stock, qty) {
    return orderStock("sell", stock, qty);
}

buyStock = function(stock, qty, currentPrice) {
    return orderStock("buy", stock, qty, currentPrice);
}

orderStock = function(order, stock, qty, currentPrice) {
    qty = Math.max(1,Math.round(qty));
    if (order == "sell") {
        var take_profit = currentPrice * 1.05;
        var stop_loss = currentPrice * 0.98;
    }
    return alpaca.createOrder({
        symbol: stock, // any valid ticker symbol
        qty: Math.max(1,Math.round(qty)),
        side: order,
        type: 'market',
        time_in_force: 'day',
        take_profit: {
            limit_price: take_profit
        }, // optional,
        stop_loss: {
            stop_price: stop_loss
        }, // optional,
    }).then(actualOrder => {
        console.log(chalk.green(qty + " " + stock + " "+order + " "+actualOrder.status));
    }).catch(e => {
        console.log("catch");
        console.log(e);
    }).error(e => {
        console.log("error");
        console.log(e);
    });
}

