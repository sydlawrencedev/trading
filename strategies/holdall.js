module.exports = {
    addIndicators: function(inputSeries) {
        return inputSeries;
    },
    strategy: {
        entryRule: (enterPosition, args) => {
            // hold all
            enterPosition();
        },

        exitRule: (exitPosition, args) => {
            // never exit
        },
    }
};