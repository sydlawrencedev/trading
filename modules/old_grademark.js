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
const trader = require('./trader');

var firstTrade = moment();
var lastTrade = moment("1980-01-01");


const startingCapital = settings.startingCapital;

var stocks = settings.stocks;

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

async function getStockData(stock) {
    return trader.getHistoricSingle(stock);
}

let addIndicators = strat.addIndicators;

function saveTrades(stock, strategyName, trades) {

    trades = trades.map((trade,i) => {
        trade.entry = strat.opens[i];
        // trade.exit = strat.exits[i];
        for (var j in strat.opens[i]) {
            trade[j] = strat.opens[i][j];
        }
        return trade;
    });

    var trades = new dataForge.DataFrame(trades)
        .transformSeries({
            entryTime: d => {
                if (d < firstTrade) firstTrade = d;
                if (d > lastTrade) lastTrade = d;
                return moment(d).format("YYYY/MM/DD")
            },
            exitTime: d => moment(d).format("YYYY/MM/DD"),
        });
    trades
        .asCSV()
        .writeFileSync("./output/"+strategyName+"-"+stock+"_trades.csv");
    if (stratName === strategyName) {
        log("trades saved > "+"./output/"+strategyName+"-"+stock+"_trades.csv")
        console.log(trades);
    }
}

function analyzeTrades(stock, strategyName, trades) {
    log("Analyzing...");
    const analysis = analyze(startingCapital, trades);
    const analysisTable = new Table();

    for (const key of Object.keys(analysis)) {
        analysisTable.cell("Metric", key);
        analysisTable.cell("Value", Math.round((analysis[key] * 1000)/1000));
        analysisTable.newRow();
    }

    const analysisOutput = analysisTable.toString();
    if (stratName == strategyName) {   
        log(analysisOutput);
    }
    const analysisOutputFilePath = "output/"+strategyName+"-"+stock+"_analysis.txt";
    fs.writeFileSync(analysisOutputFilePath, analysisOutput);
    log(">> " + analysisOutputFilePath);
    return analysis;
}

async function plotGraphs(stock, stratName, trades, inputSeries) {
    log("Plotting...");
   
    const close = inputSeries.getSeries("close").toPairs();
    const stockCurveOutputFilePath = "output/"+stratName+"-"+stock+"_stock-curve.png";
    // console.log(close);
    // return;    
    const equityCurve = computeEquityCurve(startingCapital, trades);
    const equityCurveOutputFilePath = "output/"+stratName+"-"+stock+"_my-equity-curve.png";

    // var x = [];
    // close.forEach((item, i) => {
    //     x.push([item, equityCurve[i]]);
    // });


    await plot(close, { y: { label: stock+" $" }})
        .renderImage(stockCurveOutputFilePath);
    console.log(">> " + stockCurveOutputFilePath)

    await plot(equityCurve, { y: { label: " equity $" }})
        .renderImage(equityCurveOutputFilePath);
    console.log(">> " + equityCurveOutputFilePath)
   
    console.log(await terminalImage.file(stockCurveOutputFilePath));

    console.log(await terminalImage.file(equityCurveOutputFilePath));

    return;
    const equityCurvePctOutputFilePath = "output/"+stratName+"-"+stock+"_my-equity-curve-pct.png";
    const equityPct = equityCurve.map(v => ((v - startingCapital) / startingCapital) * 100);
    await plot(equityPct, { chartType: "area", y: { label: "Equity %" }})
        .renderImage(equityCurvePctOutputFilePath);
    console.log(">> " + equityCurvePctOutputFilePath);
        
    const drawdown = computeDrawdown(startingCapital, trades);
    const drawdownOutputFilePath = "output/"+stratName+"-"+stock+"_my-drawdown.png";
    await plot(drawdown, { chartType: "area", y: { label: "Drawdown $" }})
        .renderImage(drawdownOutputFilePath);
    console.log(">> " + drawdownOutputFilePath);
        
    const drawdownPctOutputFilePath = "output/"+stratName+"-"+stock+"_my-drawdown-pct.png";
    const drawdownPct = drawdown.map(v => (v / startingCapital) * 100);
    await plot(drawdownPct, { chartType: "area", y: { label: "Drawdown %" }})
        .renderImage(drawdownPctOutputFilePath);
    console.log(">> " + drawdownPctOutputFilePath);
}

