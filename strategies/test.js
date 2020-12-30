var data_forge_1 = require("data-forge");
const tickers = require('../modules/tickers');

module.exports = {
    name: "Test Strategy",
    limitOrder: 2.20, // don't bother with this
    stopLoss: -0.03, // Stop out on 3% loss from entry price.
    acceptableLoss: 0,
    maxTradesOpen: 100,
    maxOpenPerTicker: 30000000,
    buySignalCashWeighting: 50,
    secondPurchaseStockWeighting: 1,
    firstPurchaseStockWeighting: 0.2,
    amountToSpend: function(info, totalCash, openTrades = [], openTradesSameTicker = [], allHoldings = {}) {
        this.maxTradesOpen = Math.min(50,tickers.active.length);
        var anyAtLoss = false;

        var maxTradsOpen

        for (var i = 0; i < openTradesSameTicker.length; i++) {
            openTradesSameTicker[i].currentValue({close: info.close});
            if (openTradesSameTicker[i].data.profit < 0) {
                throw new Error("Already at a loss with "+info.ticker+" ("+Math.round(openTradesSameTicker[i].data.profit)+")");
            }

        }
        if (openTradesSameTicker.length >= this.maxOpenPerTicker) {
            throw new Error("Already at max "+info.ticker+ " x"+this.maxOpenPerTicker+"");
        }
        
        if (openTrades && this.maxTradesOpen - openTrades.length <= 1) {
            return totalCash;
        }
        var perTrade = totalCash / (this.maxTradesOpen - openTrades.length);

        if (openTradesSameTicker && openTradesSameTicker.length > 0 && this.secondSameStockWeighting) {
            perTrade = perTrade * this.secondPurchaseStockWeighting;
        } else {
            perTrade = perTrade * this.firstPurchaseStockWeighting;
        }

        var amount = perTrade * Math.max((info.buySignal / this.buySignalCashWeighting),1.5)
        
        return Math.max(0,Math.min(amount, totalCash));
    },
    buySignal: indicators => {

        if (indicators.upTrendCounter == 25033) {
            console.log("is the data formatted correctly?");
            console.log("timestamp,open,high,low,close,volume");
            return 0;
        }
        
        var buySignal = 0;

        if (
            indicators.extrema == -1
            && indicators.rsi !== undefined
        ) {
            return {
                reason: ["extrema: " + indicators.extrema, "direction: " + indicators.direction].join("\t"),
                signal: 50
            }
        }

        if (
            indicators.longTermDirection > 0
            && indicators.direction > 0
            && indicators.upTrendCounter >= 3
            && indicators.rsi < 70
            && indicators.extrema !== 1
            && indicators.momentum < 0
        ) {
            return {
                reason: ["upTrendCounter: " + indicators.upTrendCounter, "rsi: " + Math.round(indicators.rsi), "extrema: " + JSON.stringify(indicators.extrema), "momentum: " + indicators.momentum.toFixed(3)].join("\t"),
                signal: indicators.upTrendCounter * 10
            }
        } else if (
            indicators.rsi < 30
           && indicators.downTrendCounter > 1
        ) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi)].join("/t"),
                signal: Math.round(30 - indicators.rsi)
            }
        } 

        if (indicators.smaVolume > indicators.volume * 2 
            && indicators.direction == -1
            && indicators.downTrendcounter >= 3
        ) {
            return {
                reason: "down and high previous volume - sma:"+indicators.smaVolume+ "\tcurrent:"+indicators.volume ,
                signal: Math.round(indicators.maxVolume / indicators.volume * 30)
            }
        }

        return {
            reason: "",
            signal: buySignal
        }
    },

    sellSignal: indicators => {
        var sellSignal = 0;
        if (
            indicators.extrema * 1 == 1
            && indicators.direction * 1 == 1
        ) {
            return {
                reason: ["extrema: " + indicators.extrema, "direction: " + indicators.direction].join("\t"),
                signal: 50
            }
        }
        
        // if volume is < 0.5 times the previous sma volume
        if (indicators.direction > 0 && (indicators.volume * 2 < indicators.smaVolume)) {
            return {
                reason: "highpreviousvolume: " + indicators.volume + " * 2 < " + indicators.smaVolume,
                signal: 10000
            }
        }

        if (
            indicators.upTrendCounter >= 7
            && indicators.momentum > 0.07
        ) {
            return {
                reason: ["momentum: " + indicators.momentum.toFixed(3), "upTrendCounter: " + indicators.upTrendCounter, "direction: " + indicators.direction, "longTermDirection: " + indicators.longTermDirection].join("\t"),
                signal: 50
            }
        }
        
        if (
            indicators.longTermDirection > 0
            && indicators.direction > 0
            && indicators.upTrendCounter >= 3
            && indicators.rsi > 80
        ) {
            return {
                reason: ["upTrendCounter: " + indicators.upTrendCounter, "rsi: " + Math.round(indicators.rsi)].join("\t"),
                signal: 50
            }
        }

        if (indicators.downTrendCounter >= 2 && indicators.rsi > 70) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi), "downTrendCounter: "+indicators.downTrendCounter].join("\t"),
                signal: 100
            }
        }
        if (indicators.downTrendCounter >= 3) {
            return {
                reason: "downTrendCounter: " + indicators.downTrendCounter,
                signal: 50
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
        const longTermDirection = inputSeries.deflate(row => row.close).direction(20);
        const upTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend > 0);
        const downTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend < 0);
        // const longSma = inputSeries.deflate(bar => bar.close).sma(48);                           // 30 day moving average.
        // const shortSma = inputSeries.deflate(bar => bar.close).sma(13);                           // 7 day moving average.        
        // const tinySma = inputSeries.deflate(bar => bar.close).sma(3);                           // 7 day moving average.        
        const rsi = inputSeries.deflate(row => row.close).rsi(14);
        const smaVolume = inputSeries.deflate(row => row.volume).sma(2);
        const extrema = inputSeries.deflate(row => row.close).extrema();
        const momentum = inputSeries.deflate(row => row.close).momentum(3);
        
        inputSeries = inputSeries.withSeries({
            direction: direction,
            longTermDirection: longTermDirection,
            upTrendCounter: upTrendCounter,
            downTrendCounter: downTrendCounter,
            // longSma: longSma,
            // shortSma: shortSma,
            // tinySma: tinySma,
            rsi: rsi,
            smaVolume: smaVolume,
            extrema: extrema,
            momentum: momentum,
        }); 

        // not currently using it
        // try {
        //     const longEma = inputSeries.deflate(bar => bar.close).ema(30);                           // 30 day moving average.
        //     const shortEma = inputSeries.deflate(bar => bar.close).ema(7);                           // 7 day moving average.

        //     inputSeries = inputSeries.withSeries({
        //         longEma: longEma,
        //         ema: shortEma,
        //         shortEma: shortEma
        //     });
        // } catch (e) {}
        

        return inputSeries;
    }
};
