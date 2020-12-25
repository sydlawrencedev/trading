const chalk = require('chalk');

module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        // const daysFalling = inputSeries.deflate(row => row.close).daysFalling();
        // inputSeries = inputSeries.withSeries("daysFalling", daysFalling);

        const daysRising = inputSeries.deflate(row => row.close).daysRising();
        inputSeries = inputSeries.withSeries("daysRising", daysRising);

        const direction = inputSeries.deflate(row => row.close).direction(3);
        inputSeries = inputSeries.withSeries("direction", direction)   // Integrate moving average into data, indexed on date.
            
        const longTermDirection = inputSeries.deflate(row => row.close).direction(20);
        inputSeries = inputSeries.withSeries("longTermDirection", longTermDirection)   // Integrate moving average into data, indexed on date.

        const upTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend > 0);
        inputSeries = inputSeries.withSeries("upTrendCounter", upTrendCounter)   // Integrate moving average into data, indexed on date.
    
        const downTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend < 0);
        inputSeries = inputSeries.withSeries("downTrendCounter", downTrendCounter)   // Integrate moving average into data, indexed on date.
        
        const movingAverage = inputSeries
            .deflate(bar => bar.close)          // Extract closing price series.
            .sma(30);                           // 30 day moving average.
        
        inputSeries = inputSeries
            .withSeries("sma", movingAverage)   // Integrate moving average into data, indexed on date.
            .skip(30)                           // Skip blank sma entries.
        
        return inputSeries;
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.upTrendCounter == 25033) {
                console.log("is the data formatted correctly?");
                console.log("timestamp,open,high,low,close,volume");
                return;
            }
            
            // if uptrend > 3 buy
            if (
                args.bar.longTermDirection > 0
                && args.bar.direction > 0
                && args.bar.upTrendCounter > 3
            ) {
                enterPosition();
            }
        },

        exitRule: (exitPosition, args) => {
            // if profit > 5%
            if (args.position.profitPct > 5) {                
                exitPosition();
            }
            else if (args.bar.downTrendCounter >= 1) {
                exitPosition();
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (2/100); // Stop out on 2% loss from entry price.
        }
    }
};