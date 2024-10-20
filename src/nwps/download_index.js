import { writeFileSync } from 'fs';
import { getString, clearDirectory } from '../utils.js';

// https://api.water.noaa.gov/nwps/v1/docs/#/

clearDirectory('../scratch/nwps/index/');

console.log('Fetching National Water Prediction Service station index. This may take some time…');

const url = `https://api.water.noaa.gov/nwps/v1/gauges`;
console.log(`Fetching: ${url}`);
let jsonString = await getString(url);

let json = JSON.parse(jsonString);
console.log(json?.gauges?.length);

const localPath = '../scratch/nwps/index/all.json';
console.log(`Writing data to '${localPath}'`);
writeFileSync(localPath, jsonString);
