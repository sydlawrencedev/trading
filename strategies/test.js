module.exports = {
    name: "Test Strategy",
    stopLoss: -0.03, // Stop out on 3% loss from entry price.
    buySignal: indicators => {

        if (indicators.upTrendCounter == 25033) {
            console.log("is the data formatted correctly?");
            console.log("timestamp,open,high,low,close,volume");
            return 0;
        }
        
        var buySignal = 0;
        if (
            indicators.longTermDirection > 0
            && indicators.direction > 0
            && indicators.upTrendCounter > 3
            && indicators.upTrendCounter < 10
            && indicators.rsi < 80
        ) {
            buySignal += indicators.upTrendCounter * 10;
        } else if (
            indicators.rsi < 20
           && indicators.downTrendCounter > 10
        ) {
            buySignal += indicators.rsi;
        }

        return buySignal;
    },

    sellSignal: indicators => {
        var sellSignal = 0;
        if (indicators.rsi > 90) {
            sellSignal += 100;
        }
        if (indicators.downTrendCounter >= 2) {
            sellSignal += 50;
        }
        return sellSignal;
    },

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
};
