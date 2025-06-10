import { fetchOsmData, lifecyclePrefixes } from '../utils.js';
import { downloadItems } from './download_stations.js';
import { formatItems } from './format_stations.js';
import { diffItems } from './diff.js';

/*
let addr = station.properties.addressStreet;

let houseNum = addr.substring(0, addr.indexOf(' ')).trim();
let street = addr.substring(addr.indexOf(' ') + 1).trim();
street = street.replaceAll('St.', 'Street');
street = street.replaceAll('Ave.', 'Avenue');
street = street.replaceAll('Blvd.', 'Boulevard');
street = street.replaceAll('S. ', 'South ');
street = street.replaceAll('N. ', 'North ');
street = street.replaceAll('S ', 'South ');
street = street.replaceAll('N ', 'North ');
street = street.replaceAll('E. ', 'East ');
street = street.replaceAll('W. ', 'West ');
*/

function formatString(str) {
    return str
        .trim()
        .replaceAll(/\s+/gi, ' '); // replace each run of whitespace with single space 
}

const definitions = {
    'indego': {
        // https://www.rideindego.com/stations/
        sourceFileUrl: `https://bts-status.bicycletransit.workers.dev/phl`,
        overpassQuery: lifecyclePrefixes.map(prefix => `node["${prefix}amenity"="bicycle_rental"]["network:wikidata"="Q19876452"];`).join('\n'),
        filter: function(item) {
            return !item.properties.isEventBased && !item.properties.isVirtual;
        },
        tags: function(item) {
            return {
                "name": formatString(item.properties.name),
                "official_name": formatString(item.properties.name),
                "addr:city": formatString(item.properties.addressCity),
                "addr:state": formatString(item.properties.addressState),
                "addr:postcode": formatString(item.properties.addressZipCode),
                "ref": item.properties.id.toString(),
                "capacity": item.properties.totalDocks.toString(),
                "amenity": "bicycle_rental",
                "bicycle_rental": "docking_station",
                "brand": "Indego",
                "brand:wikidata": "Q19876452",
                "network": "Indego",
                "network:wikidata": "Q19876452",
                "operator": "Bicycle Transit Systems",
                "operator:wikidata": "Q104005517",
                "operator:type": "private",
                "owner": "City of Philadelphia",
                "ownership": "municipal",
                "fee": "yes",
                "rental": "city_bike;ebike",
                "website": "https://www.rideindego.com",
                "email": "support@rideindego.com",
                "phone": "+1 844-446-3346",
                "wheelchair": "no",
                "opening_hours": "24/7"
            };
        }
    },
    'rtc-bike-share': {
        sourceFileUrl: `https://bts-status.bicycletransit.workers.dev/las`,
        overpassQuery: lifecyclePrefixes.map(prefix => `node["${prefix}amenity"="bicycle_rental"]["network:wikidata"="Q104727968"];`).join('\n'),
        tags: function(item) {
            return {
                "name": formatString(item.properties.name),
                "official_name": formatString(item.properties.name),
                "addr:city": formatString(item.properties.addressCity),
                "addr:state": formatString(item.properties.addressState),
                "addr:postcode": formatString(item.properties.addressZipCode),
                "ref": item.properties.id.toString(),
                "capacity": item.properties.totalDocks.toString(),
                "amenity": "bicycle_rental",
                "bicycle_rental": "docking_station",
                "brand": "RTC Bike Share",
                "brand:wikidata": "Q104727968",
                "network": "RTC Bike Share",
                "network:wikidata": "Q104727968",
                "operator": "Bicycle Transit Systems",
                "operator:wikidata": "Q104005517",
                "fee": "yes",
                "rental": "city_bike;ebike",
                "website": "https://bikeshare.rtcsnv.com",
                "email": "support@bikeshare.rtcsnv.com",
                "phone": "+1 844-641-7823",
            };
        }
    }
};


for (let id in definitions) {
    let def = definitions[id];
    await downloadItems(id, def.sourceFileUrl);
    formatItems(id, def.filter, def.tags);
    await fetchOsmData(id, def.overpassQuery);
    diffItems(id);
}