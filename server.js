var express = require('express')
var cors = require('cors')
var GeoBounds = require('geojson-bounds')
var fetch = require('node-fetch')
var schedule = require('node-schedule')
var fs = require('graceful-fs')
var app = express()
var xmldom = require('xmldom').DOMParser;
var toGeoJSON  = require('./lib/togeojson.js')
var GeoJSON = require('geojson')
//var stringify = require('json-stringify')
const util = require('util')
var ClipPoly = require('geojson-slicer')
var compression = require('compression')
var Geobuf = require('geobuf')
//var Normalize = require('@mapbox/geojson-normalize')
var SimplifyGeoJson = require('simplify-geojson')
var Pbf = require('pbf');

var config = require('./config.js')
process.env.NODE_ENV = config.node_env;

app.use(cors());
app.use(compression());
app.use(express.static(__dirname));

var simplifyTolerance = 0.001;
var DOWNLOAD_DIR = './dataCache/';

//*****other stuff*********//
getTestRoute = function(req, res)  {
  fs.readFile('./test.gpx', (err, data) => {
     if (err) {throw err};
     var str = String(data);
     var xml = new xmldom().parseFromString(str, "text/xml")
     var json = toGeoJSON.gpx(xml);
     var geobuf = geojsonToGeobuf(json);
     //res.send(json);
     res.send(new Buffer(geobuf));
  } );//
};//getTestRoute
app.get('/getTestRoute', (req, res) => {getTestRoute(req, res);});


//**************Functions shared between Fire / AQI*******************************//


var modifyFeatures = function(json, setStyleFunc) {
  var i = 0;
  //if (json.features[0].properties.type == "AQI")
  //console.log(json);
  for (i = 0, len = json.features.length; i < len; i++) {
    //set style
    json.features[i] = setStyleFunc(json.features[i])  // setFireStyle(json.features[i])

    //Calculate and store bounds
    json.features[i] = calcBounds(json.features[i])
  }//for each feature
  //destCache = json
  console.log("Bounding boxes calculated and stored for " + i +
	" " +json.features[0].properties.type + " perimeters")
  //console.log( destCache)
   return json
}//modifyFeatures()

function sendFilteredResponse(matching, west, south, east, north, res) {
   //console.log(util.inspect(matching,false,null))
   console.log("Matching: " + matching.features.length + ' elements')
   var simplified = SimplifyGeoJson(matching, simplifyTolerance);
   var geobuf = geojsonToGeobuf(simplified);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }//if reply needed
}//sendFilteredResponse


filterFeaturesByBounds = (cache, west, south, east, north, 
		optPerFeatureFunc, optFCFunc) => {
  var i = 0, toSend= [], len = cache.features.length;
  console.log('Filtering ' + len + ' elements');
  var boundingBox =  [Number(west), Number(south), Number(east), Number(north)]
  for (i = 0; i < len; i++) {
    if (intersectRect(boundingBox, cache.features[i].properties.extent)) {
	toSend.push(JSON.parse(JSON.stringify(cache.features[i])));
	//checkLegend for AQI
	if (optPerFeatureFunc !== undefined) optPerFeatureFunc(cache.features[i]);
    }//if intersect
  }//for
  //clipFeatures,  for AQI
  if (optFCFunc !== undefined) toSend =optFCFunc(toSend, boundingBox); 
  return toSend;
}//filterFeaturesByBounds

function clipPolysByBounds(toSend, boundingBox) {
   var clippedPolys = null;
  var i = 0, j = 0, len = 0;
  clippedPolys = ClipPoly(toSend, boundingBox, { cutFeatures:true })
  for (i = 0, len = clippedPolys.features.length; i < len; i++) {
    for (j = 0; j < clippedPolys.features[i].geometry.coordinates.length; j++)
      clippedPolys.features[i].geometry.coordinates[j].push(clippedPolys.features[i].geometry.coordinates[j][0]);
  }//for toSend
  return clippedPolys;
}//clipPolysByBounds