async function backtestSpecificStrategy(strategyName, stock) {
    let inputSeries = await getStockData(stock);
    var strategy = require("./strategies/"+strategyName);
    try {
        inputSeries = strategy.addIndicators(inputSeries);
    } catch (e) {
        console.log(chalk.red("Error in strategy "+strategyName + " : "+stock + " " +inputSeries.count(),e.error))
        console.log(e.message);
    }
    var trades = [];
    if (inputSeries.count() > 0) {
        trades = await backtest(strategy.strategy, inputSeries);
    }
    
    var analysis = analyzeTrades(stock, strategyName, trades, inputSeries);
    saveTrades(stock, strategyName, trades);
    return {
        name: strategyName,
        trades: trades,
        analysis: analysis,
        series: inputSeries
    }
}

async function backtestStock(stock, skipGraphs, strat) {
    log("Backtesting " + stock + "...");
    var results = await backtestSpecificStrategy(stratName, stock);
    var comparisons = [];
    for (var i = 0; i < settings.comparisons.length; i++) {
        var rc = await backtestSpecificStrategy(settings.comparisons[i], stock);
        comparisons.push(rc)
    }
    return {
        dataSeries: results.series,
        analysis: results.analysis, 
        trades: results.trades,
        comparisons: comparisons
    }
}

async function main() {
    totalProfit = 0;
    marketProfit = 0;
    baseAlgoProfit = 0;
    totalTrades = 0;
    comparisonProfit = [];

    console.log("Starting capital: $" + Math.round(settings.startingCapital * settings.stocks.length));
    console.log("Assigned $"+Math.round(settings.startingCapital) + " per ticker, across "+settings.stocks.length+" tickers")
        
    console.log("Trading window: " + settings.timeWindow.start + " -> " + settings.timeWindow.end)

    console.log("Strategy in place: "+chalk.yellow(stratName));
    console.log("Comparison strategies: "+settings.comparisons.join(", "));

    var myArgs = process.argv.slice(2);
    var options = processArgs(myArgs);;
    var allResults = [];

    trader.addStocks(stocks);

    for (const stock of stocks) {
        await backtestStock(stock, false).then(function(results) {
            allResults.push({
                stock: stock,
                results: results
            });
            totalTrades += results.analysis.totalTrades;
            totalProfit += profit = Math.round(results.analysis.profit);

            var cps = [];
            var cpstr = [];
            for (var i = 0; i < results.comparisons.length; i++) {
                
                if (comparisonProfit[results.comparisons[i].name] == undefined) {
                    comparisonProfit[results.comparisons[i].name] = 0
                }
                comparisonProfit[results.comparisons[i].name] += cp = Math.round(results.comparisons[i].analysis.profit);
                var str = results.comparisons[i].name + ": "+cp
                cps.push(cp);
                cpstr.push(chalk.colorize(profit, cp, str));
            }

            var text = stock +": " + profit +" across " + results.analysis.totalTrades + " trades ("

            var bestComparison = Math.max(...cps);

            if (Math.round(profit) == Math.round(bestComparison)) {
                text = chalk.yellow(text);
            }
            else if (Math.round(profit) > Math.round(bestComparison)) {
                if (Math.round(profit) > 0) {
                    text = chalk.bgGreen(chalk.black(text));
                } else {
                    text = chalk.bgYellow(chalk.black(text));
                }
            }
            else if (Math.round(profit) < Math.round(bestComparison)) {
                if (profit < 0) {
                    text = chalk.bgYellow(chalk.black(text));
                } else {
                    text = chalk.bgRed(chalk.white(text));
                } 
            }

            text += cpstr.join(", ") + ")";
            console.log(text);

            if(stocks.length == 1)  {

                

                var losses = results.trades.filter(trade => trade.profit < 0)
               
                
                // console.log(losses[0]);
                // console.log(strat.opens);
                console.log(losses.length + " losses");
                // return;

                plotGraphs(stock, stratName, results.trades, results.dataSeries);

            }
        }).catch(err => {
            console.error("An error occurred.");
            console.error(err && err.stack || err);
        });
    }

    // backtestStock(stock, options.f);
    return {
        results: allResults,
        totalProfit: totalProfit,
        comparisonProfit: comparisonProfit
    }
};


