var express = require('express')
var cors = require('cors')
var GeoBounds = require('geojson-bounds')
var fetch = require('node-fetch')
var schedule = require('node-schedule')
var fs = require('fs')
var app = express()
var DOWNLOAD_DIR = './dataCache/';

//fire setup
var fireUrl = "https://rmgsc.cr.usgs.gov/outgoing/GeoMAC/ActiveFirePerimeters.kml";
//var fireRule = new schedule.RecurrenceRule();
//fireRule.hour = 3;
//fireRule.minute = 8;
//var fireJob = schedule.scheduleJob(fireRule,
var updateFireData = function() {
  console.log('updating...')
  fetch(fireUrl)
    .then(function(res) { 
      //replace with file name from res
      var dest = fs.createWriteStream(DOWNLOAD_DIR + "ActiveFirePerimeters.kml")
      res.body.pipe(dest);
      console.log('updated fire perimeter data') 
      res.send('ok')
    })
}
var fireJob = schedule.scheduleJob('* * 3 * * *', updateFireData);
app.get('/updateFireData', updateFireData)

//AQI setup
//
//var aqiApiKey = "8B8927D2-B8C3-4371-8E5D-902C4A129469"
//var aqiUrl = "http://www.airnowapi.org/aq/kml/Combined/?SRS=EPSG:4326" +
//		"&API_KEY=" + aqiApiKey;//to be continued in scheduled function
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


//CORS middleware
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}

// Function to download file using wget
var download_file_wget = function(file_url) {

    // extract the file name
    var file_name = url.parse(file_url).pathname.split('/').pop();
    // compose the wget command
    var wget = 'wget -P ' + DOWNLOAD_DIR + ' ' + file_url;
    // excute wget using child_process' exec function

    var child = exec(wget, function(err, stdout, stderr) {
        if (err) throw err;
        else console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
    });
};

app.use(allowCrossDomain);
app.use(express.static(__dirname));

app.get('/filter/fire/:north/:south/:east/:west', function (req, res) {

})

app.get('filter/aqi/:north/:south/:east/:west', function (req, res) {

})

app.listen(3000, function () {
  console.log('CORS-enabled web server listening on port 3000')
})

