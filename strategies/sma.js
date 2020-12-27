module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const movingAverage = inputSeries
            .deflate(bar => bar.close)          // Extract closing price series.
            .sma(30);                           // 30 day moving average.
        
        return inputSeries
            .withSeries("sma", movingAverage)   // Integrate moving average into data, indexed on date.
            .skip(30)                           // Skip blank sma entries.
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.close < args.bar.sma) { // Buy when price is below average.
                enterPosition();
            }
        },

        exitRule: (exitPosition, args) => {
            if (args.bar.close > args.bar.sma) {
                exitPosition(); // Sell when price is above average.
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (5/100); // Stop out on 5% loss from entry price.
        }
    }
};