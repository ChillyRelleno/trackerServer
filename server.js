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

var Geobuf = require('geobuf')
var SimplifyGeoJson = require('simplify-geojson')
var Pbf = require('pbf');

var config = require('./config.js')

app.use(cors());

var simplifyTolerance = 0.001;

//**************Functions shared between Fire / AQI*******************************//
var DOWNLOAD_DIR = './dataCache/'


var modifyFeatures = function(json, setStyleFunc, destCache) {
  var i = 0;
  fireCache = null
  //console.log(json)
  for (i = 0, len = json.features.length; i < len; i++) {
    //set style
    json.features[i] = setStyleFunc(json.features[i])  // setFireStyle(json.features[i])
    //Calculate and store bounds
    json.features[i] = calcBounds(json.features[i])
  }//for each feature
  destCache = json
  console.log("Bounding boxes calculated and stored for " + i + " perimeters")
   return json
}//modifyFeatures()


//Calculate bounding boxes - GeoBounds
var calcBounds = function(feature) { //json) {
    var extent = GeoBounds.extent(feature.geometry)
    feature.properties.extent = [
	Number(extent[0]).toFixed(4), Number(extent[1]).toFixed(4),
	Number(extent[2]).toFixed(4), Number(extent[3]).toFixed(4)]//extent//Number(extent).toFixed(4)
  return feature
}//calcBounds

//send simplified geojson data as geobuf
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
var aqiCache;
var aqiUrl = "http://phillipdaw.com:3000/testAqicontUS.kml"//testAqi.kml"
//contentintal US 
//http://www.airnowapi.org/aq/kml/Combined/?DATE=2017-09-18T06&BBOX=-124.78,24.74,-66.95,49.35&SRS=EPSG:4326&API_KEY=8B8927D2-B8C3-4371-8E5D-902C4A129469


//AQI Routes
app.get('updateAqiData', (req, res) => {updateAqiData(req, res)})
app.get('/filter/aqi/:west/:south/:east/:north', function (req, res) {
  var matching = null;
  matching = filterAqiByBounds(req.params.west,
         req.params.south, req.params.east, req.params.north)
   //console.log(util.inspect(matching,false,null))
   console.log("Matching: " + matching.features.length + ' elements')
  var simplified = SimplifyGeoJson(matching, simplifyTolerance);
  var geobuf = geojsonToGeobuf(simplified);//Geobuf.encode(matching, new Pbf());
  //var buffer = Buffer.from(geobuf);
  if (typeof res !== "undefined") {
    res.type('arraybuffer');
    res.send(new Buffer(geobuf));//arrayBuffer(geobuf);
    //res.json(matching);
  }//if reply needed
})//filter aqi by bounds route


var updateAqiData = function(req, res) {
 //console.log('updating air quality data')

 var aqidest = DOWNLOAD_DIR + "AirQuality.json"
 var aqimoddest = DOWNLOAD_DIR + "ModifiedAirQuality.json"

  fetch(aqiUrl)
    .then(function(res) {
      console.log(AQIREPLY)
        //prepFireDataForBounds(dest)
        return res;
    })
    .then(function(res) { return res.text() })
    .then(function(str) { return (new xmldom()).parseFromString(str, "text/xml") })
    .then(function(xml) { return toGeoJSON.kml(xml) })
//.then(function(json) {console.log(JSON.stringify(json.features[1][0][0])); return json;})
    .then(function(json) { return aqiCache = modifyFeatures(json, setAqiStyle); })
//.then(function(json) { console.log(json.features[1].geometry.coordinates[0][0]);return json;})//JSON.stringify(json.features[0])); return json; })
    .then(function(json) { fs.writeFile(aqimoddest, JSON.stringify(aqiCache), function (err) {
          if (err) return console.log(err);
          else return json;
        }) })
}()//updateAqiData

