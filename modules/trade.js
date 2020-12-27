
class Trade {

    data = {
        ticker: "",
        direction: "long",
        quantity: 0,
        currentPrice: 0,
        entry: {
            time: 0,
            price: 0,
            info: {}
        },
        exit: {
            time: 0,
            price: 0,
            info: {}
        },
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
        var startingValue = this.data.quantity * this.data.entry.price;
        var currentValue = this.data.quantity * this.data.currentPrice;
        this.data.profit = currentValue - startingValue;
        this.data.profitPct = this.data.profit / startingValue;
        this.data.growth = this.data.profitPct;
        return this;
    };

    currentValue(price) {
        if (price !== undefined) {
            this.data.currentPrice = price;
        }
        this.calculate();
        return this.data.quantity * this.data.currentPrice;
    };

    enterPosition(time, ticker, quantity, price, info) {
        this.data.ticker = ticker;
        this.data.quntity = quantity;
        this.data.entry = {
            time: time,
            price: price,
            info: info
        };
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