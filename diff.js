import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'fs';

function clearDirectory(dir) {
    if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
clearDirectory('./diffed/');
clearDirectory('./diffed/modified/bystate/');
clearDirectory('./diffed/usgs_only/bystate/');
clearDirectory('./diffed/osm_only/');

const conversionMap = JSON.parse(readFileSync('./monitoring_type_metadata.json'));

const statesByRegion = {
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
        "MS", 'AL', "SC", "GA", "FL"
    ],
    "GreatLakes": [
        "IL", "IN", "OH", "MI", "WI"
    ],
    "NorthernPrairie": [
        "SD", "ND", "MN"
    ],
    "Central": [
        "NE", "IA", "KS", "MO"
    ],
    "CaliforniaNevada": [
        "CA", "NV"
    ]
};
const regionsByState = {};
for (let region in statesByRegion) {
    statesByRegion[region].forEach(state => {
        regionsByState[state] = region;
    });
}

let keysToAddIfMissing = [...new Set(Object.values(conversionMap).map(obj => Object.keys(obj.tags)).flat())];
keysToAddIfMissing = keysToAddIfMissing.concat([
    'ele',
    'ele:accuracy',
    'ele:datum',
    'contact:webcam',
    'contact:webcam:1',
    'contact:webcam:2',
    'contact:webcam:3',
    'contact:webcam:4',
    'contact:webcam:5',
    'contact:webcam:6',
    'contact:webcam:7',
    'start_date',
    'official_name',
    'operator',
    'operator:type',
    'operator:short',
    'operator:wikidata',
    'website',
    'ref',
    'name',
]);

let osm = JSON.parse(readFileSync('./osm/all.json'));
let usgs = JSON.parse(readFileSync('./usgs/formatted/all.geojson'));

let osmByRef = {};
let osmByLoc = {};
osm.elements.forEach(function(feature) {

    if (feature.tags.name && feature.tags.noname) console.log(`Both "name" and "noname" present on ${feature.id}`);
    if (feature.tags.noname && feature.tags.noname !== "yes") console.log(`Unexpected "noname" value ${feature.tags.noname} on ${feature.id}`);

    if (feature.tags.ref) {
        if (!(/^\d{1,15}$/.test(feature.tags.ref))) console.log(`Unexpected "ref" for ${feature.id}`);
        if (osmByRef[feature.tags.ref]) console.log(`Duplicate OSM elements for "ref=${feature.tags.ref}": ${osmByRef[feature.tags.ref].id} and ${feature.id}`);
        osmByRef[feature.tags.ref] = feature;
    } else {
        console.log(`Missing "ref" for ${feature.id}`);
    }

    let loc = feature.lon + "," + feature.lat;
    if (osmByLoc[loc]) console.log(`OSM elements have the same location: ${osmByLoc[loc].id} and ${feature.id}`);
    osmByLoc[loc] = feature;
});

let usgsByRef = {};
usgs.features.forEach(function(feature) {
    if (usgsByRef[feature.properties.ref]) console.log('Duplicate USGS elements for: ' + feature.tags.ref);
    usgsByRef[feature.properties.ref] = feature;
});

let updated = [];
let updatedByState = {};
let usgsOnlyByState = {};

let osmOnlyFeatures = [];
let usgsOnlyFeatures = [];

let tagsAdded = {};
let tagsModified = {};

let keysToOverride = ['official_name'];

let addedMissingTags = 0;
let overwroteIncorrectTags = 0;

for (let ref in osmByRef) {
    let osmFeature = osmByRef[ref];
    let latest = usgsByRef[ref];
    if (latest) {
        let didUpdate = false;
        for (let i in keysToAddIfMissing) {
            let key = keysToAddIfMissing[i];
            // some sites don't have a name so don't add one
            if (key === 'name' && osmFeature.tags.noname === 'yes') continue;
            if (latest.properties[key] && !osmFeature.tags[key]) {
                tagsAdded[key] = true;
                osmFeature.tags[key] = latest.properties[key];
                addedMissingTags += 1;
                didUpdate = true;
            }
        }
        for (let i in keysToOverride) {
            let key = keysToOverride[i];
            if (osmFeature.tags[key] && latest.properties[key] &&
                osmFeature.tags[key] !== latest.properties[key]) {
                console.log(`Replacing ${key} on ${osmFeature.tags.name}:\n-${osmFeature.tags[key]}\n+${latest.properties[key]}\n`);
                tagsModified[key] = true;
                osmFeature.tags[key] = latest.properties[key];
                overwroteIncorrectTags += 1;
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
        // ignore inactive features like `disused:man_made=monitoring_station`
        if (osmFeature.tags.man_made === 'monitoring_station') {
            osmOnlyFeatures.push(osmFeature);
        }
    }
}

for (let ref in usgsByRef) {
    let usgsFeature = usgsByRef[ref];
    if (!osmByRef[ref]) {

        let loc = usgsFeature.geometry.coordinates[0] + "," + usgsFeature.geometry.coordinates[1];
        if (osmByLoc[loc]) {
            console.log(`Offsetting coordinates to avoid overlapping nodes: ${ref}`);
            usgsFeature.geometry.coordinates[0] += 0.00001;
            loc = usgsFeature.geometry.coordinates[0] + "," + usgsFeature.geometry.coordinates[1];
        }
        osmByLoc[loc] = true;

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

console.log('Modified, needs upload: ' + updated.length);
if (addedMissingTags > 0) console.log(`  Added ${addedMissingTags} tags: ` + Object.keys(tagsAdded).join(', '));
if (overwroteIncorrectTags > 0) console.log(`  Overwrote ${overwroteIncorrectTags} tags: ` + Object.keys(tagsModified).join(', '));

for (let state in updatedByState) {
    writeFileSync('./diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
    console.log("  " + state + ": " + updatedByState[state].length);
}
writeFileSync('./diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

console.log('In USGS but not OSM, needs review and upload: ' + usgsOnlyFeatures.length);

for (let state in usgsOnlyByState) {
    writeFileSync('./diffed/usgs_only/bystate/' + state + '.geojson', JSON.stringify(geoJsonForFeature(usgsOnlyByState[state]), null, 2));
    console.log("  " + state + ": " + usgsOnlyByState[state].length);
}
writeFileSync('./diffed/usgs_only/all.geojson', JSON.stringify(geoJsonForFeature(usgsOnlyFeatures), null, 2));

writeFileSync('./diffed/osm_only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('In OSM but not USGS, needs review: ' + osmOnlyFeatures.length);