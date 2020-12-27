var data_forge_1 = require("data-forge");

module.exports = {
    name: "Test Strategy",
    stopLoss: -0.03, // Stop out on 3% loss from entry price.
    limitOrder: 0.05,
    buySignal: indicators => {

        if (indicators.upTrendCounter == 25033) {
            console.log("is the data formatted correctly?");
            console.log("timestamp,open,high,low,close,volume");
            return 0;
        }
        
        var buySignal = 0;
        if (
            indicators.longTermDirection > 0
            && indicators.direction > 0
            && indicators.upTrendCounter > 3
            && indicators.upTrendCounter < 10
            && indicators.rsi < 80
        ) {
            return {
                reason: ["upTrendCounter: " + indicators.upTrendCounter, "rsi: " + Math.round(indicators.rsi)].join("\t"),
                signal: indicators.upTrendCounter * 10
            }
        } else if (
            indicators.rsi < 30
           && indicators.downTrendCounter > 2
        ) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi)].join("/t"),
                signal: 30 - indicators.rsi
            }
        } 

        if (indicators.sma13 > indicators.sma48) {
            return {
                reason: ["sma13",Math.round(indicators.sma13), ">","sma48", Math.round(indicators.sma48)].join("\t"),
                signal: 30
            }
        }

        return {
            reason: "hmmm",
            signal: buySignal
        }
    },

    sellSignal: indicators => {
        var sellSignal = 0;
        // if volume is 2 times the previous sma volume
        if (indicators.smaVolume * 2 < indicators.volume) {
            return {
                reason: "highvolume: " + indicators.hv + " " + indicators.volume,
                signal: 10000
            }
        }

        if (indicators.sma13 < indicators.sma48) {
            return {
                reason: ["sma13",Math.round(indicators.sma13), "<","sma48", Math.round(indicators.sma48)].join("\t"),
                signal: 50
            }
        }

        if (indicators.direction < 0 && indicators.rsi > 80) {
            return {
                reason: "rsi: " + indicators.rsi,
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
            reason: "unsure",
            signal: sellSignal
        }
    },

    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const direction = inputSeries.deflate(row => row.close).direction(3);
        const longTermDirection = inputSeries.deflate(row => row.close).direction(20);
        const upTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend > 0);
        const downTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend < 0);
        const longSma = inputSeries.deflate(bar => bar.close).sma(30);                           // 30 day moving average.
        const shortSma = inputSeries.deflate(bar => bar.close).sma(7);                           // 7 day moving average.        
        const rsi = inputSeries.deflate(row => row.close).rsi(14);
        const smaVolume = inputSeries.deflate(row => row.volume).sma(5);
        const sma13 = inputSeries.deflate(bar => bar.close).sma(13);                           // 30 day moving average.
        const sma48 = inputSeries.deflate(bar => bar.close).sma(48);                           // 30 day moving average.



        inputSeries = inputSeries.withSeries({
            direction: direction,
            longTermDirection: longTermDirection,
            upTrendCounter: upTrendCounter,
            downTrendCounter: downTrendCounter,
            longSma: longSma,
            shortSma: shortSma,
            sma13: sma13,
            sma48: sma48,
            rsi: rsi,
            smaVolume: smaVolume,
        }); 

        try {
            const longEma = inputSeries.deflate(bar => bar.close).ema(30);                           // 30 day moving average.
            const shortEma = inputSeries.deflate(bar => bar.close).ema(7);                           // 7 day moving average.

            inputSeries = inputSeries.withSeries({
                longEma: longEma,
                shortEma: shortEma
            });
        } catch (e) {}
        

        return inputSeries;
    }
};
