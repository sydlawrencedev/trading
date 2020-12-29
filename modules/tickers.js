var fs = require('fs');


var tickers = {
    active: [],
    addTicker: function(ticker) {
        if (ticker && ticker[0] !== ".") {
            this.active.push(ticker);
        }
    },
    fetch: async function(csv, cb) {
        this.active = [];
        // console.log("Using '"+csv +"' stocks");

        var contents = fs.readFileSync('./stocks/'+csv+".csv", 'utf8').split("\n");
        for (var i = 0; i < contents.length; i++) {
            tickers.addTicker(contents[i]);
        }
        return this.active;
    }
}

class Singleton {
    constructor() {
        return tickers;
    }
}
module.exports = new Singleton();
