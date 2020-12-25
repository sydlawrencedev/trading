const settings = require('./settings');



var stratName = settings.strategy;

const strat = require('./strategies/'+stratName);


const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
const chalk = require('chalk');
const axios = require('axios');
const { plot } = require('plot');
require('@plotex/render-image')
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
var Table = require('easy-table');
const fs = require('fs');
const moment = require('moment');
const terminalImage = require('terminal-image');

var firstTrade = moment();
var lastTrade = moment("1980-01-01");


const startingCapital = settings.startingCapital;
// This is a very simple and very naive mean reversion strategy:
const strategy = strat.strategy;

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

Array.prototype.forEachAsync = async function (fn) {
    for (let t of this) { await fn(t) }
}

function getBaseline(stock) {
    return settings.baseline[stock];
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

    try {
        var df = dataForge.readFileSync("data/"+stock+".csv")
            .parseCSV()
            .parseDates("timestamp", "YYYY-MM-DD");
    } catch (e) {
        var url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol="+stock+"&outputsize=full&datatype=csv&apikey="+settings.alphavantagekey;
         

        await axios({
            method: "get",
            url: url,
            responseType: "stream"
        }).then(async function (response) {
            // if (response.)
            // return;
            await response.data.pipe(fs.createWriteStream("data/"+stock+".csv"));
        });

        console.log("Downloaded stock data for " + stock);
        return getStockData(stock);
    }
    

      
    df = df.parseFloats(["open", "high", "low", "close", "volume"])

    df = df.setIndex("timestamp") // Index so we can later merge on date.
        .reverse()
        .renameSeries({ timestamp: "time" });
    df = df.where(row => row.time > moment(settings.timeWindow.start));
    df = df.where(row => row.time < moment(settings.timeWindow.end));



        // console.log(df.toString());

    return df;
}

let addIndicators = strat.addIndicators;

function saveTrades(stock, trades) {
    new dataForge.DataFrame(trades)
        .transformSeries({
            entryTime: d => {
                if (d < firstTrade) firstTrade = d;
                if (d > lastTrade) lastTrade = d;
                return moment(d).format("YYYY/MM/DD")
            },
            exitTime: d => moment(d).format("YYYY/MM/DD"),
        })
        .asCSV()
        .writeFileSync("./output/"+stratName+"-"+stock+"_trades.csv");
}

function analyzeTrades(stock, trades) {
    log("Analyzing...");
    const analysis = analyze(startingCapital, trades);
    // console.log(analysis);
    // console.log(trades);


    // if (trades[0].entryTime === undefined) {
    //     console.log(chalk.red("oh no! entry time is undefined for " + stock));
    //     console.log(df);
    // }

    const analysisTable = new Table();

    for (const key of Object.keys(analysis)) {
        analysisTable.cell("Metric", key);
        analysisTable.cell("Value", Math.round((analysis[key] * 1000)/1000));
        analysisTable.newRow();
    }

    const analysisOutput = analysisTable.toString();
    log(analysisOutput);
    const analysisOutputFilePath = "output/"+stratName+"-"+stock+"_analysis.txt";
    fs.writeFileSync(analysisOutputFilePath, analysisOutput);
    log(">> " + analysisOutputFilePath);
    return analysis;
}

