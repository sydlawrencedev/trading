
var startingCash = 10000;

var portfolio = {
    cash: startingCash,
    trades: [],
    holdings: [],
    equityHolding: 0,
    portfolioValue: startingCash
}

portfolio.calculate = function() {
    this.equityHolding = 0; 
    for (var i = 0; i < this.holdings; i++) {
        this.equityHolding += this.holdings[i].currentValue();
    }
    this.equityHolding += this.cash;
}

class Singleton {
    constructor() {
        return portfolio;
    }
}
module.exports = new Singleton();
