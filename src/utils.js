import { request } from 'https';
import { existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { readFile } from 'fs/promises';

export async function iterateFilesInDirectory(dir, withFunction) {
  return Promise.all(readdirSync(dir).map(file => {
      return readFile(dir + file).then(result => withFunction(result, file));
  }));
}

export function clearDirectory(dir) {
  if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function getString(url) {
  return get(url).then(result => result.toString());
}

export function get(url) {

  const options = {
    method: 'GET',
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
        resolve(Buffer.concat(body))
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request time out'))
    })

    req.end()
  })
}

export function post(url, dataString) {

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

export function toTitleCase(str) {
  return str.replace(
    /\b\D+?\b/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}


export async function fetchOsmData(id, queryPart) {

  clearDirectory(`./scratch/osm/${id}/`);

  const prefixes = ['', 'disused:', 'abandoned:', 'ruins:', 'demolished:', 'destroyed:', 'razed:', 'removed:', 'was:'];
  
  // do not limit to the US since some sites are in Canada
  const query = `
  [out:json][timeout:60];
  (
  ${prefixes.map(prefix => `node["${prefix}man_made"="monitoring_station"]${queryPart};`).join('\n')}
  );
  (._;>;); out meta;
  `;
  
  let postData = "data="+encodeURIComponent(query);
  
  console.log(`Running Overpass query for '${id}'. This may take some time…`);
  await post('https://overpass-api.de/api/interpreter', postData).then(function(response) {
    console.log(`${JSON.parse(response)?.elements?.length} OSM entities returned`);
    let localPath = `./scratch/osm/${id}/all.json`;
    console.log(`Writing data to '${localPath}'`);
    writeFileSync(localPath, response);
  });
}

export function locHash(obj) {
  let lon = obj.lon || obj.geometry.coordinates[0];
  let lat = obj.lat || obj.geometry.coordinates[1];
  return Math.round(lon*500000)/500000 + "," + Math.round(lat*500000)/500000;
}