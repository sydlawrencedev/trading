module.exports = {
    name: "holdall",
    addIndicators: inputSeries => {
        return inputSeries;
    },
    buySignal: args => {
        return 1000000;
    },
    sellSignal: args => {
        return -1000000;
    }
};