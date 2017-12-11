
var express = require('express');
var app = express();
var fetch = require('node-fetch');
var xmldom = require('xmldom').DOMParser;
var toGeoJSON  = require('./lib/togeojson.js');
var geobufFun = require('./lib/geobufFun.js');

var testRide = Array();
//module.exports= {
module.exports = (function() {
app.use(function(req, res, next) {
  //if (req.method !== "post") return next();
  if (0 !== req.url.indexOf('/route/gpx')) return next();
  //else {
    var data = '';
    //var re = JSON.parse(JSON.stringify(req));
    req.setEncoding('utf8');
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', function() {
        req.rawBody = data;
console.log(req.rawBody);
        next();
    });
  //}
})//,

app.get('/track/:user', (req, res) => {
  var user;
  if (req.params.user !== undefined) user = req.params.user;
  var geojson = GeoJSON.parse(testRide, {Point: ['lat', 'lng']});
  console.log("GPX uploaded");
  var geobuf = geojsonToGeobuf(geojson);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }
})//,
app.post('/track', (req, res) => {
  var loc = req.body.location;
  //var now = new Date();
  //loc.time = dateFormat();//now is default
  testRide.push(loc);
  console.log(loc);
  res.send('ok');
})//,
app.post('/route/gpx', (req, res) => {
  var xml = new xmldom().parseFromString(req.rawBody, "application/xml")
  //console.log(xml);
  this.routeToDisplay = toGeoJSON.gpx(xml);
  //console.log(util.inspect(json, false, null));
  res.send('ok');
})//,
app.get('/route/gpx', (req, res) => {
  console.log(this.routeToDisplay);
  var geobuf = geojsonToGeobuf(this.routeToDisplay);
  res.send(new Buffer(geobuf));
})

})();//module.exports
//module.exports = app






