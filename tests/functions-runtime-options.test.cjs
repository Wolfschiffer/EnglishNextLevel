const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');

const functionsRequire = createRequire(path.join(__dirname, '../functions/package.json'));
const { getGlobalOptions } = functionsRequire('firebase-functions/v2/options');
const backend = require('../functions/index.js');

test('all callable functions use the configured instance ceiling', () => {
    assert.equal(getGlobalOptions().maxInstances, 10);

    for (const [name, callable] of Object.entries(backend)) {
        assert.equal(callable.__endpoint.maxInstances, 10, `${name} should inherit the ceiling`);
    }
});
