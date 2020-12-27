module.exports = strategy = {
    opens: [],
    exits: [],
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
       
        const direction = inputSeries.deflate(row => row.close).direction(3);
        inputSeries = inputSeries.withSeries("direction", direction)   // Integrate moving average into data, indexed on date.
        
        const longTermDirection = inputSeries.deflate(row => row.close).direction(20);
        inputSeries = inputSeries.withSeries("longTermDirection", longTermDirection)   // Integrate moving average into data, indexed on date.

        const upTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend > 0);
        inputSeries = inputSeries.withSeries("upTrendCounter", upTrendCounter)   // Integrate moving average into data, indexed on date.
    
        const downTrendCounter = inputSeries.deflate(row => row.close).trends().counter(trend => trend < 0);
        inputSeries = inputSeries.withSeries("downTrendCounter", downTrendCounter)   // Integrate moving average into data, indexed on date.
        
        const longSma = inputSeries.deflate(bar => bar.close).sma(30);                           // 30 day moving average.
        inputSeries = inputSeries.withSeries("longSma", longSma) 

        const shortSma = inputSeries.deflate(bar => bar.close).sma(7);                           // 30 day moving average.
        inputSeries = inputSeries.withSeries("shortSma", shortSma) 
        
        try {
            const longEma = inputSeries.deflate(bar => bar.close).ema(30);                           // 30 day moving average.
            inputSeries = inputSeries.withSeries("longEma", longEma)

            const shortEma = inputSeries.deflate(bar => bar.close).ema(7);                           // 30 day moving average.
            inputSeries = inputSeries.withSeries("shortEma", shortEma)
        } catch (e) {}
        const rsi = inputSeries.deflate(row => row.close).rsi(14);
        inputSeries = inputSeries.withSeries("rsi", rsi)

        return inputSeries;
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.upTrendCounter == 25033) {
                console.log("is the data formatted correctly?");
                console.log("timestamp,open,high,low,close,volume");
                return;
            }
            
            var toEnter = false;
            // if uptrend > 3 buy
            if (
                args.bar.longTermDirection > 0
                && args.bar.direction > 0
                && args.bar.upTrendCounter > 3
                && args.bar.upTrendCounter < 10
                && args.bar.rsi < 80
            ) {
                toEnter = true;
            } else if (
               args.bar.rsi < 20
               && args.bar.downTrendCounter > 10
            ) {
                toEnter = true;
            }

            if (toEnter) {
                enterPosition();
                strategy.opens.push(args.bar);
            }
        },

        exitRule: (exitPosition, args) => {
            
            var exiting = false;
            if (args.bar.rsi > 90) {
                exiting = true;
            // } else if (args.position.profitPct > 5) {                
                // exiting = true;
            } else if (args.bar.downTrendCounter >= 2) {
                exiting = true;
            }

            if (exiting) {
                exitPosition();
                strategy.exits.push(args.bar);
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (3/100); // Stop out on 2% loss from entry price.
        }
    }
};
