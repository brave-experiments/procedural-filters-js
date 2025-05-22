# procedural-filters-js

This repo contains JavaScript code used by Brave for procedural filtering (see [brave/brave-core#24688](https://github.com/brave/brave-core/pull/24688)).

It was used for testing the platform-specific procedural filtering implementation in Brave Browser prior to [brave/brave-core#25694](https://github.com/brave/brave-core/pull/25694).

More information about procedural filtering can be found [on the uBlock Origin wiki](https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters).

## Testing

You can test this code in two ways:

1. Run `npm run serve` and then visit the server on `http://localhost:8080`. On every test page, you can run `testResult()` in the dev console to confirm that elements are hidden or shown correctly.
2. Run `npm run test` for automatic tests powered by Playwright.
