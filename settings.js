// bear stocks
var bearStocks = [
    "FCEL",
    "PCG",
    "MUR",
    "MOS",
    "MRO",
    "FLR",
    "RIG",
    "CCL",
    "CGC",
    "PFE",
    "MA",
    "EOD",
    "CAN",
    "AHT",
    "FARM",
    "IBM",
    "JCP",
    "MITT",
    "REPH",
    "TLRY",
];

// wallstreetbet stocks from Dec 2019 https://www.reddit.com/r/wallstreetbets/comments/e9xjut/top_15_mentioned_stocks_today/
var oldwsbstocks = [
    "SPY",
    "LULU",
    "AMD",
    "COST",
    "FB",
    "PTON",
    "CASH",
    "AAPL",
    "GOLD",
    "ROKU",
    "TSLA",
    "AMZN",
    "NFLX",
    "DIS",
]

// wallstreetbet stocks from Dec 2020 https://stocks.comment.ai/trending.html
var currentwsbstocks = [
    "PLTR",
    "BABA",
    "GME",
    "TSLA",
    "NIO",
    "AMD",
    "PSTH",
    "AI",
    "ICLN",
    "CFO",
    "AAPL",
    "CRSR",
    "AMZN",
    "MSFT",
    "BFT",
    "GM",
    "SNOW",
    "THCB",
    "TV"
]


var stocks = [
    "ACB",
    "PLUG",
    "MSFT",
    "CIIC",
    "SOL",
    "CGC",
    "SOLO",
    "EOD",
    "DKNG",
    "SPCE",
    "AAPL",
    "AKBA",
    "LAZR",
    "TSLA",
    "FCEL",  
    "NIO",
    "QS",
    "TLRY",
    "XPEV",
    "PLTR",
    "AMD",
    "AI",
    "CFO",
    "CRSR",
    "BFT",
    "GM",
    "JMIA",
    "SEA"
];

// stocks = currentwsbstocks;

module.exports = {   
    strategy: "test",
    alphavantagekey: "0OV8QTDPW5IYCHSN",
    stocks: stocks,
    // stocks: ["PFE"],
    startingCapital: 10000 / stocks.length,
    baseAlgoProfit: 1361834748,
    verbose: false,
    timeWindow: {
        start: "2020-06-01",
        end: "2020-12-25"
    }
}