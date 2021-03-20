const FTXRest = require('ftx-api-rest');
const moment = require('moment');
 
 
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
    path: 'testingl.csv',
    header: [
        {id: 'startTime', title: 'timestamp'},
        {id: 'open', title: 'open'},
        {id: 'high', title: 'high'},
        {id: 'low', title: 'low'},
        {id: 'close', title: 'close'},
        {id: 'volume', title: 'volume'},
    ]
});


// Get candlesticks for last 5 hours 
(async function() {
    const ftx = new FTXRest({
        key: 'SpcP9RGYlHId0paYyWAlqlW5XOX9iIgijKYXOZVa',
        secret: 'o-uisfurhDSlhg-TSuRxcfwa2NKq4qKWpdowAyY-',
        subaccount: 'TestBot'
      })
      



      ftx.request({
        method: 'GET',
        path: '/markets/BTC/USD/candles?resolution=60&start_time=1587254400&end_time=1587340800'
      }).then(function(data){

        for (var i = 0; i < data.result.length; i++) {
            // data.result[i].time = data.result[i].time / 1000
        }
        data.result = data.result.reverse();
 
        csvWriter.writeRecords(data.result)       // returns a promise
        .then(() => {
            console.log('...Done');
        });


        console.log(data.result)


      });

})();

