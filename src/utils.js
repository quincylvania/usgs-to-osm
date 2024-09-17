import { request } from 'https';

export function clearDirectory(dir) {
    if (existsSync(dir)) readdirSync(dir).forEach(f => rmSync(`${dir}${f}`, { recursive: true }));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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