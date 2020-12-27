const settings = require('../settings');
const axios = require('axios');
const fs = require('fs');
const moment = require('moment');

const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.


var  MarketData = {

    fetchHistoricSingle: async function(stockTicker) {
        var df;
        var url = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol="+stockTicker+"&outputsize=full&datatype=csv&apikey="+settings.alphavantagekey;
        var response = await axios({
            method: "get",
            url: url,
            responseType: "stream"
        });
        if (response.status == 200) {
            log("Downloaded stock data for " + stockTicker);
            try {
                await fs.unlinkSync("data/"+stockTicker+".csv");
            } catch (e) {
    
            }
            var s = await response.data.pipe(fs.createWriteStream("data/"+stockTicker+".csv"));
            
            df = await dataForge.readFileSync("data/"+stockTicker+".csv")
                .parseCSV()
                .parseDates("timestamp", "YYYY-MM-DD");
        } else {
            console.log(response);
            console.log(url);
            console.log(chalk.red("Failed to download stock data for " + stockTicker));
            process.exit();
        }
        return df;
    },
    
    getHistoricSingle: async function(stockTicker) {
        var df;
        try {
            f = fs.readFileSync("data/"+stockTicker+".csv");
            if (f.length == 0 || f.toString()[0] === "{") {
                await fs.unlinkSync("data/"+stockTicker+".csv");
            }
    
            df = dataForge.readFileSync("data/"+stockTicker+".csv")
                .parseCSV()
                .parseDates("timestamp", "YYYY-MM-DD");
    
            if (df.getSeries("timestamp").count() < 3) {
                await fs.unlinkSync("data/"+stockTicker+".csv");
                await MarketData.fetchHistoricSingle(stockTicker);
                return;
            }
        } catch (e) {
            df = await MarketData.fetchHistoricSingle(stockTicker);
        }
          
        df = df.parseFloats(["open", "high", "low", "close", "volume"])
    
        df = df.setIndex("timestamp") // Index so we can later merge on date.
            .reverse()
            .renameSeries({ timestamp: "time" });
        df = df.where(row => row.time > moment(settings.timeWindow.start));
        df = df.where(row => row.time < moment(settings.timeWindow.end));
    
        return df;
    },
    
    getLiveData: async function(stocks, timeframe) {
        return alpaca.getBars(
            'minute',
            stocks
        );
    }

};

module.exports = MarketData;