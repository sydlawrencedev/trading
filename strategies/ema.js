module.exports = {
    addIndicators: function(inputSeries) {
        // Add whatever indicators and signals you want to your data.
        try {
            var emaLong = inputSeries
                .deflate(bar => bar.close) 
                .ema(30); 
            inputSeries = inputSeries.withSeries("emaLong", emaLong);
         } catch (e) {} 

         try {
            var emaShort = inputSeries
                .deflate(bar => bar.close) 
                .ema(7); 
            inputSeries = inputSeries.withSeries("emaShort", emaShort);
         } catch (e) {} 
       
        
        return inputSeries;
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            if (args.bar.emaLong > args.bar.emaShort) { // Buy when price is below average.
                enterPosition();
            }
        },

        exitRule: (exitPosition, args) => {
            if (args.bar.emaLong < args.bar.emaShort) { // Buy when price is below average.
                exitPosition();
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            return args.entryPrice * (5/100); // Stop out on 5% loss from entry price.
        }
    }
};