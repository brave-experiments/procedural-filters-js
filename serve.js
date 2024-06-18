const httpLib = require('node:http')
const fsLib = require('node:fs')

const configLib = require('./config.js')

const baseDir = './tests/html'

httpLib.createServer((req, res) => {
  const contents = fsLib.readFileSync(baseDir + req.url)
  if (req.url.endsWith('.js')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' })
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' })
  }
  res.write(contents)
  res.end()
}).listen(configLib.port)
