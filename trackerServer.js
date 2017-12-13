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
var geojsonToSvg = require('geojson-to-svg')
var SimplifyGeoJson = require('simplify-geojson')

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

createIcon = function(geojson) {
  var simple = SimplifyGeoJson(geojson, 0.05)
  var svg = geojsonToSvg()
    //.type('type')
    //.styles({'GPX' : {stroke: 'red' } })
    .styles(function(feature, canvasBBox, featureBBox) {
		return { stroke:"red", weight:0.1, opacity:.5};
	})
    .projection(function(coord) {
	return [coord[0], coord[1]*-1];
    })
    .extent(0, 0, 300, 300)
    //.data({type: 'Feature', properties: {type: 'GPX'} })
    .render(simple)
  //console.log(svg)
  return svg;
}

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
  var svg = createIcon(this.routeToDisplay);
  //console.log(util.inspect(json, false, null));
  res.send(svg);
});
app.get('/route/gpx', (req, res) => {
  //console.log(this.routeToDisplay);
  var geobuf = geobufFun.geojsonToGeobuf(this.routeToDisplay);
  res.send(new Buffer(geobuf));
});

app.get('/test', (req, res) => {
  var str = '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Tiny Test Route"},"geometry":{"type":"LineString","coordinates":[[-124.72641,48.380426,74.9],[-117.116037,32.538975,3],[-117.115631,32.538131,3.2],[-83.848714,30.751335,62.4],[-83.847656,30.751278,63.6],[-80.442413,25.667059,1.3],[-80.441895,25.666285,1.3],[-67.039122,44.788851,33.1],[-67.038574,44.789633,35.8],[-69.224854,47.439235,390.4]]}}]}'
  var svg=createIcon(JSON.parse(str));
  res.send(svg);
})

app.listen(config.trackerServerPort, function() {
	console.log('Tracker server listening on port ' + config.trackerServerPort)
})
