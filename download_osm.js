import { existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { request } from 'https';

function clearDirectory(dir) {
  if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
clearDirectory('./osm/');

const prefixes = ['', 'disused:', 'abandoned:', 'ruins:', 'demolished:', 'destroyed:', 'razed:', 'removed:', 'was:'];

// do not limit to the US since some sites are in Canada
const query = `
[out:json][timeout:60];
(
${prefixes.map(prefix => `node["${prefix}man_made"="monitoring_station"]["operator:wikidata"="Q193755"]["ref"];`).join('\n')}
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

function post(url, dataString) {

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'x-www-form-urlencoded',
      'Content-Length': dataString.length,
    },
    timeout: 60000, // in ms
  }

  return new Promise((resolve, reject) => {
    const req = request(url, options, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(new Error(`HTTP status code ${res.statusCode}`))
      }

      const body = []
      res.on('data', (chunk) => body.push(chunk))
      res.on('end', () => {
        const resString = Buffer.concat(body).toString()
        resolve(resString)
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request time out'))
    })

    req.write(dataString)
    req.end()
  })
}