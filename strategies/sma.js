module.exports = {
    name: "sma 30 days",
    stopLoss: -0.03, // Stop out on 3% loss from entry price.
    addIndicators: inputSeries => {        
        return inputSeries.withSeries(
            "sma", 
            inputSeries.deflate(bar => bar.close).sma(30)
        )
    },
    buySignal: indicators => {
        
        return indicators.sma - indicators.close;
    },
    sellSignal: indicators => {
        if (indicators.close > indicators.sma) {
            return 10; // Sell when price is above average.
        }
        return indicators - ;
    }
};