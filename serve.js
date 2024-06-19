#! /usr/bin/env node

const httpLib = require('node:http')
const fsLib = require('node:fs')

const configLib = require('./config.js')

const baseDir = './tests/html'

console.log(`serving tests from http://${configLib.host}:${configLib.port}/`)

httpLib.createServer((req, res) => {
  let contents
  if (req.url.endsWith('.js')) {
    contents = fsLib.readFileSync(baseDir + req.url)
    res.writeHead(200, { 'Content-Type': 'application/javascript' })
  } else if (req.url.endsWith('.html')) {
    contents = fsLib.readFileSync(baseDir + req.url)
    res.writeHead(200, { 'Content-Type': 'text/html' })
  } else {
    contents = ''
    res.writeHead(404)
  }
  res.write(contents)
  res.end()
}).listen(configLib.port)
