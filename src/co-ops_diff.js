import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, locHash, osmChangeXmlForFeatures, geoJsonForFeatures } from './utils.js';

clearDirectory('./scratch/co-ops/diffed/');
clearDirectory('./scratch/co-ops/diffed/modified/bystate/');
clearDirectory('./scratch/co-ops/diffed/co-ops_only/bystate/');
clearDirectory('./scratch/co-ops/diffed/osm_only/');

const osm = JSON.parse(readFileSync('./scratch/osm/co-ops/all.json'));
const coOps = JSON.parse(readFileSync('./scratch/co-ops/formatted/all.geojson'));

let keysToAddIfMissing = [
    'ele',
    'ele:datum',
    'name',
    'official_name',
    'operator',
    'operator:type',
    'operator:short',
    'operator:wikidata',
    "monitoring:air_gap",
    "monitoring:air_humidity",
    "monitoring:air_pressure",
    "monitoring:air_temperature",
    "monitoring:visibility",
    "monitoring:water_conductivity",
    "monitoring:water_level",
    "monitoring:water_temperature",
    "monitoring:wind_direction",
    "monitoring:wind_speed",
    'ref',
    'shef:location_id',
    'start_date',
    'tidal',
    'website',
    'website:1',
    'website:2',
];

let keysToOverride = [
    "official_name"
];

let osmByRef = {};
let osmByLoc = {};
osm.elements.forEach(function(feature) {

    if (feature.tags.name && feature.tags.noname) console.log(`Both "name" and "noname" present on ${feature.id}`);
    if (feature.tags.noname && feature.tags.noname !== "yes") console.log(`Unexpected "noname" value ${feature.tags.noname} on ${feature.id}`);

    if (feature.tags.ref) {
        //if (!(/^\d{8,15}$/.test(feature.tags.ref))) console.log(`Unexpected "ref" for ${feature.id}`);
        if (osmByRef[feature.tags.ref]) console.log(`Duplicate OSM elements for "ref=${feature.tags.ref}": ${osmByRef[feature.tags.ref].id} and ${feature.id}`);
        osmByRef[feature.tags.ref] = feature;
    } else {
        console.log(`Missing "ref" for https://openstreetmap.org/node/${feature.id}`);
    }

    let loc = locHash(feature);
    if (osmByLoc[loc]) console.log(`OSM elements have the same location: ${osmByLoc[loc].id} and ${feature.id}`);
    osmByLoc[loc] = feature;
});

let coOpsByRef = {};
coOps.features.forEach(function(feature) {
    if (coOpsByRef[feature.properties.ref]) console.log('Duplicate CO-OPS elements for: ' + feature.tags.ref);
    coOpsByRef[feature.properties.ref] = feature;
});

let updated = [];
let updatedByState = {};
let coOpsOnlyByState = {};

let osmOnlyFeatures = [];
let coOpsOnlyFeatures = [];

let tagsAdded = {};
let tagsModified = {};
let tagsDeleted = {};

let addedMissingTags = 0;
let overwroteIncorrectTags = 0;
let deletedTagCount = 0;

for (let ref in osmByRef) {
    let osmFeature = osmByRef[ref];
    let latest = coOpsByRef[ref];
    if (latest) {
        let didUpdate = false;
        
        for (let i in keysToAddIfMissing) {
            let key = keysToAddIfMissing[i];
            // some sites don't have a name so don't add one
            if (key === 'name' && osmFeature.tags.noname === 'yes') continue;
            // don't add both name and official_name if they're the same
            if (key === 'official_name' && latest.properties.name === latest.properties.official_name) continue;
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
            //if (regionsByState[key]) key = regionsByState[key];
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

for (let ref in coOpsByRef) {
    if (osmByRef[ref]) continue;
    let coOpsFeature = coOpsByRef[ref];
    // ignore diused and such
    if (!coOpsFeature.properties["man_made"] || coOpsFeature.properties.end_date) continue;
    
    let loc = locHash(coOpsFeature);
    if (osmByLoc[loc]) {
        console.log(`Offsetting coordinates to avoid overlapping nodes: ${ref}`);
        coOpsFeature.geometry.coordinates[0] += 0.00001;
        loc = locHash(coOpsFeature);
    }
    osmByLoc[loc] = true;

    let key = coOpsFeature.state ? coOpsFeature.state : '_nostate';
    if (coOpsFeature.properties.name === coOpsFeature.properties.official_name) delete coOpsFeature.properties.official_name;
    delete coOpsFeature.state;
    //if (regionsByState[key]) key = regionsByState[key];
    if (!coOpsOnlyByState[key]) coOpsOnlyByState[key] = [];
    coOpsOnlyByState[key].push(coOpsFeature);
    coOpsOnlyFeatures.push(coOpsFeature);
}

console.log('Modified, needs upload: ' + updated.length);
if (addedMissingTags > 0) console.log(`  Added ${addedMissingTags} tags: ` + Object.keys(tagsAdded).join(', '));
if (overwroteIncorrectTags > 0) console.log(`  Overwrote ${overwroteIncorrectTags} tags: ` + Object.keys(tagsModified).join(', '));
if (deletedTagCount > 0) console.log(`  Deleted ${deletedTagCount} tags: ` + Object.keys(tagsDeleted).join(', '));


for (let state in updatedByState) {
    writeFileSync('./scratch/co-ops/diffed/modified/bystate/' + state + '.osc', osmChangeXmlForFeatures(updatedByState[state]));
    console.log("  " + state + ": " + updatedByState[state].length);
}
writeFileSync('./scratch/co-ops/diffed/modified/all.osc', osmChangeXmlForFeatures(updated));

console.log('In CO-OPS but not OSM, needs review and upload: ' + coOpsOnlyFeatures.length);

for (let state in coOpsOnlyByState) {
    writeFileSync('./scratch/co-ops/diffed/co-ops_only/bystate/' + state + '.geojson', JSON.stringify(geoJsonForFeatures(coOpsOnlyByState[state]), null, 2));
    console.log("  " + state + ": " + coOpsOnlyByState[state].length);
}
writeFileSync('./scratch/co-ops/diffed/co-ops_only/all.geojson', JSON.stringify(geoJsonForFeatures(coOpsOnlyFeatures), null, 2));

writeFileSync('./scratch/co-ops/diffed/osm_only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('In OSM but not CO-OPS, needs review: ' + osmOnlyFeatures.length);