import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, locHash, osmChangeXmlForFeatures, geoJsonForFeatures, scratchDir } from '../utils.js';

clearDirectory(scratchDir + 'usgs/diffed/');
clearDirectory(scratchDir + 'usgs/diffed/modified/bystate/');
clearDirectory(scratchDir + 'usgs/diffed/usgs_only/bystate/');
clearDirectory(scratchDir + 'usgs/diffed/osm_only/');

const conversionMap = JSON.parse(readFileSync(import.meta.dirname + '/data/monitoring_types.json'));

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

const webcamKeys = [
    'contact:webcam',
    'contact:webcam:1',
    'contact:webcam:2',
    'contact:webcam:3',
    'contact:webcam:4',
    'contact:webcam:5',
    'contact:webcam:6',
    'contact:webcam:7',
    'contact:webcam:8',
    'contact:webcam:9',
    'contact:webcam:10',
    'contact:webcam:11',
    'contact:webcam:12',
    'contact:webcam:13',
    'contact:webcam:14',
    'contact:webcam:15',
];

let keysToAddIfMissing = [...new Set(Object.values(conversionMap).map(obj => Object.keys(obj.tags)).flat())];
keysToAddIfMissing = keysToAddIfMissing.concat([
    'depth',
    'ele',
    'ele:accuracy',
    'ele:datum',
    'name',
    'official_name',
    'operator',
    'operator:type',
    'operator:short',
    'operator:wikidata',
    'ref',
    'shef:location_id',
    'start_date',
    'website',
    'website:1',
]);

const keysToOverride = ['official_name'];

const osm = JSON.parse(readFileSync(scratchDir + 'osm/usgs/all.json'));
const usgs = JSON.parse(readFileSync(scratchDir + 'usgs/formatted/all.geojson'));

let osmByRef = {};
let osmByLoc = {};
osm.elements.forEach(function(feature) {

    if (feature.tags.name && feature.tags.noname) console.log(`Both "name" and "noname" present on ${feature.id}`);
    if (feature.tags.noname && feature.tags.noname !== "yes") console.log(`Unexpected "noname" value ${feature.tags.noname} on ${feature.id}`);

    if (feature.tags.ref) {
        if (!(/^\d{8,15}$/.test(feature.tags.ref))) console.log(`Unexpected "ref" for ${feature.id}`);
        if (osmByRef[feature.tags.ref]) console.log(`Duplicate OSM elements for "ref=${feature.tags.ref}": ${osmByRef[feature.tags.ref].id} and ${feature.id}`);
        osmByRef[feature.tags.ref] = feature;
    } else {
        console.log(`Missing "ref" for https://openstreetmap.org/node/${feature.id}`);
    }

    let loc = locHash(feature);
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
let tagsDeleted = {};

let addedMissingTags = 0;
let overwroteIncorrectTags = 0;
let deletedTagCount = 0;

function tagDiff(before, after) {
    let returner = {
        added: [],
        modified: [],
        deleted: []
    };
    for (var key in before) {
        if (!after[key]) returner.deleted.push(key);
        else if (before[key] !== after[key]) returner.modified.push(key);
    }
    for (var key in after) {
        if (!before[key]) returner.added.push(key);
    }
    returner.total = [...returner.added, ...returner.modified, ...returner.deleted];
    return returner;
}

function cleanupWebcamValues(feature, nwisValues) {
    const beforeWebcamTags = {};
    webcamKeys.forEach(function(key) {
        if (feature.tags[key]) {
            beforeWebcamTags[key] = feature.tags[key];
            delete feature.tags[key];
        }
    });
    let cleanedValues = Object.values(beforeWebcamTags).filter(value => nwisValues.includes(value) || !value.startsWith('https://apps.usgs.gov/hivis/camera/'));
    cleanedValues = Array.from(new Set(cleanedValues.concat(nwisValues)));
    cleanedValues.forEach(value => addWebcamValue(feature, value));

    const afterWebcamTags = {};
    webcamKeys.forEach(function(key) {
        if (feature.tags[key]) afterWebcamTags[key] = feature.tags[key];
    });
    return tagDiff(beforeWebcamTags, afterWebcamTags);
}

function addWebcamValue(feature, value) {
    let osmWebcamValues = webcamKeys.map(key => feature.tags[key]).filter(val => val);
    let suffix = osmWebcamValues.length === 0 ? "" : ":" + osmWebcamValues.length;
    let targetKey = "contact:webcam" + suffix;
    feature.tags[targetKey] = value;
}

for (let ref in osmByRef) {
    let osmFeature = osmByRef[ref];
    let latest = usgsByRef[ref];
    if (latest) {
        let didUpdate = false;

        function processDiff(diff) {
            if (diff.total.length) {
                didUpdate = true;
                diff.added.forEach(key => tagsAdded[key] = true);
                diff.modified.forEach(key => tagsModified[key] = true);
                diff.deleted.forEach(key => tagsDeleted[key] = true);
                addedMissingTags += diff.added.length;
                overwroteIncorrectTags += diff.modified.length;
                deletedTagCount += diff.deleted.length;
            }
        }

        let nwisWebcamValues = webcamKeys.map(key => latest.properties[key]).filter(val => val);
        processDiff(cleanupWebcamValues(osmFeature, nwisWebcamValues));
        
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

        let loc = locHash(usgsFeature);
        if (osmByLoc[loc]) {
            console.log(`Offsetting coordinates to avoid overlapping nodes: ${ref}`);
            usgsFeature.geometry.coordinates[0] += 0.00001;
            loc = locHash(usgsFeature);
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

console.log('Modified, needs upload: ' + updated.length);
if (addedMissingTags > 0) console.log(`  Added ${addedMissingTags} tags: ` + Object.keys(tagsAdded).join(', '));
if (overwroteIncorrectTags > 0) console.log(`  Overwrote ${overwroteIncorrectTags} tags: ` + Object.keys(tagsModified).join(', '));
if (deletedTagCount > 0) console.log(`  Deleted ${deletedTagCount} tags: ` + Object.keys(tagsDeleted).join(', '));


for (let state in updatedByState) {
    writeFileSync(scratchDir + 'usgs/diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
    console.log("  " + state + ": " + updatedByState[state].length);
}
writeFileSync(scratchDir + 'usgs/diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

console.log('In USGS but not OSM, needs review and upload: ' + usgsOnlyFeatures.length);

for (let state in usgsOnlyByState) {
    writeFileSync(scratchDir + 'usgs/diffed/usgs_only/bystate/' + state + '.geojson', JSON.stringify(geoJsonForFeatures(usgsOnlyByState[state]), null, 2));
    console.log("  " + state + ": " + usgsOnlyByState[state].length);
}
writeFileSync(scratchDir + 'usgs/diffed/usgs_only/all.geojson', JSON.stringify(geoJsonForFeatures(usgsOnlyFeatures), null, 2));

writeFileSync(scratchDir + 'usgs/diffed/osm_only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('In OSM but not USGS, needs review: ' + osmOnlyFeatures.length);