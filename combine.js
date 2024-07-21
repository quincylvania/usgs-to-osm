const fs = require('fs');

var features = [];

for (var i=1; i<=18; i+=1) {
    var geojson = JSON.parse(fs.readFileSync('./json/Things' + i + '.geojson'));
    features = features.concat(geojson.features);
}
console.log(features.length);

var outGeoJson = {
    "type": "FeatureCollection",
    "features": features
};

fs.writeFileSync('./locations.geojson', JSON.stringify(outGeoJson));