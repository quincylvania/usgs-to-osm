const fs = require('fs');

var features = [];

for (var i=1; i<=18; i+=1) {
    var geojson = JSON.parse(fs.readFileSync('./usgs/source/geojson/paginated/Things' + i + '.geojson'));
    features = features.concat(geojson.features);
}
console.log(features.length);

var outGeoJson = {
    "type": "FeatureCollection",
    "features": features
};

fs.writeFileSync('./usgs/source/geojson/all.geojson', JSON.stringify(outGeoJson));