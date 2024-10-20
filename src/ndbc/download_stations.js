import { writeFileSync } from 'fs';
import simpleXmlToJson from 'simple-xml-to-json';
const { convertXML } = simpleXmlToJson;
import { getString, clearDirectory } from '../utils.js';

clearDirectory('../scratch/ndbc/');

console.log('Fetching active National Data Buoy Center stations…');

const url = `https://www.ndbc.noaa.gov/activestations.xml`;
console.log(`Fetching: ${url}`);
let response = await getString(url);
let json = convertXML(response);

console.log(json?.stations?.children?.length);

console.log(`Writing data to '../scratch/ndbc/all.json'`);
writeFileSync('../scratch/ndbc/all.json', JSON.stringify(json, null, 2));
