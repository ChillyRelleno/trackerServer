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

var DOWNLOAD_DIR = './dataCache/'
var FIREREPLY = 'Updated fire perimeter data'

var fireCache;

//Calculate bounding boxes - GeoBounds
var calcBounds = function(json) {
  //console.log(JSON.stringify(json))
  //fireCache = null;
  //store boundingBox as property in each feature
  var i = 0;
  for (i = 0, len = json.features.length; i < len; i++) {
    //console.log(i)
    //var feature = json.features[i]
    var extent = GeoBounds.extent(json.features[i].geometry)
    json.features[i].properties.extent = extent
  }//for
  console.log("Bounding boxes calculated and stored for " + i + " perimeters")
  fireCache = json
  return json
}//calcBounds

//prep fire data for calcBounds - MOVED TO FETCH PROMISE CHAIN
//var prepFireDataForBounds = function(filePath) {}

//fire setup
var fireUrl = "http://phillipdaw.com:3000/testFirePerimeters.kml"
//"https://rmgsc.cr.usgs.gov/outgoing/GeoMAC/ActiveFirePerimeters.kml";

var updateFireData = function(req, res) {
  console.log('updating...')
  //console.log(res)
  //todo replace with file name from res
  var dest =  DOWNLOAD_DIR + "ActiveFirePerimeters.json"
  var moddest = DOWNLOAD_DIR + "ModifiedFirePerimeters.json"

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
    .then(function(json) { return calcBounds(json); })
    //.then(function(json) { console.log(JSON.stringify(json)); return json; })
    .then(function(json) { fs.writeFile(moddest, JSON.stringify(fireCache), function (err) {
          if (err) return console.log(err);
          else return json;
        }) })
    //.then(function(json) { fs.writeFile(dest, JSON.stringify(json), function (err) {
    //      if (err) return console.log(err);
    //      else { return json; }
    //    }) })

//    .then(json => calcBounds(json))

  res.send("<h1>" + FIREREPLY + "</h1>")
}//

//Problem: Doesn't have res object when run on timer
//var fireJob = schedule.scheduleJob('* * 3 * * *', updateFireData);
app.get('/updateFireData', (req, res) => {updateFireData(req, res)})

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
  return !(r2[LEFT] > r1[RIGHT] || 
           r2[RIGHT] < r1[LEFT] || 
           r2[TOP] > r1[BOTTOM] ||
           r2[BOTTOM] < r1[TOP]);
}
function filterFireByBounds(west, south, east, north) {
  var i = 0;
  var toSend = [];

  //Build geojson header? Use Library?

  var boundingBox = [west, south, east, north];
  // Push intersecting rectangles onto toSend array
  for (i = 0, len = fireCache.features.length; i < len; i++) {
    if (intersectRect(fireCache.features[i].properties.extent, 
	  boundingBox)) {
	toSend.push(fireCache.feastures[i])
    }//if intersect 
  }
}

app.get('/filter/fire/:west/:south/:east/:north', function (req, res) {
  console.log('west : ' + req.params.west)
  console.log('south : ' + req.params.south)
  console.log('east : ' + req.params.east)
  console.log('north : ' + req.params.north)
  
  res.send()
})

app.get('filter/aqi/:west/:south/:east/:north', function (req, res) {

})

app.listen(3000, function () {
  console.log('CORS-enabled web server listening on port 3000')
})

//AQI setup
//
//var aqiApiKey = "8B8927D2-B8C3-4371-8E5D-902C4A129469"
//var aqiUrl = "http://www.airnowapi.org/aq/kml/Combined/?SRS=EPSG:4326" +
//              "&API_KEY=" + aqiApiKey;//to be continued in scheduled function
//var aqiRule = new schedule.RecurrenceRule();
//aqiRule.hour = 2;
//var aqiJob = schedule.scheduleJob(aqiRule, function() {
//  var today = new Date();
//  fetch(aqiUrl
//})

// "http://www.airnowapi.org/aq/kml/Combined/?DATE=" + this.props.date.getFullYear() +
//                  "-" + (this.props.date.getMonth()+1) + "-" + this.props.date.getDate() + "T06&BBOX=" +
//                  west + "," + south + "," + east + "," + north +
//                  "&SRS=EPSG:4326&API_KEY=" + this.props.apiKey;



// Function to download file using wget
//var download_file_wget = function(file_url) {
//
//    // extract the file name
//   var file_name = url.parse(file_url).pathname.split('/').pop();
//    // compose the wget command
//    var wget = 'wget -P ' + DOWNLOAD_DIR + ' ' + file_url;
//    // excute wget using child_process' exec function
//
//    var child = exec(wget, function(err, stdout, stderr) {
//        if (err) throw err;
//        else console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
//    });
//};