async function plotGraphs(stock, trades, inputSeries) {
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

async function backtestStock(stock, skipGraphs, strat) {
    if (strat == undefined) {
        strat = strategy;
    }
    log("Loading and preparing data.");

    let inputSeries = await getStockData(stock);
    inputSeries = addIndicators(inputSeries);
    
    log("Backtesting...");
    var trades = [];
    try {
        test = backtest(strat, inputSeries);
        trades = test;
    } catch (e) {

    }

    saveTrades(stock, trades);
    analysis = analyzeTrades(stock, trades, inputSeries);

    return {
        dataSeries: inputSeries,
        analysis: analysis, 
        trades: trades
    }
}

async function main() {
    totalProfit = 0;
    marketProfit = 0;
    baseAlgoProfit = 0;
    totalTrades = 0;

    console.log("Starting capital: $" + Math.round(settings.startingCapital * settings.stocks.length));
    console.log("Assigned $"+Math.round(settings.startingCapital) + " per ticker, across "+settings.stocks.length+" tickers")
        
    console.log("Trading window: " + settings.timeWindow.start + " -> " + settings.timeWindow.end)

    var myArgs = process.argv.slice(2);
    var options = processArgs(myArgs);;

    for (const stock of stocks) {
        await backtestStock(stock, false).then(function(results) {
            // var baseline = getBaseline(stock);
            // if (baseline > 0 || baseline < 0) {
            //     baseAlgoProfit += baseline;
            // }

            totalTrades += results.analysis.totalTrades;
            totalProfit += profit = Math.round(results.analysis.profit);
            var hasValues = false;
            try {
                results.dataSeries.first();
                hasValues = true;
            } catch (e) {
                market = 0;
            }
            if (hasValues) {
                marketProfit += market = Math.round((settings.startingCapital / results.dataSeries.first().open) * results.dataSeries.last().close - settings.startingCapital);
            }        
            // if (isNaN(baseline) || baseline == false) {
            //     console.log(chalk.bgRed("No baseline for " + stock));
            //     backtestStock(stock, false, require("./strategies/base").strategy).then(function(results) {
            //         console.log(chalk.cyan(stock+" baseline = " +Math.round(results.analysis.profit)));
            //     })
            // } else {
            if (Math.round(profit) == Math.round(market)) {
                console.log(chalk.yellow(stock+" Equal: " + Math.round(profit) + " vs " + Math.round(market) + " across " + results.analysis.totalTrades + " trades"));
            }
            if (Math.round(profit) > Math.round(market)) {
                if (Math.round(profit) > 0) {
                    console.log(chalk.bgGreen(chalk.black(stock+" More: " + Math.round(profit) + " vs " + Math.round(market) + " across " + results.analysis.totalTrades + " trades")));
                } else {
                    console.log(chalk.bgYellow(chalk.black(stock+" More: " + Math.round(profit) + " vs " + Math.round(market) + " across " + results.analysis.totalTrades + " trades")));
                }
            }
            if (Math.round(profit) < Math.round(market)) {
                if (profit < 0) {
                    console.log(chalk.bgYellow(chalk.black(stock+" Less: " + Math.round(profit) + " vs " + Math.round(market) + " across " + results.analysis.totalTrades + " trades")));
                } else {
                    console.log(chalk.bgRed(stock+" Less: " + Math.round(profit) + " vs " + Math.round(market) + " across " + results.analysis.totalTrades + " trades"));
                }
            }
            // }
            // if (profit > market) {
            //     console.log(chalk.green("     " + Math.round(results.analysis.profit) + " across " + results.analysis.totalTrades + " trades ("+Math.round(market)+")"));
            // } else {
            //     console.log(chalk.red("     " + Math.round(results.analysis.profit) + " across " + results.analysis.totalTrades + " trades ("+Math.round(market)+")"));
            // }
            if(stocks.length == 1) 
                plotGraphs(stock, results.trades, results.dataSeries);
        }).catch(err => {
            console.error("An error occurred.");
            console.error(err && err.stack || err);
        });
    }

    // backtestStock(stock, options.f);
  
};

main()
    .then(() => {

        console.log("Profit of $"+Math.round(totalProfit))
        console.log("Across "+ totalTrades + " trades starting " + moment(firstTrade).format("DD/MM/YYYY") + ", last trade: "+ moment(lastTrade).format("DD/MM/YYYY"));
        console.log("Final pot of $"+Math.round(totalProfit + settings.startingCapital * settings.stocks.length))

        console.log("Passively traded would be $"+Math.round(marketProfit + settings.startingCapital * settings.stocks.length))

        if (Math.round(totalProfit) == Math.round(marketProfit)) {
            console.log(chalk.bgRed("  ")+chalk.bgYellow(chalk.black(" Same as market: " + Math.round(totalProfit) + " vs " + Math.round(marketProfit))+" ")+chalk.bgRed("  "));
        }
        if (Math.round(totalProfit) > Math.round(marketProfit)) {
            console.log(chalk.bgYellow("  ")+chalk.bgGreen(chalk.black(" More than market: " + Math.round(totalProfit) + " vs " + Math.round(marketProfit))+" ")+chalk.bgYellow("  "));
        }
        if (Math.round(totalProfit) < Math.round(marketProfit)) {
            console.log(chalk.bgYellow("  ")+chalk.bgRed(" Less than market: " + Math.round(totalProfit) + " vs " + Math.round(marketProfit)+" ")+chalk.bgYellow("  "));
        }

    })
    .catch(err => {
        console.error("An error occurred.");
        console.error(err && err.stack || err);
    });


