var data_forge_1 = require("data-forge");

module.exports = {
    name: "RSI Strategy",
    stopLoss: -0.10, // Stop out on 3% loss from entry price.
    limitOrder: 0.05,
    buySignal: indicators => {

        if (indicators.upTrendCounter == 25033) {
            console.log("is the data formatted correctly?");
            console.log("timestamp,open,high,low,close,volume");
            return 0;
        }
        
        var buySignal = 0;
       if (
            indicators.rsi < 30
        ) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi)].join("/t"),
                signal: 65 - indicators.rsi
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
        if (indicators.rsi > 70) {
            return {
                reason: ["rsi: " + Math.round(indicators.rsi)].join("\t"),
                signal: 100
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
        const longSma = inputSeries.deflate(bar => bar.close).sma(48);                           // 30 day moving average.
        const shortSma = inputSeries.deflate(bar => bar.close).sma(13);                           // 7 day moving average.        
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
