module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const bollingerBands = inputSeries
            .deflate(bar => bar.close)  // Extract closing price series from input data.
            .bollinger(20, 2, 2)        // 20 days with bands at 2 standard deviations.
            .bake();
            
        inputSeries = inputSeries.withSeries("bollingerBands", bollingerBands);
        // inputSeries = inputSeries.withSeries("bollingerBandsLower", bollingerBands.lower);
        // inputSeries = inputSeries.withSeries("bollingerBandsMiddle", bollingerBands.middle);
        // inputSeries = inputSeries.withSeries("bollingerBandsUpper", bollingerBands.upper);
        // inputSeries = inputSeries.withSeries("percentB", bollingerBands.percentB());
        // inputSeries = inputSeries.withSeries("bandwidth", bollingerBands.bandwidth());
        
        return inputSeries;                         // Skip blank sma entries.
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.bollingerBands && args.bar.bollingerBands.lower >= args.bar.bollingerBands.value) { // Buy when price is below average.
                enterPosition();
            }
        },

        exitRule: (exitPosition, args) => {
            if (args.bar.bollingerBands && args.bar.bollingerBands.upper <= args.bar.bollingerBands.value) { // Buy when price is below average.
                exitPosition();
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (5/100); // Stop out on 5% loss from entry price.
        }
    }
};