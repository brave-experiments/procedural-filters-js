#! /usr/bin/env node

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

import configLib from './config.js'

const baseDir = './tests/html'

console.log(`serving tests from http://${configLib.host}:${configLib.port}/`)

createServer((req, res) => {
  let contents
  if (req.url.endsWith('.js')) {
    contents = readFileSync(baseDir + req.url)
    res.writeHead(200, { 'Content-Type': 'application/javascript' })
  } else if (req.url.endsWith('.html')) {
    contents = readFileSync(baseDir + req.url)
    res.writeHead(200, { 'Content-Type': 'text/html' })
  } else {
    contents = ''
    res.writeHead(404)
  }
  res.write(contents)
  res.end()
}).listen(configLib.port)
