
const csv = require('csv-parse/sync');
const fs = require('fs');

let tagsPerFile = {
    'precipitation': {
        'monitoring:precipitation': 'yes'
    },
    'gage-height-ft': {
        'monitoring:water_level': 'yes'
    },
    'lake-reservoir-elevation': {
        'monitoring:water_level': 'yes'
    },
    'streamflow-cuft-s': {
        'monitoring:flow_rate': 'yes'
    },
    'water-velocity-ft-s': {
        'monitoring:water_velocity': 'yes'
    },
    'air-temp': {
        'monitoring:air_temperature': 'yes'
    },
    'relative-humidity': {
        'monitoring:air_humidity': 'yes'
    },
    'barometric-pressure': {
        'monitoring:air_pressure': 'yes'
    },
    'water-temp': {
        'monitoring:water_temperature': 'yes'
    },
    'discharge-tidally-filtered': {
        'tidal': 'yes'
    },
    'tide-discharge': {
        'tidal': 'yes'
    },
    'tidal-elevation': {
        'tidal': 'yes',
        'monitoring:water_level': 'yes',
        'monitoring:tide_gauge': 'yes'
    },
    'dissolved-o2-mg-l': {
        'monitoring:dissolved_oxygen': 'yes'
    },
    'dissolved-o2-percent-saturation': {
        'monitoring:dissolved_oxygen': 'yes'
    },
    'salinity': {
        'monitoring:salinity': 'yes'
    },
    'water-ph-unfiltered': {
        'monitoring:pH': 'yes'
    },
    'wind-direction': {
        'monitoring:wind_direction': 'yes'
    },
    'wind-speed': {
        'monitoring:wind_speed': 'yes'
    }
};

const csvOpts = {columns: true, delimiter: '\t'};
const array = csv.parse(fs.readFileSync('./csv/all'), csvOpts);

const allItems = {};
array.forEach(item => {
    allItems[item.site_no] = item;
});

let excludeTypes = [
    'Well',
   // 'Atmosphere',
    'Field, Pasture, Orchard, or Nursery',
    'Land',
    'Multiple wells',
  //  'Sinkhole',
    'Extensometer well',
    'Test hole not completed as a well',
    'Collector or Ranney type well',
    'Soil hole',
    'Laboratory or sample-preparation area',
    'Subsurface',
    //'Water-distribution system',
    'Unsaturated zone',
    'Agric area',
  //  'Wastewater-treatment plant'
]

const geoJson = JSON.parse(fs.readFileSync('./locations.geojson'));
let geoJsonFeaturesById = {};
let types = {};
for (var i in geoJson.features) {
    var feature = geoJson.features[i];
    var id = feature.properties['properties/monitoringLocationNumber'];
    var type = feature.properties['properties/monitoringLocationType'];
    types[type] = true;
    geoJsonFeaturesById[id] = feature;
}
for (var id in allItems) {
    var feature = geoJsonFeaturesById[id];
    if (feature && excludeTypes.includes(feature.properties['properties/monitoringLocationType'])) {
        delete allItems[id];
    }
}

let builtItems = {};

for (var filename in tagsPerFile) {
    let array = csv.parse(fs.readFileSync('./csv/' + filename), csvOpts);
    array.forEach(item => {
        if (allItems[item.site_no]) {
            if (!builtItems[item.site_no]) {
                builtItems[item.site_no] = Object.assign({}, allItems[item.site_no]);
                builtItems[item.site_no].tags = {};
            }
            
            Object.assign(builtItems[item.site_no].tags, tagsPerFile[filename]);
        }
    });
}

function toTitleCase(str) {
    return str.replace(
      /\b\D+?\b/g,
      function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      }
    );
  }

