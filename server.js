var express = require('express')
var cors = require('cors')
var GeoBounds = require('geojson-bounds')
var fetch = require('node-fetch');
var app = express()

//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

app.use(allowCrossDomain);
app.use(express.static(__dirname));


app.listen(3000, function () {
  console.log('CORS-enabled web server listening on port 3000')
})

