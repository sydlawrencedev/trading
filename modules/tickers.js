var fs = require('fs');


var tickers = {
    active: [],
    keyval: {},
    activeFile: "",
    refetch: function() {
        return this.fetch(this.activeFile);
    },
    addTicker: function(ticker) {
        if (ticker && ticker[0] !== ".") {
            ticker = ticker.trim()
            ticker = ticker.replace("CRYPTO_","");
            this.keyval[ticker] = ticker;
            this.active.push(ticker);

        }
    },
    isWatched: function(ticker) {
        return (this.keyval[ticker] !== undefined);
    },
    fetch: async function(csv, cb) {
        this.activeFile = csv;
        this.active = [];
        // console.log("Using '"+csv +"' stocks");
        var contents = await fs.readFileSync(process.mainModule.path+'/stocks/'+csv+".csv", 'utf8').split("\n");
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
