import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs';

var ignoreKeys = ['name', 'fixme'];

const overwriteUploaded = false;
const moveDiffedToUploaded = false;

function indexedFeatures(features) {
    var out = {};
    features.forEach(function(feature) {
        out[feature.properties.ref] = feature;
    });
    return out;
}

function cleanedProps(obj) {
    var out = Object.assign({}, obj);
    ignoreKeys.forEach(function(key) {
        delete out[key];
    });
    return out;
}

const isIdenticalShallow = (obj1, obj2) =>
    Object.keys(obj1).length === Object.keys(obj2).length &&
    Object.keys(obj1).every(key => 
      obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
    );

var newFeatures = [];
var outdatedFeatureRefs = [];

readdirSync("./usgs/reviewed/").forEach(file => {

    var newFeaturesInState = [];

    var uploaded = indexedFeatures(JSON.parse(readFileSync("./usgs/reviewed/" + file)).features);
    var diffed = existsSync("./diffed/" + file) ? indexedFeatures(JSON.parse(readFileSync("./diffed/" + file)).features) : {};
    var latest = indexedFeatures(JSON.parse(readFileSync("./usgs/formatted/bystate/" + file)).features);

    if (moveDiffedToUploaded) {
        Object.assign(uploaded, diffed)
    }

    for (var id in latest) {
        if (!uploaded[id]) {
            newFeaturesInState.push(latest[id]);
            newFeatures.push(latest[id]);
            console.log(file.substring(0, 2) + ' ' + id + " – not uploaded");
        } else {
            if (!isIdenticalShallow(cleanedProps(latest[id].properties), cleanedProps(uploaded[id].properties))) {
                if (overwriteUploaded) {
                    ignoreKeys.forEach(function(key) {
                        latest[id].properties[key] = uploaded[id].properties[key];
                    });
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
        if (newFeaturesInState.length) writeFileSync('./diffed/bystate/' + file, JSON.stringify({
            "type": "FeatureCollection",
            "features": newFeaturesInState
        }, null, 2));
    }
    if (overwriteUploaded) {
        writeFileSync("./uploaded/" + file,  JSON.stringify({
            "type": "FeatureCollection",
            "features": Object.values(uploaded)
        }, null, 2));
    }
});

writeFileSync('./diffed/all.geojson', JSON.stringify({
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