function cleanName(name) {
    name = name.replace(/\s+/gi, ' ').trim();

    let states = [ 'AL', 'AK', 'AS', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FM', 'FL', 'FLA', 'GA', 'GU', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MH', 'MD', 'MA', 'MASS', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'neb', 'Nebr', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'MP', 'OH', 'OK', 'OR', 'PW', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VI', 'VA', 'WA', 'WV', 'WI', 'WY',
        'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
    for (var i in states) {
        var st = states[i];
        let proc = name.replace(new RegExp('(,|\\s+|,\\s+)'+st+'.?$', "gi"), '');
        if (proc != name) {
            name = proc;
            break; // don't double dip
        }
    }


    ['USGS', 'US', 'LNVA', 'GIWW', 'IWW', 'AIWW', 'CWA'].forEach(function(abbr) {
        name = name.replace(new RegExp('\\b'+abbr+'\\b', "gi"), abbr);
    });

    // Avoid yelling
    if (name.toUpperCase() === name) name = toTitleCase(name);

    name = name.replace(/ @ /gi, ' at ');
    name = name.replace(/ @/gi, ' at ');

    name = name.replace(/, near /gi, ' near ');
    name = name.replace(/, at /gi, ' at ');

    name = name
        .split(" ")
        .map(function(word) {
            if (word.match(/^\d+(ST|ND|RD|TH)$/gi)) return word.toLowerCase();
            return word;
        })
        .join(" ");

    function replace(target, replacement) {
        name = name.replace(new RegExp('(?:^)' + target + '(?:$)', "gi"), replacement);
        name = name.replace(new RegExp('(?: )' + target + '(?: )', "gi"), " " + replacement + " ");
        name = name.replace(new RegExp('(?:^)' + target + '(?: )', "gi"), replacement+ " ");
        name = name.replace(new RegExp('(?: )' + target + '(?:$)', "gi"), " " + replacement);
    }

    replace("Riv\\.", 'River');
    replace("Riv", 'River');
    replace("Rv\\.", 'River');
    replace("Rv", 'River');
    replace("Rvr\\.", 'River');
    replace("Rvr", 'River');
    replace("R\\.", 'River');
    replace("R", 'River');
    replace("Ft\\.", 'Fort');
    replace("Ft", 'Fort');
    replace("Phila\\.", 'Philadelphia');
    replace("Phila", 'Philadelphia');
    replace("Miami f", 'Miami');
    replace("Ndow", 'Nevada Department of Wildlife');
    replace("Gsl", 'Great Salt Lake');
    replace("BBNP", 'Big Bend National Park');
    replace("Big Bnd NP", 'Big Bend National Park');
    replace("RMNP", 'Rocky Mountain National Park');
    replace("Vale-Rmnp", 'Vale-Rocky Mountain National Park');
    replace("Lsvl", 'Louisville');
    replace("Hwy", 'Highway');
    replace("Rte", 'Route');
    replace("Rt", 'Route');
    replace("Met", 'Meteorologic');
    replace("HOSP", 'Hot Springs');
    replace("N\\.P\\.", 'National Park');
    replace("Stn", 'Station');
    replace("Sta", 'Station');
    replace("Jct", 'Junction');
    replace("YNP", 'Yellowstone National Park');
    replace("Above", 'above');
    replace("Blvd", 'Boulevard');
    replace("Blvd\\.", 'Boulevard');
    replace("Abv", 'above');
    replace("Ab", 'above');
    replace("Winter P", 'Winter Park');
    replace("Nat Mon", 'National Monument');
    replace("Confl", 'Confluence');
    replace("Precip", 'Precipitation');
    replace("ds", 'downstream');
    replace("US of", 'upstream of');
    replace("Us", 'US');
    replace("Lk", 'Lake');
    replace("Colo", 'Colorado');
    replace("Lv", 'Las Vegas');
    replace("Mtn", 'Mountain');
    replace("Ark", 'Arkansas');
    replace("Amer", 'American');
    replace("Nr", 'near');
    replace("Near", 'near');
    replace("At", 'at');
    replace("Of", 'of');
    replace("On", 'on');
    replace("The", 'the');
    replace("And", 'and');
    replace("In", 'in');
    replace("From", 'from');
    replace("Av\\.", 'Avenue');
    replace("Av", 'Avenue');
    replace("Ave\\.", 'Avenue');
    replace("Ave", 'Avenue');
    replace("Pt\\.", 'Point');
    replace("Pt", 'Point');
    replace("Ushwy", 'US Highway');
    replace("Res", 'Reservoir');
    replace("C", 'Creek');
    replace("Cr", 'Creek');
    replace("Vly", 'Valley');
    replace("Ck", 'Creek');
    replace("Crk", 'Creek');
    replace("Str", 'Stream');
    replace("Cnty", 'County');
    replace("Below", 'below');
    replace("Blw", 'below');
    replace("Bl", 'below');
    replace("Brk", 'Brook');
    replace("Bk", 'Brook');
    replace("Rr", 'Railroad');
    replace("Intl", 'International');
    replace("Bndry", 'Boundary');
    replace("Trib", 'Tributary');
    replace("Del", 'Delaware');
    replace("Rar", 'Raritan');
    replace("Bdg", 'Bridge');
    replace("Brdg", 'Bridge');
    replace("Isla", 'Island');
    replace("Spg", 'Spring');
    replace("Spr", 'Spring');
    replace("Sp", 'Spring');
    replace("Spgs", 'Springs');
    replace("Cynlnds", 'Canyonlands');
    replace("Ntl", 'National');
    replace("int'l", 'International');
    replace("boundary", 'Boundary');
    replace("M Br", 'Middle Branch');
    replace("Br", 'Branch');
    replace("Mf", 'Middle Fork');
    replace("Mfk", 'Middle Fork');
    replace("Fk", 'Fork');
    replace("Wf", 'West Fork');
    replace("Wfk", 'West Fork');
    replace("Nf", 'North Fork');
    replace("Nfk", 'North Fork');
    replace("Sf", 'South Fork');
    replace("Sfk", 'South Fork');
    replace("Ef", 'East Fork');
    replace("Efk", 'East Fork');
    replace("Wd", 'Water District');
    replace("Rd", 'Road');
    replace("Rd,", 'Road,');
    replace("Rd\\.", 'Road');
    replace("Ln", 'Lane');
    //replace("La", 'Lane');
    replace("N", 'North');
    replace("S", 'South');
    replace("E", 'East');
    replace("W", 'West');
    replace("N\\.", 'North');
    replace("S\\.", 'South');
    replace("E\\.", 'East');
    replace("W\\.", 'West');
    replace("Ne", 'Northeast');
    replace("Se", 'Southeast');
    replace("Nw", 'Northwest');
    replace("Sw", 'Southwest');
    replace("Dtch", 'Ditch');
    replace("Bch", 'Beach');
    replace("Ca", 'Canal');
    replace("Cyn", 'Canyon');
    replace("L Arkansas", 'Little Arkansas');
    replace("L Currant", 'Little Currant');
    replace("L Walker", 'Little Walker');
    replace("L Humboldt", 'Little Humboldt');
    replace("Winnisook L", 'Winnisook Lake');
    replace("L Pine", 'Little Pine');
    replace("L\\. Fountain", 'Little Fountain');
    replace("L Pax", 'Little Pax');
    replace("L Nescopeck", 'Little Nescopeck');
    replace("L Back", 'Little Back');
    replace("L Wind", 'Little Wind');
    replace("Res", 'Reservoir');
    replace("L Medicine", 'Little Medicine');
    replace("L Blue", 'Little Blue');
    replace("L Bull", 'Little Bull');
    replace("L Osage", 'Little Osage');
    replace("Ll", 'Lake');
    replace("L\\. Cataouatche", 'Lake Cataouatche');
    replace("L Pontchartrain", 'Lake Pontchartrain');
    replace("NWR", 'National Wildlife Refuge');
    replace("Cnl", 'Canal');
    replace("Byu", 'Bayou');
    replace("Usgs", 'USGS');
    replace("Medux\\.", 'Meduxnekeag');
    replace("Slc", 'Salt Lake City');
    replace("LAnguille", "L'Anguille");
    replace("S\\.Br\\.Tenmile", "South Branch Tenmile");
    replace("Tenth St\\. Br\\.", "Tenth Street Bridge");
    replace("Jefferson Davis Br", "Jefferson Davis Bridge");
    replace("South Br\\.", "South Branch");
    replace("Town Br\\.", "Town Branch");
    replace("Nra", "National Recreation Area");
    replace("Hq", "Headquarters");

    return name;
}

let features = [];
let featuresByState = {};
Object.values(builtItems).forEach(item => {
    if (!item.dec_lat_va || !item.dec_long_va) return;

    //console.log(item.site_no + ' | ' + cleanName(item.station_nm));

    let rawGeoJsonFeature = geoJsonFeaturesById[item.site_no]?.properties;

    if (rawGeoJsonFeature && ['Tidal stream', 'Ocean', 'Coastal', 'Estuary'].includes(rawGeoJsonFeature['properties/monitoringLocationType'])) {
        // assume tidal if certain types
        item.tags.tidal = 'yes';
    }
    // assume water level monitor is a tide gauge if tidal 
    if (item.tags.tidal === 'yes' && item.tags['monitoring:water_level']) item.tags['monitoring:tide_gauge'] = 'yes';

    let jsonFeature = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [
                parseFloat(item.dec_long_va),
                parseFloat(item.dec_lat_va)
            ]
        },
        properties: {
            name: cleanName(item.station_nm),
            official_name: item.station_nm,
            ref: item.site_no,
            "website": "https://waterdata.usgs.gov/monitoring-location/" + item.site_no,
            "man_made": "monitoring_station",
            ...item.tags,
            "operator": "United States Geological Survey",
            "operator:short": "USGS",
            "operator:type": "government",
            "operator:wikidata": "Q193755",
        }
    };
    var state = rawGeoJsonFeature ? rawGeoJsonFeature['properties/stateCode'] : item.basin_cd.substr(0, 2).toUpperCase();
    if (!featuresByState[state]) featuresByState[state] = [];
    featuresByState[state].push(jsonFeature);
    features.push(jsonFeature);
});
for (var state in featuresByState) {
    var locs = {};
    featuresByState[state].forEach(function(feature) {
        var loc = feature.geometry.coordinates.toString();
        while (locs[loc]) {
            // offset loc slightly if the same as another feature
            feature.geometry.coordinates[0] += 0.00001;
            loc = feature.geometry.coordinates.toString();
        }
        locs[loc] = true;
    });
    fs.writeFileSync('./bystate/' + state + '.geojson', JSON.stringify({
        type: "FeatureCollection",
        features: featuresByState[state]
    }, null, 2));
}
console.log(features.length);
fs.writeFileSync('./output-all.geojson', JSON.stringify({
    type: "FeatureCollection",
    features: features
}, null, 2));