import { lifecyclePrefixes, fetchOsmData } from '../utils.js';

const query = lifecyclePrefixes.map(prefix => `node["${prefix}man_made"="monitoring_station"]["operator:wikidata"="Q193755"];`).join('\n');

fetchOsmData('usgs', query);
