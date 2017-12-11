var Geobuf = require( 'geobuf' );
var Pbf = require( 'pbf' );
module.exports = {
geobufToGeojson : function(geobuf) {
  return Geobuf.decode( new Pbf(geobuf) );
},

geojsonToGeobuf : function(geojson) {
  return  Geobuf.encode(geojson, new Pbf());
}
}//module.exports
//export default {geobufToGeojson, geojsonToGeobuf};

