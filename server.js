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

app.use(cors());

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

//Set Defaults for fire perimeters
var setFireStyle = function(feature) {
  feature.properties.color = "red"
  feature.properties.opacity = 0.5
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()

//Calculate bounding boxes - GeoBounds
var calcBounds = function(feature) { //json) {
    var extent = GeoBounds.extent(feature.geometry)
    feature.properties.extent = [
	Number(extent[0]).toFixed(4), Number(extent[1]).toFixed(4),
	Number(extent[2]).toFixed(4), Number(extent[3]).toFixed(4)]//extent//Number(extent).toFixed(4)
  return feature
}//calcBounds


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
  var matching = filterAqiByBounds(req.params.west,
         req.params.south, req.params.east, req.params.north)
   console.log(util.inspect(matching,false,null))
   console.log("Matching: " + matching./*features.*/length + ' elements')

  if (typeof res !== "undefined") {
    res.json(matching);
  }//if reply needed
})//filter aqi by bounds route


var updateAqiData = function(req, res) {
 console.log('updating air quality data')

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
    .then(function(json) { return aqiCache = modifyFeatures(json, setAqiStyle); })
    .then(function(json) { fs.writeFile(aqimoddest, JSON.stringify(aqiCache), function (err) {
          if (err) return console.log(err);
          else return json;
        }) })
}()//updateAqiData

//This function is identical to the fire one except for the data source
//delete this and make a filterData(source, west, south, east, north) function in shared funcs
function filterAqiByBounds(west, south, east, north) {
  var i = 0;
  var toSend = [];
  var len = aqiCache.features.length;

  console.log('Filtering ' + len + ' elements')
  //Build geojson header? Use Library?

  var boundingBox =  [west, south, east, north]
  // Push intersecting rectangles onto toSend array
  for (i = 0, len = aqiCache.features.length; i < len; i++) {
    if (intersectRect(boundingBox,
                        aqiCache.features[i].properties.extent)) {
        console.log("POLYGON " + i + " - TRUE")
        toSend.push(aqiCache.features[i])
    }//if intersect
    else console.log("Polygon " + i + " - false")

  }//for
  return toSend;
}//filterAqiByBounds

var aqiJob = schedule.scheduleJob('* 30 /1 * * *', updateFireData);


var setAqiStyle = function(feature) {
  //feature.properties.color = "yellow"
  if (typeof(feature.properties.fill) !== undefined) {
//    if (features.properties.fill !== 1)
//      console.log(feature
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
var fireJob = schedule.scheduleJob('* * /1 * * *', updateFireData);
var fireUrl = "http://phillipdaw.com:3000/testFirePerimeters.kml"
//"https://rmgsc.cr.usgs.gov/outgoing/GeoMAC/ActiveFirePerimeters.kml";

//Fire Default Style
//Set Defaults for fire perimeters
var setFireStyle = function(feature) {
  feature.properties.color = "red"
  feature.properties.opacity = 0.5
  //feature.properties.setProperty('fill-opacity', 0.5)//fillOpacity = 0.5
  return feature
}//setStyle()


//Fire Routes
app.get('/updateFireData', (req, res) => {updateFireData(req, res)})
app.get('/filter/fire/:west/:south/:east/:north', function (req, res) {
  console.log('west : ' + req.params.west)
  console.log('south : ' + req.params.south)
  console.log('east : ' + req.params.east)
  console.log('north : ' + req.params.north)

  var matching = filterFireByBounds(req.params.west,
         req.params.south, req.params.east, req.params.north)
   console.log(util.inspect(matching,false,null))
   console.log("Matching: " + matching./*features.*/length + ' elements')

  if (typeof res !== "undefined") {
    res.json(matching);
  }//if reply needed
})//.use(allowCrossDomain);

//Update data from server - currently just using my test data
var updateFireData = function(req, res) {
  console.log('updating fire data...')
  //console.log(res)
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
        console.log("POLYGON " + i + " - TRUE")
        toSend.push(fireCache.features[i])
    }//if intersect
    else console.log("Polygon " + i + " - false")

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
  //console.log(r1, r2)
  //console.log("r1L > r2R ? " + (+(r1[LEFT]) > +(r2[RIGHT]))) //they all fail this rule...
  //console.log("r1R < r2L ? " + (+(r1[RIGHT]) < +(r2[LEFT])))
  //console.log("r1T < r2B ? " + (+(r1[TOP]) < +(r2[BOTTOM])))
  //console.log("r1B > r2T ? " +  (+(r1[BOTTOM]) > +(r2[TOP])))
  var intersect = !((+(r1[LEFT]) > +(r2[RIGHT])) ||
          (+(r1[RIGHT]) < +(r2[LEFT])) ||
          (+(r1[TOP]) < +(r2[BOTTOM])) ||
          (+(r1[BOTTOM]) > +(r2[TOP])))
  //console.log("Polygon " + intersect)
  //console.log('')
  return intersect
}



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

