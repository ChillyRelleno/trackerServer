//Both need
var express = require('express')
var cors = require('cors')
var app = express()
var bodyParser = require('body-parser');
var compression = require('compression')
var config = require('./config.js')
var geobufFun = require('./lib/geobufFun.js')
var toGeoJSON  = require('./lib/togeojson.js')

//This one needs
var xmldom = require('xmldom').DOMParser;
var GeoJSON = require('geojson')

var dateFormat = require('dateformat');

//Will need
var fs = require('graceful-fs')

//Need in development
const util = require('util')
process.env.NODE_ENV = config.node_env;

app.use(cors());
app.use(compression());
app.use(express.static(__dirname));

//--------------RIDE TRACKER---------------//
var testRide = Array();

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
//console.log(req.rawBody);
        next();
    });
  //}
});
app.use(bodyParser.json() );
app.use(bodyParser.urlencoded({extended:true}));

app.get('/track/:user', (req, res) => {
  var user;
  if (req.params.user !== undefined) user = req.params.user;
  var geojson = GeoJSON.parse(testRide, {Point: ['lat', 'lng']});
  console.log("GPX sent");
  var geobuf = geobufFun.geojsonToGeobuf(geojson);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }
});
app.post('/track', (req, res) => {
  var loc = req.body.location;
  //var now = new Date();
  //loc.time = dateFormat();//now is default
  testRide.push(loc);
  console.log(loc);
  res.send('ok');
});
app.post('/route/gpx', (req, res) => {
  console.log('receiving gpx file')
  var xml = new xmldom().parseFromString(req.rawBody, "application/xml")
  //console.log(xml);
  this.routeToDisplay = toGeoJSON.gpx(xml);
  //console.log(util.inspect(json, false, null));
  res.send('ok');
});
app.get('/route/gpx', (req, res) => {
  //console.log(this.routeToDisplay);
  var geobuf = geobufFun.geojsonToGeobuf(this.routeToDisplay);
  res.send(new Buffer(geobuf));
});

app.listen(config.trackerServerPort, function() {
	console.log('Tracker server listening on port ' + config.trackerServerPort)
})