//This function is identical to the fire one except for the data source
//delete this and make a filterData(source, west, south, east, north) function in shared funcs
function filterAqiByBounds(west, south, east, north) {
  var i = 0;
  var toSend = null; toSend = new Array();
  var len = aqiCache.features.length;
//  var boundary = [west, south, east, north];
  console.log('Filtering ' + len + ' elements')
  //Build geojson header? Use Library?

  var boundingBox =  [Number(west), Number(south), Number(east), Number(north)]
  console.log(boundingBox);
// Push intersecting rectangles onto toSend array
  for (i = 0, len = aqiCache.features.length; i < len; i++) {
    if (intersectRect(boundingBox,
                        aqiCache.features[i].properties.extent)) {
        toSend.push(JSON.parse(JSON.stringify(aqiCache.features[i])))
    }//if intersect
  }//for aqiCache
  var clippedPolys = null;
  clippedPolys = ClipPoly(toSend, boundingBox, { cutFeatures:true })
  for (i = 0, len = clippedPolys.features.length; i < len; i++) {
    for (j = 0; j < clippedPolys.features[i].geometry.coordinates.length; j++)
      clippedPolys.features[i].geometry.coordinates[j].push(clippedPolys.features[i].geometry.coordinates[j][0]);
  }//for toSend
  //console.log(util.inspect(clippedPolys.features[1],false,null))
  //console.log(util.inspect(clippedPolys,false,null))//toSend)
  //console.log(util.inspect(boundary,false,null))//console.log(util.inspect(matching,false,null))

  return clippedPolys
  //return toSend;
}//filterAqiByBounds

//var aqiJob = schedule.scheduleJob('* 30 /1 * * *', function() { this.updateAqiData() });


var setAqiStyle = function(feature) {
  if (typeof(feature.properties.fill) !== undefined) {
      feature.properties.color = feature.properties.fill
  }
  feature.properties.opacity = 0.5
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()



//************Fire Functions****************************//

//Fire variables
var FIREREPLY = 'Updated fire perimeter data'
var fireCache;
//var fireJob = schedule.scheduleJob('* 15 /1 * * *', function () { this.updateFireData() });
var fireUrl = "http://phillipdaw.com:3000/testFirePerimeters.kml"
//"https://rmgsc.cr.usgs.gov/outgoing/GeoMAC/ActiveFirePerimeters.kml";

//Fire Default Style
//Set Defaults for fire perimeters
var setFireStyle = function(feature) {
  feature.properties.color = "black"
  feature.properties.opacity = 0.5
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()


//Fire Routes
app.get('/updateFireData', (req, res) => {updateFireData(req, res)})
app.get('/filter/fire/:west/:south/:east/:north', function (req, res) {

  var matching = filterFireByBounds(req.params.west,
         req.params.south, req.params.east, req.params.north)
   //console.log(util.inspect(matching,false,null))
   var geojson = {type: "FeatureCollection", features: matching}
   console.log("Matching: " + geojson.features.length + ' elements')
   var simplified = SimplifyGeoJson(geojson, simplifyTolerance);
   var geobuf = geojsonToGeobuf(simplified);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }//if reply needed
})//.use(allowCrossDomain);

//Update data from server - currently just using my test data
var updateFireData = function(req, res) {
  //console.log('updating fire data...')
  //todo replace with file name from res
  var firedest =  DOWNLOAD_DIR + "ActiveFirePerimeters.json"
  var firemoddest = DOWNLOAD_DIR + "ModifiedFirePerimeters.json"

  fetch(fireUrl)
    .then(function(res) { 
      console.log(FIREREPLY) 
        //prepFireDataForBounds(dest)
	return res;
    })
    .then(function(res) { return res.text() })
    //.then(function(str) { console.log(str); return str; })
    .then(function(str) { return (new xmldom()).parseFromString(str, "text/xml") })
    .then(function(xml) { return toGeoJSON.kml(xml) })
    //.then(function(json) { console.log(JSON.stringify(json)); return json; })
    .then(function(json) { return fireCache = modifyFeatures(json, setFireStyle); })//calcBounds(json); })
    //.then(function(json) { console.log(JSON.stringify(json)); return json; })
    .then(function(json) { fs.writeFile(firemoddest, JSON.stringify(fireCache), function (err) {
          if (err) return console.log(err);
          else return json;
        }) })

  if (typeof res !== "undefined") res.sendStatus("<h1>" + FIREREPLY + "</h1>")
}()//

function filterFireByBounds(west, south, east, north) {
  var i = 0;
  var toSend = [];
  var len = fireCache.features.length;

  console.log('Filtering ' + len + ' elements')
  //Build geojson header? Use Library?

  var boundingBox =  [west, south, east, north]
  // Push intersecting rectangles onto toSend array
  for (i = 0, len = fireCache.features.length; i < len; i++) {
    if (intersectRect(boundingBox,
                        fireCache.features[i].properties.extent)) {
        //console.log("POLYGON " + i + " - TRUE")
        toSend.push(JSON.parse(JSON.stringify(fireCache.features[i])))
    }//if intersect
    //else console.log("Polygon " + i + " - false")

  }//for
  return toSend;
}




//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

app.use(allowCrossDomain);
app.use(express.static(__dirname));

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



app.listen(config.serverPort/*3000*/, function () {
  console.log('CORS-enabled web server listening on port 3000')
})

