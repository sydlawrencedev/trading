const express = require('express'),
    fs = require('fs');

const app = express()
const port = 3000

app.get('/', (req, res) => {

  var filePath = "stocks/autodd.csv";
    var stat = fs.statSync(filePath);

    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': stat.size
    });

    var readStream = fs.createReadStream(filePath);
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(res);
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})