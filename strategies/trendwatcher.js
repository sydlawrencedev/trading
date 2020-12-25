module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        const daysFalling = inputSeries.deflate(row => row.close).daysFalling();
        inputSeries = inputSeries.withSeries("daysFalling", daysFalling);

        
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
    
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            // if uptrend > 3 buy
            if (args.bar.direction > 0 && args.bar.upTrendCounter > 3) { // Buy when price is below average.
                enterPosition();
            }
           
        },

        exitRule: (exitPosition, args) => {
            // if profit > 3% sell
            if (args.position.profitPct > 3) {
                exitPosition();
            }
            // if downtrend is >= 2 sell
            else if (args.bar.downTrendCounter >= 2) {
                exitPosition();
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (2/100); // Stop out on 2% loss from entry price.
        }
    }
};