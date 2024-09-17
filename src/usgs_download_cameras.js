import { writeFileSync } from 'fs';
import { get, clearDirectory } from './utils.js';

// URL swiped from https://apps.usgs.gov/hivis/. Couldn't find a better data source.
const camerasRemoteUrl = 'https://jj5utwupk5.execute-api.us-east-1.amazonaws.com/prod/cameras';

clearDirectory('./usgs/cameras/');

console.log('Fetching latest USGS cameras file…');
await get(camerasRemoteUrl).then(function(response) {
  let json = JSON.parse(response);
  if (json && json.length) {
    console.log(json.length + ' cameras');
    console.log(`Writing data to './usgs/cameras/all.json'`);
    writeFileSync('./usgs/cameras/all.json', JSON.stringify(json, null, 2));
  } else {
    console.log(`Invalid response`);
  }
});
