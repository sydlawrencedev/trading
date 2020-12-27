module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        // you can find a whole load of indicators here: https://github.com/data-forge/data-forge-indicators
        const rsi = inputSeries
            .deflate(row => row.close)
            .rsi(14);

        return inputSeries
            .withSeries("rsi", rsi)  
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.rsi < 30) {
                enterPosition();
            }            
        },

        exitRule: (exitPosition, args) => {
            if (args.bar.rsi > 70) {
                exitPosition();
            }  
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (5/100); // Stop out on 5% loss from entry price.
        }
    }
};