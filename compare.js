const fs = require('fs');

function indexedFeatures(features) {
    var out = {};
    features.forEach(function(feature) {
        out[feature.properties.ref] = feature;
    });
    return out;
}

function noName(obj) {
    var out = Object.assign({}, obj);
    delete out.name;
    return out;
}

const isIdenticalShallow = (obj1, obj2) =>
    Object.keys(obj1).length === Object.keys(obj2).length &&
    Object.keys(obj1).every(key => 
      obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
    );

var newFeatures = [];
var outdatedFeatureRefs = [];

fs.readdirSync("./uploaded/").forEach(file => {

    var uploaded = indexedFeatures(JSON.parse(fs.readFileSync("./uploaded/" + file)).features);
    var latest = indexedFeatures(JSON.parse(fs.readFileSync("./bystate/" + file)).features);

    for (var id in latest) {
        if (!uploaded[id]) {
            newFeatures.push(latest[id]);
            console.log(file.substring(0, 2) + ' ' + id + " – not uploaded");
        } else {
            if (!isIdenticalShallow(noName(latest[id].properties), noName(uploaded[id].properties))) {
                outdatedFeatureRefs.push(id); 
                console.log("Tags differ...");
                console.log("Uploaded:");
                console.log(uploaded[id].properties);
                console.log("Latest:");
                console.log(latest[id].properties);
            }
        }
    }
});

fs.writeFileSync('./new.geojson', JSON.stringify({
    "type": "FeatureCollection",
    "features": newFeatures
}, null, 2));

/*
[out:xml][timeout:25];
{{geocodeArea:Rhode Island}}->.searchArea;
(area.searchArea);
(._;>;); out meta;
*/

console.log('node["operator:short"="USGS"]["ref"~"^(' + outdatedFeatureRefs.join("|") + ')$"];')