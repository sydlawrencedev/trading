var data_forge_1 = require("data-forge");
const tickers = require('../modules/tickers');

module.exports = {
    description: "Base v0.5",
    name: "Base v0.5",
    limitOrder: 1000.15, // no acceptable limit order
    stopLossPct: -0.1, // stop loss at 10%
    acceptableLoss: -0.05, // accept mac of 5% loss aside from stop loss
    maxHoldings: 20,
    maxOpenPerTicker: 30000000,
    maxHolding: 0.8, // max holding 80% of the portfolio
    buySignalCashWeighting: 50,
    secondPurchaseStockWeighting: 0.5,
    firstPurchaseStockWeighting: 0.1,
    maxBuyMoreProfit: 0.90,
    maxBuyMoreLoss: -0.05,
    amountToSpend: function(info, totalCash, openTrades = [], openTradesSameTicker = [], allHoldings = {}, portfolio) {
        this.maxTradesOpen = Math.min(this.maxHoldings, tickers.active.length);
        this.maxTradesOpen = Math.ceil(tickers.active.length / 2);
        var anyAtLoss = false;
        var tradedBefore = openTradesSameTicker.length > 0;
        var totalHolding = 0;
        for (var i = 0; i < openTradesSameTicker.length; i++) {
            totalHolding += openTradesSameTicker[i].currentValue({ close: info.close });

            if (openTradesSameTicker[i].data.profit < this.maxBuyMoreLoss) {
                throw new Error("Already at a loss with " + info.ticker + " (" + Math.round(openTradesSameTicker[i].data.profit) + ")");
            }
            if (openTradesSameTicker[i].data.profit > this.maxBuyMoreProfit) {
                throw new Error("Already got too much profit in this one: " + info.ticker + " (" + Math.round(openTradesSameTicker[i].data.profit) + ")");
            }

        }
        var currentValue = portfolio.currentValue();
        if (totalHolding > currentValue * this.maxHolding) {
            throw new Error("Already holding " + Math.round(totalHolding / currentValue) + "% " + info.ticker);
        }
        if (openTradesSameTicker.length >= this.maxOpenPerTicker) {
            throw new Error("Already at max " + info.ticker + " x" + this.maxOpenPerTicker + "");
        }


        var perTrade = totalCash / (this.maxTradesOpen - openTrades.length);
        if (tradedBefore) {
            perTrade = totalCash / (this.maxTradesOpen - openTrades.length + 3);
        }
        if (openTradesSameTicker && openTradesSameTicker.length > 0 && this.secondSameStockWeighting) {
            perTrade = perTrade * this.secondPurchaseStockWeighting;
        } else {
            perTrade = perTrade * this.firstPurchaseStockWeighting;
        }

        var amount = perTrade * Math.max((info.buySignal / this.buySignalCashWeighting), 1.5)

        var currentValue = portfolio.currentValue();
        if (amount > this.maxHolding * currentValue) {
            amount = this.maxHolding * currentValue
        }
        return Math.max(0, Math.min(amount, totalCash));
    },
    buySignal: indicators => {

        if (indicators.direction == 25033) {
            console.log("is the data formatted correctly?");
            console.log("timestamp,open,high,low,close,volume");
            return 0;
        }

        var buySignal = 0;

        if (
            indicators.extrema == -1
        ) {
            return {
                reason: ["extrema: " + indicators.extrema, "direction: " + indicators.direction].join("\t"),
                signal: 50
            }
        }

        return {
            reason: "",
            signal: buySignal
        }
    },

    sellSignal: indicators => {

        var sellSignal = 0;

        if (indicators.extrema == 1) {
            return {
                reason: "negative extrema",
                signal: 100
            }
        }

        return {
            reason: "",
            signal: sellSignal
        }
    },

    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const direction = inputSeries.deflate(row => row.close).direction(3);

        const extrema = inputSeries.deflate(row => row.close).extrema();
        const medianPrice = inputSeries.deflate(row => (row.high + row.low) / 2);
        logger.setup("Adding extrema & median price")
        inputSeries = inputSeries.withSeries({
            extrema: extrema,
            medianPrice: medianPrice,
            direction: direction
        });

        return inputSeries;
    }
};

Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var data_forge_1 = require("data-forge");
const logger = require("../modules/logger");

function smma(period) {
    chai_1.assert.isNumber(period, "Expected 'period' parameter to 'Series.smma' to be a number that specifies the time period of the moving average.");

    return this.rollingWindow(period)
        .select(function(window) {
            var previous = window.last().close;
            if (window.head(period - 1).last().smma !== undefined) {
                previous = window.head(period - 1).last().smma
            }
            return [window.getIndex().last(), (window.sum() - previous) / period];
        })
        .withIndex(function(pair) { return pair[0]; })
        .select(function(pair) { return pair[1]; });

}
data_forge_1.Series.prototype.smma = smma;
//# sourceMappingURL=smma.js.map