async function mainOld() {
    totalProfit = 0;
    marketProfit = 0;
    baseAlgoProfit = 0;
    totalTrades = 0;
    comparisonProfit = [];

    console.log("Starting capital: $" + Math.round(settings.startingCapital * settings.stocks.length));
    console.log("Assigned $"+Math.round(settings.startingCapital) + " per ticker, across "+settings.stocks.length+" tickers")
        
    console.log("Trading window: " + settings.timeWindow.start + " -> " + settings.timeWindow.end)

    console.log("Strategy in place: "+chalk.yellow(stratName));
    console.log("Comparison strategies: "+settings.comparisons.join(", "));

    var myArgs = process.argv.slice(2);
    var options = processArgs(myArgs);;
    var allResults = [];
    for (const stock of stocks) {
        await backtestStock(stock, false).then(function(results) {
            allResults.push({
                stock: stock,
                results: results
            });
            totalTrades += results.analysis.totalTrades;
            totalProfit += profit = Math.round(results.analysis.profit);

            var cps = [];
            var cpstr = [];
            for (var i = 0; i < results.comparisons.length; i++) {
                
                if (comparisonProfit[results.comparisons[i].name] == undefined) {
                    comparisonProfit[results.comparisons[i].name] = 0
                }
                comparisonProfit[results.comparisons[i].name] += cp = Math.round(results.comparisons[i].analysis.profit);
                var str = results.comparisons[i].name + ": "+cp
                cps.push(cp);
                cpstr.push(chalk.colorize(profit, cp, str));
            }

            var text = stock +": " + profit +" across " + results.analysis.totalTrades + " trades ("

            var bestComparison = Math.max(...cps);

            if (Math.round(profit) == Math.round(bestComparison)) {
                text = chalk.yellow(text);
            }
            else if (Math.round(profit) > Math.round(bestComparison)) {
                if (Math.round(profit) > 0) {
                    text = chalk.bgGreen(chalk.black(text));
                } else {
                    text = chalk.bgYellow(chalk.black(text));
                }
            }
            else if (Math.round(profit) < Math.round(bestComparison)) {
                if (profit < 0) {
                    text = chalk.bgYellow(chalk.black(text));
                } else {
                    text = chalk.bgRed(chalk.white(text));
                } 
            }

            text += cpstr.join(", ") + ")";
            console.log(text);

            if(stocks.length == 1)  {

                

                var losses = results.trades.filter(trade => trade.profit < 0)
               
                
                // console.log(losses[0]);
                // console.log(strat.opens);
                console.log(losses.length + " losses");
                // return;

                plotGraphs(stock, stratName, results.trades, results.dataSeries);

            }
        }).catch(err => {
            console.error("An error occurred.");
            console.error(err && err.stack || err);
        });
    }

    // backtestStock(stock, options.f);
    return {
        results: allResults,
        totalProfit: totalProfit,
        comparisonProfit: comparisonProfit
    }
};

main()
    .then(results => {

        console.log("Strategy "+stratName)
        console.log("Profit of $"+Math.round(totalProfit))
        console.log("Across "+ totalTrades + " trades starting " + moment(firstTrade).format("DD/MM/YYYY") + ", last trade: "+ moment(lastTrade).format("DD/MM/YYYY"));
        console.log("Final pot of $"+Math.round(totalProfit + settings.startingCapital * settings.stocks.length))
        
        var winner = {
            name: "",
            profit: -1000000
        };
        for (var i in results.comparisonProfit) {
            if (results.comparisonProfit[i] > winner.profit) {
                winner.name = i;
                winner.profit = results.comparisonProfit[i];
            }
        }
        
        var marketProfit = winner.profit;

        if (Math.round(totalProfit) == Math.round(marketProfit)) {
            console.log(chalk.bgRed("  ")+chalk.bgYellow(chalk.black(" Same as top strategy ("+winner.name+"): " + Math.round(totalProfit) + " vs " + Math.round(marketProfit))+" ")+chalk.bgRed("  "));
        }
        if (Math.round(totalProfit) > Math.round(marketProfit)) {
            console.log(chalk.bgYellow("  ")+chalk.bgGreen(chalk.black(" More than top strategy ("+winner.name+"): " + Math.round(totalProfit) + " vs " + Math.round(marketProfit))+" ")+chalk.bgYellow("  "));
        }
        if (Math.round(totalProfit) < Math.round(marketProfit)) {
            console.log(chalk.bgYellow("  ")+chalk.bgRed(" Less than winning strategy ("+winner.name+"): " + Math.round(totalProfit) + " vs " + Math.round(marketProfit)+" ")+chalk.bgYellow("  "));
        }
        var text = []
        for (var i in results.comparisonProfit) {
            text.push(chalk.colorize(totalProfit, results.comparisonProfit[i], i + " "+ results.comparisonProfit[i]));
        }
        console.log(text.join(", "));


    })
    .catch(err => {
        console.error("An error occurred.");
        console.error(err && err.stack || err);
    });


