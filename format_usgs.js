import { parse as parseCsv } from 'csv-parse/sync';
import { existsSync, readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync, promises } from 'fs';

function clearDirectory(dir) {
    if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
clearDirectory('./usgs/formatted/');
clearDirectory('./usgs/formatted/bystate/');

console.log('Loading cameras…');
const cameras = JSON.parse(readFileSync('./usgs/cameras/all.json'));
const camerasByRef = {};
cameras.forEach(camera => {
    let ref = camera.nwisId;
    if (ref && camera.camId && !camera.hideCam) {
        if (!camerasByRef[ref]) camerasByRef[ref] = [];
        camerasByRef[ref].push(camera);
    }
});

const conversionMap = JSON.parse(readFileSync('./monitoring_type_metadata.json'));

const csvOpts = {columns: true, delimiter: '\t', relax_quotes: true};

const siteStateByRef = {};

console.log('Loading state codes…');
async function loadSiteStatesByRef() {
    const allBystatePath = './usgs/nwis/all/bystate/';
    const dir = await promises.opendir(allBystatePath)
    const allPromises = [];
    for await (const dirent of dir) {
        let state = dirent.name.slice(0, 2);
        allPromises.push(promises.readFile(allBystatePath + dirent.name).then(value => {
            parseCsv(value, csvOpts).forEach(item => {
                siteStateByRef[item.site_no] = state;
            });
            console.log(dirent.name);
        }));
    }
    await Promise.all(allPromises);
}
await loadSiteStatesByRef();
console.log(Object.keys(siteStateByRef).length);

console.log('Loading all current sites…');
const allCurrentItems = {};
parseCsv(readFileSync('./usgs/nwis/current/all.csv'), csvOpts).forEach(item => {
    // ignore groundwater sites for now
    if (item.site_tp_cd.startsWith('GW')) return;
    allCurrentItems[item.site_no] = item;
});

const builtItems = {};

for (let filename in conversionMap) {
    parseCsv(readFileSync('./usgs/nwis/current/' + filename + '.csv'), csvOpts).forEach(item => {
        if (allCurrentItems[item.site_no]) {
            if (!builtItems[item.site_no]) {
                builtItems[item.site_no] = Object.assign({}, allCurrentItems[item.site_no]);
                builtItems[item.site_no].tags = {};
            }
            Object.assign(builtItems[item.site_no].tags, conversionMap[filename].tags);
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

// "Guam" is used in site names there instead of GU
const stateCodes = ['Guam', 'AL', 'AK', 'AS', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FM', 'FL', 'GA', 'GU', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MH', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'MP', 'OH', 'OK', 'OR', 'PW', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VI', 'VA', 'WA', 'WV', 'WI', 'WY', 'MB', 'SK', 'BC', 'AB', 'QC', 'ON', 'NB', 'YT'];
const states = stateCodes.concat([ 'FLA', 'MASS', 'neb', 'Nebr', 'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']);

function cleanName(name) {
    name = name.replace(/\s+/gi, ' ').trim();

    for (let i in states) {
        let st = states[i];
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
    // often feet instead
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
    replace("&", 'and');
    replace("Met", 'Meteorological');
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
    replace("Precip Station", 'Precipitation Station');
    replace("Precip Site", 'Precipitation Site');
    replace("Precip Gage", 'Precipitation Gage');
    replace("Precip", 'Precipitation Gage');
    replace("Precipitation at", 'Precipitation Gage at');
    replace("ds", 'downstream');
    replace("US of", 'upstream of');
    replace("Us", 'US');
    replace("Lk", 'Lake');
    replace("Colo", 'Colorado');
    replace("Lv", 'Las Vegas');
    replace("Mtn", 'Mountain');
    replace("Mtns", 'Mountains');
    replace("Ark", 'Arkansas');
    replace("Amer", 'American');
    replace("Nr", 'near');
    replace("Nr\\.", 'near');
    replace("Near", 'near');
    replace("At", 'at');
    replace("To", 'to');
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
    replace("Ushwy", 'U.S. Route');
    replace("US Highway", 'U.S. Route');
    replace("Res", 'Reservoir');
    replace("C", 'Creek');
    replace("Cr", 'Creek');
    replace("Cr\\.", 'Creek');
    replace("Vly", 'Valley');
    replace("Ck", 'Creek');
    replace("Crk", 'Creek');
    replace("Str", 'Stream');
    replace("Cnty", 'County');
    replace("WMA", 'Wildlife Management Area');
    replace("HW", 'Headwater');
    replace("TW", 'Tailwater');
    replace("HW/TW", 'Headwater/Tailwater');
    replace("Pkwy", 'Parkway');
    replace("Along", 'along');
    replace("Below", 'below');
    replace("Blw", 'below');
    replace("Bl", 'below');
    replace("Brk", 'Brook');
    replace("Bk", 'Brook');
    replace("Rr", 'Railroad');
    replace("Intl", 'International');
    replace("Bndry", 'Boundary');
    replace("Trib", 'Tributary');
    //replace("Del", 'Delaware');
    replace("Rar", 'Raritan');
    replace("Brd", 'Bridge');
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
    replace("Mdl", 'Middle');
    replace("M Br", 'Middle Branch');
    replace("Wwtp", 'Wastewater Treatment Plant');
    replace("Ww", 'Wastewater');
    replace("Lwr", 'Lower');
    //replace("Br", 'Branch');
    replace("SB", 'South Branch');
    replace("NB", 'North Branch');
    replace("EB", 'East Branch');
    replace("WB", 'West Branch');
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
    replace("weather station", 'Weather Station');
    replace("rain gage", 'Rain Gage');
    replace("Raingage", 'Rain Gage');
    replace("heated", 'Heated');
    replace("unheated", 'Unheated');
    replace("Ctrl", 'Control');
    replace("Dr", 'Drive');
    replace("Dr\\.", 'Drive');
    replace("Rd", 'Road');
    replace("Rd,", 'Road,');
    replace("Rd\\.", 'Road');
    replace("Ln", 'Lane');
    //replace("La", 'Lane');
    replace("N F", 'North Fork');
    replace("M F", 'Middle Fork');
    replace("S F", 'South Fork');
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
    replace("Upstream of", 'upstream of');
    replace("Downstream of", 'downstream of');
    replace("North of", 'north of');
    replace("South of", 'south of');
    replace("East of", 'east of');
    replace("West of", 'west of');
    replace("Northeast of", 'northeast of');
    replace("Southeast of", 'southeast of');
    replace("Northwest of", 'northwest of');
    replace("Southwest of", 'southwest of');
    replace("Dtch", 'Ditch');
    replace("Dch", 'Ditch');
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
    replace("No.", 'Number');
    replace("`", "'");
    replace("L&D", 'Lock and Dam');
    replace("L & D", 'Lock and Dam');
    replace("Lock & Dam", 'Lock and Dam');
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
    replace("River A", "River at");
    replace("Creek A", "Creek at");
    replace("Gage A", "Gage at");
    replace("Canal A", "Canal at");
    replace("Channel A", "Channel at");
    replace("Outlet A", "Outlet at");
    replace("Wash A", "Wash at");

    return name;
}

function formattedDate(input) {
    switch (input.length) {
        case 4:
            return input;
        case 6:
            return input.substring(0, 4) + '-' + input.substring(4, 6);
        case 8:
            return input.substring(0, 4) + '-' + input.substring(4, 6) + '-' + input.substring(6, 8);
        default:
            console.log(input);
            process.exit(1);
    }
}

console.log('Building GeoJSON features…');

let features = [];
let featuresByState = {};
Object.values(builtItems).forEach(item => {
    if (!item.dec_lat_va || !item.dec_long_va) return;

    let cameras = camerasByRef[item.site_no];
    if (cameras) {
        for (let i in cameras) {
            let camera = cameras[i];
            let suffix = i > 1 ? `:${i-1}` : '';
            item.tags[`contact:webcam${suffix}`] = 'https://apps.usgs.gov/hivis/camera/' + camera.camId
        }
    }

    if (['ST-TS', 'OC', 'OC-CO', 'ES'].includes(item.site_tp_cd)) {
        // assume tidal if certain types
        item.tags.tidal = 'yes';
    }
    // assume water level monitor is a tide gauge if tidal 
    if (item.tags.tidal === 'yes' && item.tags['monitoring:water_level']) item.tags['monitoring:tide_gauge'] = 'yes';

    if (item.alt_va && ['NAVD88', 'NGVD29', 'LMSL', 'COE1912', "PRVD02", "IGLD"].includes(item.alt_datum_cd)) {
        let eleFeet = parseFloat(item.alt_va.trim());
        let accuracyFeet = parseFloat(item.alt_acy_va.trim());
        // USGS sometimes has altitude set to 0 ft for random inland sites, so don't trust it unless the site it tidal
        if ((eleFeet || (eleFeet === 0 && item.tags.tidal === 'yes')) &&
            !isNaN(eleFeet) && eleFeet < 20000 && eleFeet > -280 &&
            (accuracyFeet || accuracyFeet === 0) &&
            !isNaN(accuracyFeet) && accuracyFeet < 200 && accuracyFeet >= 0) {

            item.tags.ele = (Math.round(eleFeet*0.3048*1000)/1000).toString();
            item.tags["ele:accuracy"] = (Math.round(accuracyFeet*0.3048*10000)/10000).toString();
            item.tags["ele:datum"] = item.alt_datum_cd;
        }
    }

    let constructionDate = item.construction_dt?.length ? formattedDate(item.construction_dt) : null;
    let inventoryDate = item.inventory_dt?.length ? formattedDate(item.inventory_dt) : null;

    if (constructionDate && inventoryDate) {
        // we want the construction date, unless the inventory date is more precise and is the same year
        item.tags.start_date = (inventoryDate.length > constructionDate.length && inventoryDate.substring(0, 4) === constructionDate.substring(0, 4)) ? inventoryDate : constructionDate;
    } else if (constructionDate || inventoryDate) {
        // take whatever start date we can get
        item.tags.start_date = constructionDate ? constructionDate : inventoryDate;
    }

    let officialName = item.station_nm;
    // replace all runs of whitespace with single spaces
    officialName = officialName.trim().replace(/\s+/gi, ' ');

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
            name: cleanName(officialName),
            official_name: officialName,
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
    let result = /(?: |\.|,)(\w+?)\.?$/gi.exec(officialName);
    let state = siteStateByRef[item.site_no] ? siteStateByRef[item.site_no] : (result && stateCodes.includes(result[1])) ? result[1] : item.basin_cd.substr(0, 2).toUpperCase();
    jsonFeature.state = state;
    if (!featuresByState[state]) featuresByState[state] = [];
    featuresByState[state].push(jsonFeature);
    features.push(jsonFeature);
});
for (let state in featuresByState) {
    let locs = {};
    featuresByState[state].forEach(function(feature) {
        let loc = feature.geometry.coordinates.toString();
        while (locs[loc]) {
            // offset loc slightly if the same as another feature
            feature.geometry.coordinates[0] += 0.00001;
            loc = feature.geometry.coordinates.toString();
        }
        locs[loc] = true;
    });
    let filename = state;
    if (!filename) filename = "_nostate";
    writeFileSync('./usgs/formatted/bystate/' + filename + '.geojson', JSON.stringify({
        type: "FeatureCollection",
        features: featuresByState[state]
    }, null, 2));
}
console.log(features.length);
writeFileSync('./usgs/formatted/all.geojson', JSON.stringify({
    type: "FeatureCollection",
    features: features
}, null, 2));