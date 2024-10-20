import { writeFileSync } from 'fs';
import { getString, clearDirectory, scratchDir } from '../utils.js';

clearDirectory(scratchDir + 'indego/source/');

console.log('Fetching Indego stations…');

// https://www.rideindego.com/stations/

const url = `https://bts-status.bicycletransit.workers.dev/phl`;
console.log(`Fetching: ${url}`);
let json = JSON.parse(await getString(url));

console.log(json?.features?.length);

const localPath = scratchDir + 'indego/source/all.json';
console.log(`Writing data to '${localPath}'`);
writeFileSync(localPath, JSON.stringify(json, null, 2));
