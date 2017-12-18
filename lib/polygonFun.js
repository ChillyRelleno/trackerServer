var ClipPoly = require('geojson-slicer')
var GeoBounds = require('geojson-bounds')

intersectRect = function(r1, r2) {
  var LEFT = 0;
  var BOTTOM = 1;
  var RIGHT = 2;
  var TOP = 3
  var intersect = !((+(r1[LEFT]) > +(r2[RIGHT])) ||
          (+(r1[RIGHT]) < +(r2[LEFT])) ||
          (+(r1[TOP]) < +(r2[BOTTOM])) ||
          (+(r1[BOTTOM]) > +(r2[TOP])))
  return intersect
}


module.exports = {

/*geobufToGeojson : function(geobuf) {
  return Geobuf.decode( new Pbf(geobuf) );
},

geojsonToGeobuf : function(geojson) {
  return  Geobuf.encode(geojson, new Pbf());
}*/

processFeatures: (cache, optPerFeatureFunc, optFCFunc) => {
  var i = 0, toSend= [], len = cache.features.length;
  console.log('Processing all ' + len + ' elements');
  for (i = 0; i < len; i++) {
        toSend.push(cache.features[i]);//JSON.parse(JSON.stringify(cache.features[i])));
        //checkLegend for AQI
        if (optPerFeatureFunc !== undefined) optPerFeatureFunc(cache.features[i]);
  }//for
  //clipFeatures,  for AQI
  if (optFCFunc !== undefined) toSend =optFCFunc(toSend, false);
  return toSend;

},

filterFeaturesByBounds : (cache, west, south, east, north,
                optPerFeatureFunc, optFCFunc) => {
  //console.log(cache);
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
},//filterFeaturesByBounds

clipPolysByBounds : function(toSend, boundingBox) {
   var clippedPolys = null;
  var i = 0, j = 0, len = 0;
  clippedPolys = ClipPoly(toSend, boundingBox, { cutFeatures:true })
  for (i = 0, len = clippedPolys.features.length; i < len; i++) {
    for (j = 0; j < clippedPolys.features[i].geometry.coordinates.length; j++)
      clippedPolys.features[i].geometry.coordinates[j].push(clippedPolys.features[i].geometry.coordinates[j][0]);
  }//for toSend
  return clippedPolys;
},//clipPolysByBounds

//Calculate bounding boxes - GeoBounds
calcBounds : function(feature) { //json) {
    var extent = GeoBounds.extent(feature.geometry)
    feature.properties.extent = [
        Number(extent[0]).toFixed(4), Number(extent[1]).toFixed(4),
        Number(extent[2]).toFixed(4), Number(extent[3]).toFixed(4)]
  return feature
},//calcBounds

insertExtents : function(geojson) {
 var i = 0;
  for (i = 0, len = geojson.features.length; i < len; i++) {
    //geojson.features[i] = setStyleFunc(geojson.features[i])  // setFireStyle(geojson.feature$
    geojson.features[i] = this.calcBounds(geojson.features[i])
  }//for each feature
  return geojson;
},




}//module.exports
//export default {geobufToGeojson, geojsonToGeobuf};

