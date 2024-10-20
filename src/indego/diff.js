import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, locHash, osmChangeXmlForFeatures, geoJsonForFeatures, scratchDir } from '../utils.js';

clearDirectory(scratchDir + 'indego/diffed/');
clearDirectory(scratchDir + 'indego/diffed/modified/');
clearDirectory(scratchDir + 'indego/diffed/indego_only/');
clearDirectory(scratchDir + 'indego/diffed/osm_only/');

const osmJson = JSON.parse(readFileSync(scratchDir + 'osm/indego/all.json'));
const authFeatureCollection = JSON.parse(readFileSync(scratchDir + 'indego/formatted/all.geojson'));

let osmByRef = {};
let osmByLoc = {};
osmJson.elements.forEach(function(feature) {

    if (feature.tags.name && feature.tags.noname) console.log(`Both "name" and "noname" present on ${feature.id}`);
    if (feature.tags.noname && feature.tags.noname !== "yes") console.log(`Unexpected "noname" value ${feature.tags.noname} on ${feature.id}`);

    if (feature.tags.ref) {
        if (osmByRef[feature.tags.ref]) console.log(`Duplicate OSM elements for "ref=${feature.tags.ref}": ${osmByRef[feature.tags.ref].id} and ${feature.id}`);
        osmByRef[feature.tags.ref] = feature;
    } else {
        console.log(`Missing "ref" for https://openstreetmap.org/Feature/${feature.id}`);
    }

    let loc = locHash(feature);
    if (osmByLoc[loc]) console.log(`OSM elements have the same location: ${osmByLoc[loc].id} and ${feature.id}`);
    osmByLoc[loc] = feature;
});

let authFeaturesByRef = {};
authFeatureCollection.features.forEach(function(feature) {
    if (authFeaturesByRef[feature.properties.ref]) console.log('Duplicate indego elements for: ' + feature.tags.ref);
    authFeaturesByRef[feature.properties.ref] = feature;
});

let updated = [];

let osmOnlyFeatures = [];
let authOnlyFeatures = [];

let tagsAdded = {};
let tagsModified = {};
let tagsDeleted = {};

let addedMissingTags = 0;
let overwroteIncorrectTags = 0;
let deletedTagCount = 0;

for (let ref in osmByRef) {
    let osmFeature = osmByRef[ref];
    let authFeature = authFeaturesByRef[ref];
    if (authFeature) {
        let didUpdate = false;

        let authTags = authFeature.properties;
        for (let key in authTags) {
            if (osmFeature.tags[key]) {
                if (osmFeature.tags[key] !== authFeature.properties[key]) {
                    console.log(`Replacing ${key} on ${osmFeature.tags.name}:\n-${osmFeature.tags[key]}\n+${authFeature.properties[key]}\n`);
                    tagsModified[key] = true;
                    osmFeature.tags[key] = authFeature.properties[key];
                    overwroteIncorrectTags += 1;
                    didUpdate = true;
                }
            } else {
                tagsAdded[key] = true;
                osmFeature.tags[key] = authFeature.properties[key];
                addedMissingTags += 1;
                didUpdate = true;
            }
        }
        if (didUpdate) {
            updated.push(osmFeature);
        }
    } else {
        osmOnlyFeatures.push(osmFeature);
    }
}

for (let ref in authFeaturesByRef) {
    if (osmByRef[ref]) continue;
    let authFeature = authFeaturesByRef[ref];
    //if (authFeature.properties.name === authFeature.properties.official_name) delete authFeature.properties.official_name;
    authOnlyFeatures.push(authFeature);
}

console.log('Modified, needs upload: ' + updated.length);
if (addedMissingTags > 0) console.log(`  Added ${addedMissingTags} tags: ` + Object.keys(tagsAdded).join(', '));
if (overwroteIncorrectTags > 0) console.log(`  Overwrote ${overwroteIncorrectTags} tags: ` + Object.keys(tagsModified).join(', '));
if (deletedTagCount > 0) console.log(`  Deleted ${deletedTagCount} tags: ` + Object.keys(tagsDeleted).join(', '));

writeFileSync(scratchDir + 'indego/diffed/modified/all.osc', osmChangeXmlForFeatures(updated));
console.log('In indego but not OSM, needs review and upload: ' + authOnlyFeatures.length);

writeFileSync(scratchDir + 'indego/diffed/indego_only/all.geojson', JSON.stringify(geoJsonForFeatures(authOnlyFeatures), null, 2));
writeFileSync(scratchDir + 'indego/diffed/osm_only/all.json', JSON.stringify(osmOnlyFeatures, null, 2));

console.log('In OSM but not indego, needs review: ' + osmOnlyFeatures.length);