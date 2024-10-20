import { writeFileSync, existsSync } from 'fs';
import { clearDirectory, get, getString } from '../utils.js';

console.log('Fetching NOAA CO-OPS station images…');

//clearDirectory('../scratch/co-ops/photos/');

let directory = JSON.parse(await getString('https://cdn.tidesandcurrents.noaa.gov/assets/stationphotos/photo.json'));

let imageSaved = 0;

for(let stationId in directory) {
  let imageSuffixes = directory[stationId].split('');

  for(let i in imageSuffixes) {
    let suffix = imageSuffixes[i];
    let photoId = stationId + suffix;
    let localPath = `../scratch/co-ops/photos/${photoId}.jpg`;
    // skip photos we already have saved
    if (existsSync(localPath)) continue;

    let remotePath = `https://cdn.tidesandcurrents.noaa.gov/uat/assets/stationphotos/${photoId}.jpg`;
    try {
      console.log(`Fetching '${remotePath}'`);
      // fetch synchronously to avoid making too many requests to the servers in a small time window
      let imageData = await get(remotePath);
      console.log(`Writing data to '${localPath}'`);
      writeFileSync(localPath, imageData);
      imageSaved += 1;
    } catch(error) {
      console.log(error);
    }
  }
}

console.log(`Saved images: ${imageSaved}`);
