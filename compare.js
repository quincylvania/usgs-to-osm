const fs = require('fs');

const overwriteUploaded = true;
const moveDiffedToUploaded = true;

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

    var newFeaturesInState = [];

    var uploaded = indexedFeatures(JSON.parse(fs.readFileSync("./uploaded/" + file)).features);
    var diffed = indexedFeatures(JSON.parse(fs.readFileSync("./diffed/" + file)).features);
    var latest = indexedFeatures(JSON.parse(fs.readFileSync("./bystate/" + file)).features);

    if (moveDiffedToUploaded) {
        Object.assign(uploaded, diffed)
    }

    for (var id in latest) {
        if (!uploaded[id]) {
            newFeaturesInState.push(latest[id]);
            newFeatures.push(latest[id]);
            console.log(file.substring(0, 2) + ' ' + id + " – not uploaded");
        } else {
            if (!isIdenticalShallow(noName(latest[id].properties), noName(uploaded[id].properties))) {
                if (overwriteUploaded) {
                    latest[id].properties.name = uploaded[id].properties.name;
                    uploaded[id].properties = latest[id].properties;
                }
                outdatedFeatureRefs.push(id); 
                console.log("Tags differ...");
                console.log("Uploaded:");
                console.log(uploaded[id].properties);
                console.log("Latest:");
                console.log(latest[id].properties);
            }
        }
    }
    if (!moveDiffedToUploaded) {
        if (newFeaturesInState.length) fs.writeFileSync('./diffed/' + file, JSON.stringify({
            "type": "FeatureCollection",
            "features": newFeaturesInState
        }, null, 2));
    }
    if (overwriteUploaded) {
        fs.writeFileSync("./uploaded/" + file,  JSON.stringify({
            "type": "FeatureCollection",
            "features": Object.values(uploaded)
        }, null, 2));
    }
});

fs.writeFileSync('./diffed.geojson', JSON.stringify({
    "type": "FeatureCollection",
    "features": newFeatures
}, null, 2));

/*
[out:xml][timeout:25];
{{geocodeArea:Rhode Island}}->.searchArea;
(area.searchArea);
(._;>;); out meta;
*/

if (outdatedFeatureRefs.length) console.log('node["operator:short"="USGS"]["ref"~"^(' + outdatedFeatureRefs.join("|") + ')$"];')

if (overwriteUploaded) console.log("DID OVERWRITE UPLOADED");