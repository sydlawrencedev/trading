module.exports = {
    name: "Trend Watcher",
    stopLoss: -0.0, // Stop out on 3% loss from entry price.
    limitOrder: 0.05,
    addIndicators: inputSeries => {
        const direction = inputSeries
            .deflate(row => row.close)
            .direction(3);

        inputSeries = inputSeries
            .withSeries("direction", direction)   // Integrate moving average into data, indexed on date.
            .skip(5)                           // Skip blank sma entries.

        const upTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend > 0);
        inputSeries = inputSeries.withSeries("upTrendCounter", upTrendCounter)   // Integrate moving average into data, indexed on date.
    

        const downTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend < 0);
        inputSeries = inputSeries.withSeries("downTrendCounter", downTrendCounter)   // Integrate moving average into data, indexed on date.
        return inputSeries; 
    },
    buySignal: indicators => {
        if (indicators.upTrendCounter > 3) {
            return {
                signal: 10 * indicators.upTrendCounter,
                reason: "upTrendCounter: " + indicators.upTrendCounter
            }
        }
        return {
            signal: 0,
            reason: ""
        }
    },
    sellSignal: indicators => {
        if (indicators.downTrendCounter >= 3) {
            return {
                signal: 10 * indicators.downTrendCounter,
                reason: "downTrendCounter: " + indicators.downTrendCounter
            }
        }
        return {
            signal: 0,
            reason: ""
        }
    }
};
