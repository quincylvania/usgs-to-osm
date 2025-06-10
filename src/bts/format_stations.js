import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, scratchDir } from '../utils.js';

export function formatItems(id, filter, getTags) {

  clearDirectory(scratchDir + id + '/formatted/');

  let inFile = scratchDir + id + '/source/all.json';

  console.log(`Formatting ${inFile}…`);
  
  let sourceStations = JSON.parse(readFileSync(inFile)).features;

  if (filter) {
    sourceStations = sourceStations.filter(filter);
  }
  
  let features = [];
  
  for (let i in sourceStations) {
    let station = sourceStations[i];
  
    let feature = {
      "geometry": station.geometry,
      "properties": getTags(station)
    };
    features.push(feature);
  }
  
  const json = {
    type: "FeatureCollection",
    features: features
  };
  
  console.log(features.length);
  let outPath = scratchDir + id + '/formatted/all.geojson';
  console.log(`Writing data to '${outPath}'`);
  writeFileSync(outPath, JSON.stringify(json, null, 2));
}
