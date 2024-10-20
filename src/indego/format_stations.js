import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, toTitleCase, iterateFilesInDirectory, scratchDir } from '../utils.js';

clearDirectory(scratchDir + 'indego/formatted/');

console.log('Formatting Indego stations…');

const sourceStations = JSON.parse(readFileSync(scratchDir + 'indego/source/all.json')).features;

let features =[];

for (let i in sourceStations) {
  let station = sourceStations[i];

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

  let feature = {
    "geometry": station.geometry,
    "properties": {
      "name": station.properties.name.trim(),
   //   "addr:housenumber": houseNum,
   //   "addr:street": street,
      "addr:city": station.properties.addressCity.trim(),
      "addr:state": station.properties.addressState.trim(),
      "addr:postcode": station.properties.addressZipCode.trim(),
      "ref": station.properties.id.toString(),
      "capacity": station.properties.totalDocks.toString(),
      "amenity": "bicycle_rental",
      "bicycle_rental": "docking_station",
      "brand": "Indego",
      "brand:wikidata": "Q19876452",
      "network": "Indego",
      "network:wikidata": "Q19876452",
      "operator": "Bicycle Transit Systems",
      "operator:wikidata": "Q104005517",
      "fee": "yes",
      "rental": "city_bike;ebike",
    }
  };
  features.push(feature);
}

const json = {
  type: "FeatureCollection",
  features: features
};

console.log(features.length);
let outPath = scratchDir + 'indego/formatted/all.geojson';
console.log(`Writing data to '${outPath}'`);
writeFileSync(outPath, JSON.stringify(json, null, 2));
