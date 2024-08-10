import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'fs';

const regions = {
    "Northeast": [
        'ME', 'NH', 'VT', 'CT', 'MA', 'RI', 'NY', 'NJ', 'PA', "NB", "QC"
    ],
    "MidAtlantic": [
        'DE', 'MD', 'DC', 'WV', 'VA', "NC", "KY", "TN",
    ],
    "FourCorners": [
        'CO', 'UT', 'NM', 'AZ',
    ],
    "PacificNorthwest": [
        'WA', 'OR',
    ],
    "NorthernRockies": [
        'ID', 'MT', 'WY'
    ],
    "SouthCentral": [
        'TX', 'OK', 'AR', 'LA'
    ],
    "Southeast": [
        "MS", 'AL', "SC", 
    ],
    "GreatLakes": [
        "IL", "IN", "OH", "MI", "WI"
    ],
    "NorthernPrairie": [
        "SD", "ND", "MN"
    ],
    "Central": [
        "NE", "IA", "KS", "MO"
    ]
};
const regionsByState = {};
for (let region in regions) {
    regions[region].forEach(state => {
        regionsByState[state] = region;
    });
}

const conversionMap = JSON.parse(readFileSync('./conversion_map.json'));

function clearDirectory(dir) {
    readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
}
clearDirectory('./diffed/');

mkdirSync('./diffed/modified/bystate/', { recursive: true });
mkdirSync('./diffed/usgs_only/bystate/', { recursive: true });
mkdirSync('./diffed/osm_only/', { recursive: true });

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
let usgsOnlyByState = {};

let osmOnlyFeatures = [];
let usgsOnlyFeatures = [];

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
            if (regionsByState[key]) key = regionsByState[key];
            if (!updatedByState[key]) updatedByState[key] = [];
            updatedByState[key].push(osmFeature);
            updated.push(osmFeature);
        }
    } else {
        osmOnlyFeatures.push(osmFeature);
    }
}

for (let ref in usgsByRef) {
    let usgsFeature = usgsByRef[ref];
    if (!osmByRef[ref]) {
        let key = usgsFeature.state ? usgsFeature.state : '_nostate';
        delete usgsFeature.state;
        if (regionsByState[key]) key = regionsByState[key];
        if (!usgsOnlyByState[key]) usgsOnlyByState[key] = [];
        usgsOnlyByState[key].push(usgsFeature);
        usgsOnlyFeatures.push(usgsFeature);
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

function geoJsonForFeature(features) {
    return {
        "type": "FeatureCollection",
        "features": features
    };
}

for (let state in updatedByState) {
    writeFileSync('./diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
}
writeFileSync('./diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

for (let state in usgsOnlyByState) {
    writeFileSync('./diffed/usgs_only/bystate/' + state + '.geojson', JSON.stringify(geoJsonForFeature(usgsOnlyByState[state]), null, 2));
}
writeFileSync('./diffed/usgs_only/all.geojson', JSON.stringify(geoJsonForFeature(usgsOnlyFeatures), null, 2));

writeFileSync('./diffed/osm_only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('Modified, needs upload: ' + updated.length);
console.log('In OSM but not USGS, needs review: ' + osmOnlyFeatures.length);
console.log('In USGS but not OSM, needs review and upload: ' + usgsOnlyFeatures.length);
