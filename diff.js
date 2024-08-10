const fs = require('fs');

let keys = [
    'monitoring:precipitation',
    'monitoring:water_level',
    'monitoring:flow_rate',
    'monitoring:water_velocity',
    'monitoring:air_temperature',
    'monitoring:air_humidity',
    'monitoring:air_pressure',
    'monitoring:water_temperature',
    'monitoring:water_conductivity',
    'monitoring:water_turbidity',
    'monitoring:dissolved_oxygen',
    'monitoring:tide_gauge',
    'monitoring:salinity',
    'monitoring:pH',
    'monitoring:wind_direction',
    'monitoring:wind_speed',
    'start_date',
    'ele',
    'ele:accuracy',
    'ele:datum',
    'tidal'
];

let osm = JSON.parse(fs.readFileSync('./osm/downloaded.json'));
let usgs = JSON.parse(fs.readFileSync('./usgs/formatted/all.geojson'));

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
        var xml = `<node id="${feature.id}" version="${feature.version}" lat="${feature.lat}" lon="${feature.lon}">\n`;
        for (var key in feature.tags) {
            xml += `<tag k="${key}" v="${feature.tags[key].replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')}"/>\n`;
        }
        xml += '</node>\n';
        return xml;
    }
    
    var xml = `<osmChange version="0.6">\n<modify>\n`;
    features.forEach(function(feature) {
        xml += xmlForFeature(feature);
    });
    xml += `</modify>\n</osmChange>\n`;
    return xml;
}

fs.writeFileSync('./diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

function clearDirectory(dir) {
    fs.readdirSync(dir).forEach(f => fs.rmSync(`${dir}/${f}`));
}

clearDirectory('./diffed/modified/bystate/');
for (var state in updatedByState) {
    fs.writeFileSync('./diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
}

fs.writeFileSync('./diffed/osm-only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('Modified, needs upload: ' + updated.length);
console.log('In OSM, not in USGS, needs review: ' + osmOnlyFeatures.length);
