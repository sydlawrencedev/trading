var fs = require('fs');


var tickers = {
    active: [],
    addTicker: function(ticker) {
        if (ticker && ticker[0] !== ".") {
            tricker = ticker.trim()
            this.active.push(ticker.trim());
        }
    },
    fetch: async function(csv, cb) {
        this.active = [];
        // console.log("Using '"+csv +"' stocks");
        var contents = fs.readFileSync(process.mainModule.path+'/stocks/'+csv+".csv", 'utf8').split("\n");
        for (var i = 0; i < contents.length; i++) {
            tickers.addTicker(contents[i].trim());
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
