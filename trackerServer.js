//Both need
var express = require('express')
var cors = require('cors')
var app = express()
var bodyParser = require('body-parser');
var compression = require('compression')
var config = require('./config.js')
var geobufFun = require('./lib/geobufFun.js')
var toGeoJSON  = require('./lib/togeojson.js')
require('log-timestamp')
//This one needs
var xmldom = require('xmldom').DOMParser;
var GeoJSON = require('geojson')
var geojsonToSvg = require('geojson-to-svg')
var SimplifyGeoJson = require('simplify-geojson')
var polygonFun = require('./lib/polygonFun.js')
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
//var testRide = Array();
var testRide = {type: "FeatureCollection", features: []}
this.routeToDisplay=null;
//Used for caching XML stream. Should be upgraded to work with streams
app.use(function(req, res, next) {
  //if (req.method !== "post") return next();
  if (0 !== req.url.indexOf('/route/gpx')) return next();
  //console.log('madeit')
  else {
    var data = '';
    //var re = JSON.parse(JSON.stringify(req));
    req.setEncoding('utf8');
    req.on('data', function(chunk) {
        data += chunk;
	console.log('chunk = ')
	console.log(chunk);
    });
    req.on('end', function() {
     if (data.length !==0) {
	console.log(data)
        req.rawBody = data;
//console.log(req.rawBody);
        next();
     }
    });
  }
});
app.use(bodyParser.json() );
app.use(bodyParser.urlencoded({extended:true}));

//Send tracked positions for display
app.get('/track/:user', (req, res) => {
  var user;
  if (req.params.user !== undefined) user = req.params.user;
  //console.log(testRide.features[0])

  //var geojson = GeoJSON.parse(testRide, {Point: ['lat', 'lng'], include: ['time']});
  //console.log(testRide)
  if (testRide.features.length == 0) {res.sendStatus(204); return;}
  var toReturn = polygonFun.makeLine(testRide);
  //console.log(util.inspect(toReturn, false, null))
  var geobuf = geobufFun.geojsonToGeobuf(toReturn);//geojson);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }
  //console.log(util(inspect(
  //console.log("GPX sent");

});

app.delete('/track/:user', (req, res) => {
  var user;
  if (req.params.user !== undefined) user = req.params.user;
  testRide.features.length = 0;
  console.log('track deleted for ' + user);
  res.send('ok');
});

createIcon = function(geojson) {
  var extent = geojson.features[0].properties.extent
  var width = Math.abs(extent[0] - extent[2])
  var height = Math.abs(extent[1] - extent[3])

  var simplifyBase = 0.1
  var simplifyDivisor = 3
  var simplifyWeight = Math.max(width, height)/simplifyDivisor
  simplifyWeight = simplifyWeight.toFixed(6)
  console.log('simplifyWeight: ' + simplifyWeight)
  var simple = SimplifyGeoJson(geojson, simplifyBase*simplifyWeight)
  var svg = geojsonToSvg()
    //.type('type')
    //.styles({'GPX' : {stroke: 'red' } })
    .styles(function(feature, canvasBBox, featureBBox) {
		var extent = feature.properties.extent
		var width = Math.abs(extent[0] - extent[2])
		var height = Math.abs(extent[1] - extent[3])
		var strokeWeight = (Math.max(width, height)/10)
//		var newWeight = strokeWeight.toFixed(4)
	  console.log('strokeWeight: ' + strokeWeight)

//		return { stroke:"red", weight:1, opacity:.5};
		return { stroke:"red", weight:strokeWeight, opacity:.5};
	})
    .projection(function(coord) {
	return [coord[0], coord[1]*-1];
    })
    //.data({type: 'Feature', properties: {type: 'GPX'} })
    .render(simple)
//    .extent(0, 0, 300, 300)
  var hackSvg = svg.replace(" viewBox=\"NaN NaN NaN NaN\"", " viewBox=\"0 0 300 300\"")
  console.log('modified svg ' + hackSvg)
  return hackSvg;
}

//Upload Location - TODO ADD USER FIELD
app.post('/track', (req, res) => {
  var loc = req.body.location;
  var feature =  GeoJSON.parse(loc, {Point: ['lat', 'lng'], include: ['time', 'acc']});
  feature.properties.type="pos"
  var different;
  //console.log(testRide.features)
  if (testRide.features.length > 0) {
    var prevFeature = testRide.features[testRide.features.length-1]
    var different = polygonFun.checkIfPointsDiffer(feature, prevFeature);
    if (different) { testRide.features.push(feature); }
    else {
     testRide.features[testRide.features.length-1].properties.time = feature.properties.time;
    //console.log(loc + "\r\n Is Different? " + different);//testRide.features);
    }
  }
  else {
    testRide.features.push(feature); 
    console.log('recieved first loc ');
    different = true;
  }
  if (different) { console.log('received loc ' + loc); }
  else { console.log('Stationary, updated timestamp') }

  res.send('ok');
});


//Upload route to display with track
app.post('/route/gpx', (req, res) => {
  console.log('Receiving GPX file for display on track');
  console.log('rawBody = ' + req.rawBody);
  var xml = new xmldom().parseFromString(req.rawBody, "application/xml")
  this.routeToDisplay = polygonFun.insertExtents(toGeoJSON.gpx(xml));
  var svg = createIcon(this.routeToDisplay);
  console.log('SVG is ' + svg.length + 'chars');
  //console.log(util.inspect(json, false, null));
  res.send(svg);
});
app.delete('/route/gpx', (req, res) => {
  this.routeToDisplay = null;
  console.log('route deleted')
  res.send('ok');
});
app.get('/route/gpx', (req, res) => {
  //console.log(this.routeToDisplay);
  if (this.routeToDisplay !== null) { 
	  console.log('about to geobuf:')
	  console.log('route = ' + this.routeToDisplay)
	  var geobuf = geobufFun.geojsonToGeobuf(this.routeToDisplay);
	  res.send(new Buffer(geobuf));
  }
});

app.get('/test', (req, res) => {
  var str = '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Tiny Test Route"},"geometry":{"type":"LineString","coordinates":[[-124.72641,48.380426,74.9],[-117.116037,32.538975,3],[-117.115631,32.538131,3.2],[-83.848714,30.751335,62.4],[-83.847656,30.751278,63.6],[-80.442413,25.667059,1.3],[-80.441895,25.666285,1.3],[-67.039122,44.788851,33.1],[-67.038574,44.789633,35.8],[-69.224854,47.439235,390.4]]}}]}'
  var svg=createIcon(JSON.parse(str));
  res.send(svg);
})

app.listen(config.trackerServerPort, function() {
	console.log('Tracker server listening on port ' + config.trackerServerPort)
})
