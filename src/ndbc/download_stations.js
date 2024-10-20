import { writeFileSync } from 'fs';
import simpleXmlToJson from 'simple-xml-to-json';
const { convertXML } = simpleXmlToJson;
import { getString, clearDirectory, scratchDir } from '../utils.js';

clearDirectory(scratchDir + 'ndbc/');

console.log('Fetching active National Data Buoy Center stations…');

const url = `https://www.ndbc.noaa.gov/activestations.xml`;
console.log(`Fetching: ${url}`);
let response = await getString(url);
let json = convertXML(response);

console.log(json?.stations?.children?.length);

console.log(`Writing data to scratchDir + 'ndbc/all.json'`);
writeFileSync(scratchDir + 'ndbc/all.json', JSON.stringify(json, null, 2));
