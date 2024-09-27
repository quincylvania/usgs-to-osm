import { writeFileSync } from 'fs';
import { post, clearDirectory } from './utils.js';

clearDirectory('./osm/');

const prefixes = ['', 'disused:', 'abandoned:', 'ruins:', 'demolished:', 'destroyed:', 'razed:', 'removed:', 'was:'];

// do not limit to the US since some sites are in Canada
const query = `
[out:json][timeout:60];
(
${prefixes.map(prefix => `node["${prefix}man_made"="monitoring_station"]["operator:wikidata"="Q193755"];`).join('\n')}
);
(._;>;); out meta;
`;

let postData = "data="+encodeURIComponent(query);

console.log("Running Overpass query… this may take some time");
await post('https://overpass-api.de/api/interpreter', postData).then(function(response) {
  console.log(`${JSON.parse(response)?.elements?.length} OSM entities returned`);
  console.log("Writing data to ./osm/all.json");
  writeFileSync('./osm/all.json', response);
});
