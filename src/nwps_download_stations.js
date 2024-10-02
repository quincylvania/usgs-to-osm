import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getString, clearDirectory } from './utils.js';

// https://api.water.noaa.gov/nwps/v1/docs/#/

//clearDirectory('./scratch/nwps/full/');

console.log('Fetching National Water Prediction Service stations. This may take quite awhile…');

const indexGauges = JSON.parse(readFileSync('./scratch/nwps/index/all.json')).gauges;

for (let i in indexGauges) {
    let indexGauge = indexGauges[i];
    let id = indexGauge.lid;
    const localPath = `./scratch/nwps/full/${id}.json`;

    if (existsSync(localPath)) continue;

    const remotePath = `https://api.water.noaa.gov/nwps/v1/gauges/${id}`;
    console.log(`Fetching: ${remotePath}`);
    let jsonString = await getString(remotePath);

    console.log(`Writing data to '${localPath}'`);
    writeFileSync(localPath, jsonString);
}