// -----------------------------------------------------------------------------
// Configuration normalization: addresses, slots, options, defaults.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseAddress } from '../src/config.js';

test('an address is a host, an IP, with an optional scheme and port', () => {
  assert.equal(parseAddress('192.0.2.20'), 'http://192.0.2.20');
  assert.equal(parseAddress(' vuplus:8080 '), 'http://vuplus:8080');
  assert.equal(parseAddress('https://192.0.2.20/'), 'https://192.0.2.20');
  assert.equal(parseAddress('http://192.0.2.20/web/about'), 'http://192.0.2.20');
  assert.equal(parseAddress('HTTPS://Box.Local:8443'), 'https://box.local:8443');
});

test('an unusable address, or one carrying credentials, is refused', () => {
  for (const raw of ['', '   ', 'ftp://192.0.2.20', 'http://', 'http://root:pw@192.0.2.20', 42]) {
    assert.equal(parseAddress(raw), null, String(raw));
  }
});

test('the defaults give an empty configuration', () => {
  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG), {
    receivers: [],
    invalidSlots: [],
    allowSelfSigned: false,
    bouquet: '',
    refreshMs: 30000,
    language: 'fr',
  });
  assert.deepEqual(normalizeConfig(undefined).receivers, []);
});

test('the three slots, the options and the invalid addresses', () => {
  const config = normalizeConfig({
    receiver_1_address: '192.0.2.20',
    receiver_1_username: ' root ',
    receiver_1_password: ' with spaces ',
    receiver_1_name: ' Salon ',
    receiver_2_address: 'http://a:b@192.0.2.21',
    receiver_3_address: 'https://192.0.2.22:8443',
    allow_self_signed: 'true',
    bouquet: ' Sport ',
    refresh_interval: 10,
    language: 'de',
  });
  assert.deepEqual(config.receivers, [
    {
      slot: 1,
      url: 'http://192.0.2.20',
      username: 'root',
      password: ' with spaces ',
      name: 'Salon',
    },
    { slot: 3, url: 'https://192.0.2.22:8443', username: '', password: '', name: null },
  ]);
  assert.deepEqual(config.invalidSlots, [2]);
  assert.equal(config.allowSelfSigned, true);
  assert.equal(config.bouquet, 'Sport');
  assert.equal(config.refreshMs, 10000);
  assert.equal(config.language, 'de');
});

test('an unknown interval or language falls back to the default', () => {
  const config = normalizeConfig({ refresh_interval: '5', language: 'it' });
  assert.equal(config.refreshMs, 30000);
  assert.equal(config.language, 'fr');
});
