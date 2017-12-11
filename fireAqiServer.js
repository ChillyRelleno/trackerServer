//Both use
var express = require('express')
var cors = require('cors')
var app = express()
var fetch = require('node-fetch')
var compression = require('compression')
var fs = require('graceful-fs')

//This one uses
var xmldom = require('xmldom').DOMParser;
var toGeoJSON  = require('./lib/togeojson.js')
var geobufFun = require('./lib/geobufFun.js')
var polygonFun = require('./lib/polygonFun.js')
var GeoJSON = require('geojson')
var SimplifyGeoJson = require('simplify-geojson')
var bodyParser = require('body-parser');
var config = require('./config.js')
//var schedule = require('node-schedule')

//In dev only
process.env.NODE_ENV = config.node_env;
const util = require('util')


//var stringify = require('json-stringify')
//var Normalize = require('@mapbox/geojson-normalize')
//require('body-parser-xml')(bodyParser);
//var XmlStream = require('xml-stream');
//var GeoBounds = require('geojson-bounds')
//var ClipPoly = require('geojson-slicer')
//var xmlBodyparser = require('express-xml-bodyparser')
//var dateFormat = require('dateformat');
//var Geobuf = require('geobuf')
//var Pbf = require('pbf');

app.use(cors());
app.use(compression());
app.use(express.static(__dirname));

var simplifyTolerance = 0.001;
var DOWNLOAD_DIR = './dataCache/';

//*****other stuff*********//
getTestRoute = function(req, res)  {
  fs.readFile('./testsimple.geojson', (err, data) => { //'./test.gpx', (err, data) => {
     if (err) {throw err};
     var str = String(data);
     //var xml = new xmldom().parseFromString(str, "text/xml")
     var json = JSON.parse(str);//toGeoJSON.gpx(xml);
     console.log(json);
     var geojson = GeoJSON.parse(json, {Point: ['lat', 'lng']});
     //var simplified = SimplifyGeoJson(json, 5);//max simplification?  //simplifyTolerance)
     //todo: simplify the file on the command line
     var geobuf = geobufFun.geojsonToGeobuf(json);//simplified);//json);
     //res.send(json);
     res.send(new Buffer(geobuf));
  } );//
};//getTestRoute
app.get('/getTestRoute', (req, res) => {getTestRoute(req, res);});


//**************Functions shared between Fire / AQI*******************************//


var modifyFeatures = function(json, setStyleFunc) {
  var i = 0;
  for (i = 0, len = json.features.length; i < len; i++) {
    json.features[i] = setStyleFunc(json.features[i])  // setFireStyle(json.features[i])
    json.features[i] = polygonFun.calcBounds(json.features[i])
  }//for each feature
  console.log("Bounding boxes calculated and stored for " + i +
	" " +json.features[0].properties.type + " perimeters")
   return json
}//modifyFeatures()

function sendFilteredResponse(matching, west, south, east, north, res) {
   //console.log(util.inspect(matching,false,null))
   console.log("Matching: " + matching.features.length + ' elements')
   var simplified = SimplifyGeoJson(matching, simplifyTolerance);
   var geobuf = geobufFun.geojsonToGeobuf(simplified);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }//if reply needed
}//sendFilteredResponse


/*
var geojsonToGeobuf = function(geojson) {
  var buffer = Geobuf.encode(geojson, new Pbf());
  return buffer;
}

var geobufToGeojson = function(geobuf) {
  var geojson = Geobuf.decode( new Pbf(geobuf) );
  return geojson;
}*/


//************AQI Functions****************************//

//AQI variables
var AQIREPLY = 'Updated air quality data'
var aqiLegend = [];

function aqiDataPrep(toSend, boundingBox) {
        toSend = buildLegend(polygonFun.clipPolysByBounds(toSend, boundingBox));
	return toSend;
}//aqiDataPrep

