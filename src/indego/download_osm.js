import { lifecyclePrefixes, fetchOsmData } from '../utils.js';

// wikidata IDs for both CO-OPS and TCOONS 
const query = lifecyclePrefixes.map(prefix => `node["${prefix}amenity"="bicycle_rental"]["network:wikidata"="Q19876452"];`).join('\n');

fetchOsmData('indego', query);
