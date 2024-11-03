import { writeFileSync } from 'fs';
import { getString, clearDirectory, scratchDir } from '../utils.js';

export async function downloadItems(id, url) {
    clearDirectory(scratchDir + id + '/source/');
    
    console.log(`Fetching: ${url}`);
    let json = JSON.parse(await getString(url));
    
    console.log(json?.features?.length);
    
    const localPath = scratchDir + id + '/source/all.json';
    console.log(`Writing data to '${localPath}'`);
    writeFileSync(localPath, JSON.stringify(json, null, 2));    
}
