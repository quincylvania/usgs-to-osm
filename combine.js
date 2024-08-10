import { readFileSync, writeFileSync } from 'fs';

var features = [];

for (var i=1; i<=18; i+=1) {
    var geojson = JSON.parse(readFileSync('./usgs/source/geojson/paginated/Things' + i + '.geojson'));
    features = features.concat(geojson.features);
}
console.log(features.length);

var outGeoJson = {
    "type": "FeatureCollection",
    "features": features
};

writeFileSync('./usgs/source/geojson/all.geojson', JSON.stringify(outGeoJson));