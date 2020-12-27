
module.exports = {
    name: "Mike Strategy",
    stopLoss: -0.03, // Stop out on 3% loss from entry price.
    limitOrder: 0.05,
    buySignal: indicators => {

        var buySignal = 0;
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
        if (indicators.sma13 < indicators.sma48) {
            return {
                reason: ["sma13",Math.round(indicators.sma13), "<","sma48", Math.round(indicators.sma48)].join("\t"),
                signal: 10000
            }
        }

        return {
            reason: "unsure",
            signal: sellSignal
        }
    },

    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const sma13 = inputSeries.deflate(bar => bar.close).sma(13);                           // 30 day moving average.
        const sma48 = inputSeries.deflate(bar => bar.close).sma(48);                           // 30 day moving average.

        inputSeries = inputSeries.withSeries({
            sma13: sma13,
            sma48: sma48,
        });         

        return inputSeries;
    }
};
