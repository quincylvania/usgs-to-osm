import { existsSync, readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { request } from 'https';

// URL swiped from https://apps.usgs.gov/hivis/. Couldn't find a better data source.
const camerasRemoteUrl = 'https://jj5utwupk5.execute-api.us-east-1.amazonaws.com/prod/cameras';

function clearDirectory(dir) {
  if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
clearDirectory('./usgs/cameras/');

console.log('Fetching latest USGS cameras file…');
await get(camerasRemoteUrl).then(function(response) {
  var json = JSON.parse(response);
  if (json && json.length) {
    console.log(json.length + ' cameras');
    writeFileSync('./usgs/cameras/all.json', JSON.stringify(json, null, 2));
    console.log(`Wrote data to './usgs/cameras/all.json'`);
  } else {
    console.log(`Invalid response`);
  }
});

function get(url) {

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

    req.end()
  })
}