//Calculate bounding boxes - GeoBounds
var calcBounds = function(feature) { //json) { 
    var extent = GeoBounds.extent(feature.geometry)
    feature.properties.extent = [
	Number(extent[0]).toFixed(4), Number(extent[1]).toFixed(4),
	Number(extent[2]).toFixed(4), Number(extent[3]).toFixed(4)]
  return feature
}//calcBounds

var geojsonToGeobuf = function(geojson) {
  var buffer = Geobuf.encode(geojson, new Pbf());
  return buffer;
}

var geobufToGeojson = function(geobuf) {
  var geojson = Geobuf.decode( new Pbf(geobuf) );
  return geojson;
}



//************AQI Functions****************************//

//AQI variables
var AQIREPLY = 'Updated air quality data'
var aqiLegend = [];

function aqiDataPrep(toSend, boundingBox) {
        toSend = buildLegend(clipPolysByBounds(toSend, boundingBox));
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
//app.get('/updateAqiData', (req, res) => {updateAqiData(req, res)})
	//function(req, res) { updateAqiData(req, res).bind(this); });
	//(req, res) => {updateAqiData(req, res)})//.bind(this)})
app.get('/filter/aqi/:west/:south/:east/:north', function (req, res) {
  var matching = null;
  matching = filterFeaturesByBounds(aqiCache, 
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
  matching = filterFeaturesByBounds(aqiTestCache,
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
var aqiTestUrl = "http://phillipdaw.com:" + config.serverPort +
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
var fireTestUrl = "http://phillipdaw.com:" + config.serverPort + "/testFirePerimeters.kml"
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
  var matching = filterFeaturesByBounds(fireCache,
                req.params.west, req.params.south,
                req.params.east, req.params.north)
  sendFilteredResponse({type: "FeatureCollection", features: matching}, 
		req.params.west, req.params.south,
		req.params.east, req.params.north, 
		res);
})//filter/fire


app.get('/filter/fireSeason/fire/:west/:south/:east/:north', function (req, res) {
  var matching = filterFeaturesByBounds(fireTestCache,
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
//  fireCache = null;
  //fireTestCache = null;
 //updateData(aqiUrl, aqiCache, setAqiStyle, aqimoddest);
 //updateData(aqiTestUrl, aqiTestCache, setAqiStyle, aqitestmoddest);
  updateData(fireUrl, fireCallback, setFireStyle, firemoddest);
//console.log(fireCache);
  updateData(fireTestUrl, fireTestCallback, setFireStyle, firetestmoddest);
  /*fetch(fireTestUrl)
    .then(function(res) { 
      console.log(FIREREPLY) 
	return res;
    })
    .then(function(res) { return res.text() })
    .then(function(str) { return (new xmldom()).parseFromString(str, "text/xml") })
    .then(function(xml) { return toGeoJSON.kml(xml) })
    .then(function(json) { return fireCache = modifyFeatures(json, setFireStyle, fireCache); })//calcBounds(json); })
    .then(function(json) { fs.writeFile(firemoddest, JSON.stringify(fireCache), function (err) {
          if (err) return console.log(err);
          else return json;
        }) })*/

  if (typeof res !== "undefined") res.sendStatus("<h1>" + FIREREPLY + "</h1>")
}//updateFireData
//for some reason if you call it in the declaration it doesn't stick around
updateFireData();

var LEFT = 0;
var BOTTOM = 1;
var RIGHT = 2;
var TOP = 3
function intersectRect(r1, r2) {
  var intersect = !((+(r1[LEFT]) > +(r2[RIGHT])) ||
          (+(r1[RIGHT]) < +(r2[LEFT])) ||
          (+(r1[TOP]) < +(r2[BOTTOM])) ||
          (+(r1[BOTTOM]) > +(r2[TOP])))
  return intersect
}

app.listen(config.serverPort, function () {
  console.log('CORS-enabled web server listening on port ' + config.serverPort)
})

