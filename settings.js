

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
];

// https://www.reddit.com/r/stocks/comments/g4a598/created_a_list_of_under_valued_stocks_for_you_guys/
// shit performance
var sixmontholdundervalued = [
    "AGN",
    "BLK",
    "DXC",
    "COF",
    "ADS",
    "AAP",
    "NEM",
    "EMN",
    "MYL",
    "SIVB",
    "ACN",
    "EW",
    "DXC",
    "PPG",
    "SCHW",
    "LLY",
    "JPM",
    "ETFC",
    "HON",
    "CCI",
    "MGM",
];

var biggest20202stocks = [
    "TSLA",
    "ZM",
    "SE",
    "NIO",
    "CRWD",
    "MRNA",
    "PTON",
    "QS",
    "BILI",
    "NET",
    "FTCH",
    "DKNG",
    "RUN",
    "FSLY",
    "DNLI",
    "NVAX",    
];


// wallstreetbet stocks from Dec 2020 https://stocks.comment.ai/trending.html
var dec2020wsbstocks = [
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

var sydStocks = [
    "DVAX",
    "APHA",
    "PLTR",
    "PLUG",
    "BABA",
    // "TSLA",
    "NIO",
    "ACB",
    "GME",
    "AI",
    "CRSR",

    "SPCE",
    "TLRY",
    "FCEL",
    "LAZR",
    "CIIC",
    "SOL",
    "QS",
    "JMIA",
    "XPEV"
]
// https://www.swaggystocks.com/dashboard/wallstreetbets/ticker-sentiment
var stocks = allStocks = [
    "JMIA",
    "BLNK",
    "PYPL",
    "FCEL",
    "GS",
    "STAR",
    "IWM",
    "MAS",
    "LI",
    "SBE",
    "ELF",
    "UBER",
    "SBUX",
    "MP",
    "CPA",
    "PDD",
    "ARKW",
    "ECON",
    "RIG",
    "KO",
    "TQQQ",
    "JNJ",
    "FDX",
    "COST",
    "SPY",
    "BABA",
    "TSLA",
    "PLTR",
    "GME",
    "AAPL",
    "AMZN",
    "CAN",
    "NIO",
    "WISH",
    "ARKG",
    "AMD",
    "ICLN",
    "MOD",
    "SNOW",
    "FB",
    "ARKK",
    "PSTH",
    "GLD",
    "BA",
    "NKLA",
    "MSFT",
    "DIS",
    "CRSR",
    "MT",
    "RKT",
    "ARKF",
    "QQQ",
    "QS",
    "AMC",
    "FUBO",
    "PRPL",
    "MRNA",
    "DM",
    "DKNG",
    "PLUG",
    "HOG",
    "NVDA",
    "IPO",
    "IPOC",
    "DEF",
    "MARA",
    "JD",
    "TDOC",
    "RIOT",
    "F",
    "SOLO",
    "MVIS",
    "BOOM",
    "TY",
    "CRM",
    "SQ",
    "PFE",
    "HERO",
    "SHOP",
    "GM",
    "GAL",
    "INTC",
    "IRS",
    "UVXY",
    "CELH",
    "MGNI",
    "SPOT",
    "EAR",
    "ZM",
    "PTON",
    "SPCE",
    "MCD",
    "RDFN",
    "EGO",
    "FSLY",
    "DASH",
    "UPS",
    "ARKQ",
    "GE",
    "NFLX",
    
];

mikestocks = [
    "CCL",
    "PYPL",
    "FLIR",
    "SPY",
    "APA",
    "OXY",
    "DVN",
    "DISH",
    "FTI",
    "HWM",
    "ETSY",
    "ROL",
    "CTAS",
    "NFLX",
    "PAYX",
    "FE",
    "MS",
    "TWLO"
];
  

// past stocks: sydStocks
// future stocks: dec2020wsbstocks
stocks = sydStocks;
// stocks = biggest20202stocks;
// stocks = allStocks;
stocks = bearStocks;
// stocks = oldwsbstocks;
stocks = sixmontholdundervalued;
// stocks = dec2020wsbstocks;
// stocks = ["NIU", "GME", "BABA", "JMIA", "PLUG", "XPEV", "PLTR", "FCEL", "SOL", "AMZN", "TSLA", "MSFT", "ZM", "WORK"];


stocks = mikestocks;

var keys = require("./.keys");
settings = {   
    strategy: "mike",
    // strategy: "sma",
    comparisons: ["h3ka", "rsi", "sma", "ema", "bollinger", "trendwatcher", "holdall"],
    comparisons: ["h3ka"],
    alphavantagekey: keys.alphavantage.key,
    alpaca: keys.alpaca,
    stocks: stocks,
    supportPartialShares: false,
    // stocks: ["ZM"],
    startingCapital: 100000,
    baseAlgoProfit: 1361834748,
    verbose: (stocks.length == 1) ? true : false,
    verbose: true,
    timeWindow: {
        start: "2020-02-01",
        end: "2020-10-01"
    },
    thresholds: {
        buy: 0,
        sell: 0
    },
    maxTradesOpen: Math.min(20,stocks.length + 1),
    cashBaseWeighting: 50
}

module.exports = settings;