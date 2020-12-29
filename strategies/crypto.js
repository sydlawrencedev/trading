var data_forge_1 = require("data-forge");

module.exports = {
    name: "Crypto Strategy",
    stopLoss: -0.05, // Stop out on 3% loss from entry price.
    limitOrder: 0.20,
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
            && indicators.upTrendCounter >= 2
            && indicators.upTrendCounter < 20
            // && indicators.rsi < 90
        ) {
            return {
                reason: ["upTrendCounter: " + indicators.upTrendCounter, "rsi: " + Math.round(indicators.rsi)].join("\t"),
                signal: indicators.upTrendCounter * 10
            }
        }

        if (indicators.shortSma > indicators.close) {
            return {
                reason: "Sma: "+Math.round(indicators.shortSma / indicators.close * 100) / 100,
                signal: indicators.shortSma / indicators.close * 50
            }
        }

        if (indicators.shortEma < indicators.close && indicators.close > indicators.longEma) {
            return {
                reason: "ShortSma < Long sma: "+Math.round(indicators.shortSma / indicators.close * 100) / 100,
                signal: indicators.shortSma / indicators.close * 50
            }
        }

        if (indicators.ema > indicators.close) {
            return {
                reason: "Ema: "+Math.round(indicators.ema / indicators.close * 100) / 100,
                signal: indicators.ema / indicators.close * 50
            }
        }

        if (indicators.rsi < 40) {
            return {
                reason: "rsi: "+Math.round(indicators.rsi),
                signal: 25 + (50 - indicators.rsi)
            }
        }

        return {
            reason: "",
            signal: buySignal
        }
    },

    sellSignal: indicators => {
        var sellSignal = 0;
        // if volume is 2 times the previous sma volume
        if (indicators.volume > indicators.smaVolume * 2) {
            return {
                reason: "highvolume: " + indicators.volume + " > 2 * " + indicators.smaVolume,
                signal: 10000
            }
        }

        if (indicators.downTrendCounter >= 1) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi), "downTrendCounter: "+indicators.downTrendCounter].join("\t"),
                signal: 100
            }
        }
        if (indicators.downTrendCounter >= 4) {
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
        const longSma = inputSeries.deflate(bar => bar.close).sma(12);                           // 30 day moving average.
        const shortSma = inputSeries.deflate(bar => bar.close).sma(3);                           // 7 day moving average.        
        const rsi = inputSeries.deflate(row => row.close).rsi(14);
        const smaVolume = inputSeries.deflate(row => row.volume).sma(5);

        inputSeries = inputSeries.withSeries({
            direction: direction,
            longTermDirection: longTermDirection,
            upTrendCounter: upTrendCounter,
            downTrendCounter: downTrendCounter,
            longSma: longSma,
            shortSma: shortSma,
            rsi: rsi,
            smaVolume: smaVolume,
        }); 

        try {
            const longEma = inputSeries.deflate(bar => bar.close).ema(30);                           // 30 day moving average.
            const shortEma = inputSeries.deflate(bar => bar.close).ema(7);                           // 7 day moving average.

            inputSeries = inputSeries.withSeries({
                longEma: longEma,
                ema: shortEma,
                shortEma: shortEma
            });
        } catch (e) {}
        

        return inputSeries;
    }
};
