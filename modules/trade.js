
class Trade {
    ticker = ""
    entryTime = 0
    data = {
        direction: "long",
        quantity: 0,
        currentPrice: 0,
        entry: {
            time: 0,
            price: 0,
            info: {}
        },
        exit: false,
        profit: 0,
        profitPct: 0,
        growth: 0,
        riskPct: 0,
        riskSeries: 0,
        rmultiple: 0,
        holdingPeriod: 0,
        exitReason: "",
        stopPrice: 0,
        stopPriceSeries: 0,
        profitTarget: 0
    };

    calculate() {
        var startingValue = this.quantity * this.data.entry.price;
        var currentValue = this.quantity * this.data.currentPrice;
        this.data.profit = currentValue - startingValue;
        this.data.profitPct = this.data.profit / startingValue;
        this.data.growth = this.data.profitPct;
        return this;
    };

    currentValue(data) {
        if (data !== undefined) {
            this.data.currentPrice = data.open;
        }
        this.calculate();
        return this.quantity * this.data.currentPrice;
    };

    constructor(time, ticker, quantity, price, info) {
        this.ticker = ticker;
        this.quantity = quantity;
        this.data.entry = {
            time: time,
            price: price,
            info: info
        };
        this.entryTime = time;
        this.data.currentPrice = price;
        return this;
    };

    exitPosition(time, price, info, reason) {
        this.data.currentPrice = price;
        this.data.exitReason = reason;
        this.data.exit = {
            time: time,
            price: price,
            info: info
        }
        this.calculate();
        return this;
    }

}

module.exports = Trade