const CoinAPI = require('coinapi-io');
const subHours = require('date-fns').subHours;


const settings = require('../settings');
const axios = require('axios');
const fs = require('fs');
const moment = require('moment');
const logger = require('./logger');
const tickers = require('./tickers');

const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.

var broker = require("./broker")

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var MarketData = {

    filename: function(ticker, timeframe, interval, mode = "test") {
        return ticker + "_" + timeframe + "_" + interval + "_" + mode;
    },

    fetchHistoricSingle: async function(stockTicker, timeframe = "daily", interval = false) {
        var filename = process.mainModule.path + "/data/" + this.filename(stockTicker, timeframe, interval) + ".csv";

        var dataFunction = "TIME_SERIES_DAILY";
        switch (timeframe) {
            case "minute":
                dataFunction = "TIME_SERIES_INTRADAY"
                break;
            default:
                dataFunction = "TIME_SERIES_DAILY"
        }
        var df;
        var crypto = false;
        if (stockTicker.indexOf("CRYPTO_") > -1) {
            crypto = true;
        }

        var url = "https://www.alphavantage.co/query?function=" + dataFunction + "&symbol=" + stockTicker + "&outputsize=full&datatype=csv&apikey=" + settings.alphavantagekey;

        if (interval) {
            url += "&interval=" + interval;
        }
        var responseType = "stream";
        if (crypto) {
            responseType = "json"
            ticker = stockTicker.replace("CRYPTO_", "");
            url = 'https://min-api.cryptocompare.com/data/histoday?aggregate=1&e=CCCAGG&extraParams=CryptoCompare&fsym=' + ticker.toUpperCase() + '&limit=2000&tryConversion=false&tsym=USD';
        }
        var response = await axios({
            method: "get",
            url: url,
            responseType: responseType
        });
        if (response.status == 200) {
            logger.success([stockTicker, "Downloaded historical stock data"]);
            try {
                tickers.refetch();
                await fs.unlinkSync(filename);
            } catch (e) {

            }
            var dateFormat = "YYYY-MM-DD";
            switch (timeframe) {
                case "minute":
                    dateFormat = "YYYY-MM-DD HH:mm:ss";
            }
            if (crypto) {
                var headers = "timestamp,open,high,low,close,volume\n";
                await fs.appendFileSync(filename, headers);

                var rows = [];
                for (var i = 0; i < response.data.Data.length; i++) {
                    var row = response.data.Data[i];
                    rows.push([
                        moment(row.time * 1000).format(dateFormat),
                        row.open,
                        row.high,
                        row.low,
                        row.close,
                        row.volumefrom
                    ].join(","));
                }
                rows = rows.reverse();

                for (var i = 0; i < rows.length; i++) {
                    await fs.appendFileSync(filename, rows[i] + "\n");
                }

            } else {
                await response.data.pipe(fs.createWriteStream(filename));
            }
            await sleep(10000);
            var single = await this.getHistoricSingle(stockTicker, timeframe, interval);
            return single;
        } else {
            console.log(response);
            console.log(url);
            console.log(chalk.red("Failed to download stock data for " + stockTicker));
            process.exit();
        }
        return df;
    },

    getHistoricSingle: async function(stockTicker, timeframe = "daily", interval = false) {

        var filename = process.mainModule.path + "/data/" + this.filename(stockTicker, timeframe, interval) + ".csv";
        var df;
        try {
            var dateFormat = "YYYY-MM-DD";
            switch (timeframe) {
                case "minute":
                    dateFormat = "YYYY-MM-DD HH:mm:ss";
            }
            // if file exists
            if (fs.existsSync(filename)) {
                var f = fs.readFileSync(filename);
                // if it's an error file
                if (f.length == 0 || f.toString()[0] === "{") {
                    // delete the file

                    if (f.toString()[0] === "{") {
                        var rsp = JSON.parse(f.toString());
                        if (rsp["Error Message"]) {
                            logger.error([stockTicker, rsp["Error Message"]]);
                            return false;
                        }

                    }

                    await fs.unlinkSync(filename);
                    await sleep(2);
                    return this.getHistoricSingle(stockTicker, timeframe, interval);
                }

                // doesn't exist, go get it
            } else {
                var x = await MarketData.fetchHistoricSingle(stockTicker, timeframe, interval);
                return x;
            }

            df = dataForge.readFileSync(filename)
                .parseCSV()
                .parseDates("timestamp", dateFormat);
            // if (df.getSeries("timestamp").count() < 3) {
            //     await fs.unlinkSync("data/"+this.filename(stockTicker,timeframe,interval)+".csv");
            //     // x = await MarketData.fetchHistoricSingle(stockTicker, timeframe, interval);
            //     // return x;
            // }
        } catch (e) {

            console.log("error");
            console.log(e.message);
            console.log(e);
            process.exit();
            // x = await MarketData.fetchHistoricSingle(stockTicker, timeframe, interval);
            // return x;
        }

        df = df.parseFloats(["open", "high", "low", "close", "volume"])

        df = df // Index so we can later merge on date.
            .reverse()
            .renameSeries({ timestamp: "time" }).setIndex("time");

        var x = df;
        if (settings.timeWindow.start) {
            df = df.where(row => row.time >= moment(settings.timeWindow.start));
            df = df.where(row => row.time <= moment(settings.timeWindow.end));
        }

        if (df.count() == 0) {
            // console.log(x.toString());
            logger.error([stockTicker, "No data found for " + moment(settings.timeWindow.start) + " -> " + moment(settings.timeWindow.end)]);
            // return this.fetchHistoricSingle(stockTicker, timeframe, interval);
        }

        return df;
    },

    getLiveData: async function(stocks, cb) {
        return broker.getBars(
            stocks,
            cb
        );
    }

};

module.exports = MarketData;