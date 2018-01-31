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
//var server = require('http').Server(app);
var server = app.listen(config.trackerServerPort, function() {
	console.log('Tracker server listening on port ' + config.trackerServerPort)
})

var io = require('socket.io')(server);

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
var testRide = [];// = {type: "FeatureCollection", features: []}
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

//SOCKET EVENTS
//allData is the initial upload, all data so far as {allData: ... }
//updateData is a single loc, as {updateData: ... }
//updateTime is {updateTime: ...}
//may have to add ride ID later, some way to only send to select clients
io.on('connection', (socket) => {
  socket.on('room', (room) => { 
    
    var split = room.split(".");
    var user = split[0];
    var ride = split[1];
    user = user.toLowerCase();
    if (ride != 'defaultRide') ride = ride.toLowerCase();
    roomMod = user + '.' + ride;
    socket.join(roomMod);
    console.log('client joined ' + roomMod);

    if (testRide[user] !== undefined)
    if(testRide[user][ride] !== undefined) {
      var toReturn = polygonFun.makeLine(testRide[user][ride]);
      if (toReturn.features.length >1)
      socket.emit('allData', { allData: toReturn });
    }

  });
});//on connection



//Send tracked positions for display
app.get('/track/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;

  if (testRide[user][ride].features.length == 0) {res.sendStatus(204); return;}
  var toReturn = polygonFun.makeLine(testRide[users][ride]);
  //console.log(util.inspect(toReturn, false, null))
  var geobuf = geobufFun.geojsonToGeobuf(toReturn);//geojson);
  if (typeof res !== "undefined") {
    res.type('arraybuffer')
    res.send(new Buffer(geobuf));
  }
});

app.delete('/track/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;

  if (testRide[user] !== undefined)
    if(testRide[user][ride] !== undefined) {
      testRide[user][ride].features.length = 0;
      console.log('track deleted for ' + user);
      res.send('ok');
  }
});

conditionUserRideParams = (userParam, rideParam) => {
  var user = 'tnr', ride = 'defaultRide';
  if (userParam !== undefined) user = userParam;
  if (rideParam !== undefined) ride = rideParam;
  if (!ride) ride = 'defaultRide';
  user = user.toLowerCase();
  if (ride != 'defaultRide') ride = ride.toLowerCase();

  return { 'user': user, 'ride': ride }
}

createUserRideIfNew = (user, ride) => {
  if (!testRide[user]) testRide[user] =[];
  if (!testRide[user][ride]) {
        testRide[user][ride] = {type: "FeatureCollection", features: []};
	//testRide[user][ride].properties.distance = 0;
        //testRide[user][ride].properties.sumDistance = 0;
        //if it's a new ride but the user already has defaultRide data, clear it
        //if (testRide[user]['defaultRide'].features) { 
	testRide[user]['defaultRide'] =  {type: "FeatureCollection", features: []};
		//.features.length = 0;
	//}
  }
}


//Upload Location - TODO ADD USER FIELD
app.post('/track/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;
  var loc;
  if (req.body.location !== undefined) loc = req.body.location;
  var feature =  GeoJSON.parse(loc, {Point: ['lat', 'lng'], include: ['time', 'acc', 'distance', 'sumDistance']});
  feature.properties.type="pos"
  var different = false;
  createUserRideIfNew(user, ride);

  var length = testRide[user][ride].features.length;
  if (testRide[user][ride].features.length > 0) {
    var prevFeature = testRide[user][ride].features[testRide[user][ride].features.length-1]
    //returns distance in meters if different, 0 if rejected
    var difference = polygonFun.checkIfPointsDiffer(feature, prevFeature);
    if (difference !== 0) {
	feature.properties.distance = difference;//{'magnitude': different, 'unit': 'm'};
	different = true;
	feature.properties.sumDistance =
	  testRide[user][ride].features[testRide[user][ride].features.length-1]
		.properties.sumDistance + difference;
    }
    else {
     testRide[user][ride].features[testRide[user][ride].features.length-1].properties.time = feature.properties.time;
     testRide[user]['defaultRide'].features[testRide[user]['defaultRide'].features.length-1].properties.time = feature.properties.time;

     io.sockets.in(user+'.defaultRide').emit('updateTime', {updateTime: feature.properties.time});
     io.sockets.in(user+'.'+ride).emit('updateTime', {updateTime: feature.properties.time});
    }
  }
  else {
    feature.properties.distance = 0;
    feature.properties.sumDistance = 0;

    console.log('recieved first loc ' + user + '.' + ride);
    different = true;
  }
  if (different ) {
    console.log(user + '.' + ride + ' received loc ' + feature.geometry.coordinates);
    testRide[user][ride].features.push(feature);
    testRide[user]['defaultRide'].features.push(feature);

    if (length == 0) {
	var toReturn = polygonFun.makeLine(testRide[user][ride]);
	io.sockets.in(user+'.defaultRide').emit('allData', {allData: toReturn});
	io.sockets.in(user+'.'+ride).emit('allData', {allData: toReturn});
    }
    else {
	io.sockets.in(user+'.defaultRide').emit('updateData', { updateData: feature });
	io.sockets.in(user+'.'+ride).emit('updateData', {updateData: feature});
    }

  }
  else { console.log('Stationary, updated timestamp') }

  res.send('ok');
});


//Upload route to display with track
app.post('/route/gpx/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;

  console.log('Receiving GPX file for display on track');
  console.log('rawBody = ' + req.rawBody);
  var xml = new xmldom().parseFromString(req.rawBody, "application/xml")
  this.routeToDisplay = polygonFun.insertExtents(toGeoJSON.gpx(xml));
  var svg = createIcon(this.routeToDisplay);
  console.log('SVG is ' + svg.length + 'chars');
  res.send(svg);
});
app.delete('/route/gpx/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;

  this.routeToDisplay = null;
  console.log('route deleted')
  res.send('ok');
});
app.get('/route/gpx/:user/:ride', (req, res) => {
  var userRide = conditionUserRideParams(req.params.user, req.params.ride);
  var user = userRide.user;
  var ride = userRide.ride;

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
    .styles(function(feature, canvasBBox, featureBBox) {
		var extent = feature.properties.extent
		var width = Math.abs(extent[0] - extent[2])
		var height = Math.abs(extent[1] - extent[3])
		var strokeWeight = (Math.max(width, height)/10)
	        //console.log('strokeWeight: ' + strokeWeight)

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
