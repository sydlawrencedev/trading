module.exports = {
    name: "holdall",
    addIndicators: inputSeries => {
        return inputSeries;
    },
    buySignal: indicators => {
        return {
            signal: 50,
            reason: "buy buy buy"
        }
    },
    sellSignal: indicators => {
        return {
            signal: -50,
            reason: "HODL"
        }
    }
};