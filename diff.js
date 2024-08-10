import { readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';

const conversionMap = JSON.parse(readFileSync('./conversion_map.json'));

let keys = [...new Set(Object.values(conversionMap).map(obj => Object.keys(obj.tags)).flat())];
keys = keys.concat([
    'ele',
    'ele:accuracy',
    'ele:datum',
    'start_date',
]);

let osm = JSON.parse(readFileSync('./osm/all.json'));
let usgs = JSON.parse(readFileSync('./usgs/formatted/all.geojson'));

let osmByRef = {};
osm.elements.forEach(function(feature) {
    if (osmByRef[feature.tags.ref]) console.log('duplicate OSM elements for ' + feature.tags.ref);
    osmByRef[feature.tags.ref] = feature;
});

let usgsByRef = {};
usgs.features.forEach(function(feature) {
    if (usgsByRef[feature.properties.ref]) console.log('duplicate USGS elements for ' + feature.tags.ref);
    usgsByRef[feature.properties.ref] = feature;
});

let updated = [];
let updatedByState = {};

let osmOnlyFeatures = [];

for (let ref in osmByRef) {
    let osmFeature = osmByRef[ref];
    let latest = usgsByRef[ref];
    if (latest) {
        let didUpdate = false;
        for (let i in keys) {
            let key = keys[i];
            if (latest.properties[key] && !osmFeature.tags[key]) {
                osmFeature.tags[key] = latest.properties[key];
                didUpdate = true;
            }
        }
        if (didUpdate) {
            let key = latest.state ? latest.state : '_nostate';
            if (!updatedByState[key]) updatedByState[key] = [];
            updatedByState[key].push(osmFeature);
            updated.push(osmFeature);
        }
    } else {
        osmOnlyFeatures.push(osmFeature);
    }
}

function osmChangeXmlForFeatures(features) {
    function xmlForFeature(feature) {
        let xml = `<node id="${feature.id}" version="${feature.version}" lat="${feature.lat}" lon="${feature.lon}">\n`;
        for (let key in feature.tags) {
            xml += `<tag k="${key}" v="${feature.tags[key].replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')}"/>\n`;
        }
        xml += '</node>\n';
        return xml;
    }
    
    let xml = `<osmChange version="0.6">\n<modify>\n`;
    features.forEach(function(feature) {
        xml += xmlForFeature(feature);
    });
    xml += `</modify>\n</osmChange>\n`;
    return xml;
}

writeFileSync('./diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

function clearDirectory(dir) {
    readdirSync(dir).forEach(f => rmSync(`${dir}/${f}`));
}

clearDirectory('./diffed/modified/bystate/');
for (let state in updatedByState) {
    writeFileSync('./diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
}

writeFileSync('./diffed/osm-only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('Modified, needs upload: ' + updated.length);
console.log('In OSM, not in USGS, needs review: ' + osmOnlyFeatures.length);