var checkLegend = function(feature) {
    var contains = false;
    var styleUrl = feature.properties.styleUrl.charAt(1);
    var i = 0, len = 0;
    for (i = 0, len = aqiLegend.length; i < len; i++) {
      if (aqiLegend[i][0] == styleUrl) { contains = true; }
    }//for

    if (!contains) {
        aqiLegend.push([styleUrl, feature.properties.color]);
    }//if ! contains}
}//checkLegend

var buildLegend = function(fc) {
  fc.properties = {legend: aqiLegend};
  //clear for next time
  aqiLegend = [];//new Array();
  return fc;//aqiLegend;
}//buildLegend


//AQI Routes
app.get('/filter/aqi/:west/:south/:east/:north', function (req, res) {
  var matching = null;
  matching = polygonFun.filterFeaturesByBounds(aqiCache, 
	req.params.west, req.params.south, 
	req.params.east, req.params.north,
                checkLegend, aqiDataPrep);
  sendFilteredResponse(matching,
                req.params.west, req.params.south,
                req.params.east, req.params.north,
		res);
})//filter aqi by bounds route

app.get('/filter/fireSeason/aqi/:west/:south/:east/:north', function (req, res) {
  var matching = null;
  matching = polygonFun.filterFeaturesByBounds(aqiTestCache,
        req.params.west, req.params.south,
        req.params.east, req.params.north,
                checkLegend, aqiDataPrep);
  sendFilteredResponse(matching,
                req.params.west, req.params.south,
                req.params.east, req.params.north,
                res);
})//filter aqi by bounds route
//Move to general functions
var updateData = (url, callback, setStyleFunc, modifiedDest) => {
  console.log("----"+url+"----")
  fetch(url)
    .then(function(res) { return res.text() })
    .then(function(str) { return (new xmldom()).parseFromString(str, "text/xml") })
    .then(function(xml) { return toGeoJSON.kml(xml) })
    .then(function(json) { return callback( modifyFeatures(json, setStyleFunc)); })
    //.then(function(json) { console.log(json);return json;})//"Length: "+ json.features.length);return json; })
    .then(function(json) {
        fs.writeFile(modifiedDest, JSON.stringify(json), function (err) {
          if (err) return console.log(err);
	  else return json;
        }) })
}

//contentintal US 
//"http://www.airnowapi.org/aq/kml/Combined/?DATE=2017-09-18T06
//&BBOX=-124.78,24.74,-66.95,49.35&SRS=EPSG:4326&API_KEY="  +
//8B8927D2-B8C3-4371-8E5D-902C4A129469

var aqiCache;
var aqiTestCache;
var aqiTestUrl = config.fireAqiServerUrl + ":" + config.fireAqiServerPort +
        "/testAqicontUS.kml";
//contentintal US
var aqiUrlPreDate = "http://www.airnowapi.org/aq/kml/Combined/?DATE="
//2017-09-18
var aqiUrlPostDate = "T06&BBOX=-124.78,24.74,-66.95,49.35&SRS=EPSG:4326&API_KEY=" + 
		config.aqiApiKey;
//8B8927D2-B8C3-4371-8E5D-902C4A129469

