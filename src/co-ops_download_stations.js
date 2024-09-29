import { writeFileSync } from 'fs';
import { getString, clearDirectory } from './utils.js';

// Fetch official site data from NOAA CO-OPS Metadata API:
// https://api.tidesandcurrents.noaa.gov/mdapi/prod/

clearDirectory('./scratch/co-ops/source/');

console.log('Fetching latest NOAA CO-OPS stations…');

// There isn't one endpoint for all stations, so we need to fetch different endpoints that add up to all stations.
// It's not clear exactly which types intersect so just get everything. 
let types = [
  "waterlevels",
  "waterlevelsandmet",
  "airgap",
  "datums",
  "supersededdatums",
  "benchmarks",
  "supersededbenchmarks",
  "historicwl",
  "met",
  "harcon",
  "tidepredictions",
  "currentpredictions",
  "currents",
  "historiccurrents",
  "surveycurrents",
  "cond",
  "watertemp",
  "physocean",
  "tcoon",
  "visibility",
  "1minute",
  "historicmet",
  "historicphysocean",
  "highwater",
  "lowwater",
  "hightideflooding",
  //"ofs",                  // Operational Forecast System stations, out of scope for now
  //"partnerstations"       // only a few of these, out of scope for now
];

let stationsById = {};

for (let i in types) {
  let type = types[i];
  // get all fields for all features with coordinates in WGS 84
  const url = `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=${type}&expand=details,sensors`;
  console.log(`Fetching: ${url}`);
  let response = await getString(url);
  let json = JSON.parse(response);
  if (json && json.stations) {
    for (let j in json.stations) {
      let station = json.stations[j];
      let id = station.id;
      if (!stationsById[id]) stationsById[id] = station;
    }
  } else {
    console.log(`Invalid response`);
  }
}

const json = {
  count: Object.keys(stationsById).length,
  units: null,
  stations: Object.values(stationsById)
};

console.log(`Writing data to './scratch/co-ops/source/all.json'`);
writeFileSync('./scratch/co-ops/source/all.json', JSON.stringify(json, null, 2));