var setAqiStyle = function(feature) {
  if (typeof(feature.properties.fill) !== undefined) {
    feature.properties.color = feature.properties.fill;

  }//if there's a color
  feature.properties.opacity = 0.5
  feature.properties.type = "AQI";
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()

aqiCallback = (json) => {
 aqiCache = json;
}

aqiTestCallback = (json) => {
  aqiTestCache = json;
}

//updateAqiData
//Updates both the test data (from scratch)and the live data from airnowapi.org
//Meant to be run hourly
//Saves to disk. Will make function to read from disk on startup
var updateAqiData = function(req, res) {
//updateAqiData = (req, res) => {
 //console.log('updating air quality data')

 var aqidest = DOWNLOAD_DIR + "AirQuality.json"
 var aqimoddest = DOWNLOAD_DIR + "ModifiedAirQuality.json" 
 var aqitestdest = DOWNLOAD_DIR + "TestAirQuality.json"
 var aqitestmoddest = DOWNLOAD_DIR + "TestModifiedAirQuality.json"

 var today = new Date();
 var todayStr = String(today.getFullYear()) + "-" + String(Number(today.getMonth())+1) + "-" +
	String(today.getDate());
 //console.log(todayStr);
 var aqiUrl = aqiUrlPreDate + todayStr + aqiUrlPostDate;
//(url, cache, setStyleFunc, dest, modDest)
 updateData(aqiUrl, aqiCallback, setAqiStyle, aqimoddest);
 updateData(aqiTestUrl, aqiTestCallback, setAqiStyle, aqitestmoddest);

 if (typeof res !== "undefined") res.sendStatus("<h1>" + AQIREPLY + "</h1>")

}//updateAqiData
updateAqiData();

//var aqiJob = schedule.scheduleJob('* 30 /1 * * *', function() { this.updateAqiData() });


//************Fire Functions****************************//

//Fire variables
var FIREREPLY = 'Updated fire perimeter data'
var fireCache = null, fireTestCache = null;
//var fireJob = schedule.scheduleJob('* 15 /1 * * *', function () { this.updateFireData() });
var fireTestUrl = config.fireAqiServerUrl + ":" + config.fireAqiServerPort + "/testFirePerimeters.kml"
var fireUrl = "https://rmgsc.cr.usgs.gov/outgoing/GeoMAC/ActiveFirePerimeters.kml";

//Fire Default Style
//Set Defaults for fire perimeters
var setFireStyle = function(feature) {
  feature.properties.color = "black"
  feature.properties.opacity = 0.5
  feature.properties.type="Fire"
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()


//Fire Routes
//app.get('/updateFireData', (req, res) => {updateFireData(req, res)})
app.get('/filter/fire/:west/:south/:east/:north', function (req, res) {
  console.log(fireCache)
  var matching = polygonFun.filterFeaturesByBounds(fireCache,
                req.params.west, req.params.south,
                req.params.east, req.params.north)
  sendFilteredResponse({type: "FeatureCollection", features: matching}, 
		req.params.west, req.params.south,
		req.params.east, req.params.north, 
		res);
})//filter/fire


app.get('/filter/fireSeason/fire/:west/:south/:east/:north', function (req, res) {
  var matching = polygonFun.filterFeaturesByBounds(fireTestCache,
                req.params.west, req.params.south,
                req.params.east, req.params.north)
  sendFilteredResponse({type: "FeatureCollection", features: matching},
                req.params.west, req.params.south,
                req.params.east, req.params.north,
                res);
})//filter/fireSeason/fire

fireCallback = (json) => {
 fireCache = json;
}

fireTestCallback = (json) => {
  fireTestCache = json;
}


//Update data from server - currently just using my test data
var updateFireData = function(req, res) {
  //console.log('updating fire data...')
  //todo replace with file name from res
  var firedest =  DOWNLOAD_DIR + "ActiveFirePerimeters.json"
  var firemoddest = DOWNLOAD_DIR + "ModifiedFirePerimeters.json"
  var firetestdest =  DOWNLOAD_DIR + "TestActiveFirePerimeters.json"
  var firetestmoddest = DOWNLOAD_DIR + "TestModifiedFirePerimeters.json"
  updateData(fireUrl, fireCallback, setFireStyle, firemoddest);
  updateData(fireTestUrl, fireTestCallback, setFireStyle, firetestmoddest);

  if (typeof res !== "undefined") res.sendStatus("<h1>" + FIREREPLY + "</h1>")
}//updateFireData
//for some reason if you call it in the declaration it doesn't stick around
updateFireData();


app.listen(config.fireAqiServerPort, function () {
  console.log('CORS-enabled web server listening on port ' + config.fireAqiServerPort)
})
