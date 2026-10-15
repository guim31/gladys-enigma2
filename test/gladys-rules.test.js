// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from realistic
// fixtures: a receiver reporting its MAC address, one reporting none, with
// and without a favourites bouquet — in every feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDevice } from '../src/devices.js';
import { parseAbout, parseServices } from '../src/openwebif/api.js';
import { createWorld } from './helpers/world.js';
import { fixture, startFakeReceiver } from './helpers/fakeOpenWebif.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

function checkDevice(device) {
  const where = device.name;

  // should_poll: true if and only if poll_frequency is provided, in ms.
  if (device.poll_frequency === undefined) {
    assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
  } else {
    assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
    assert.ok(
      table.poll_frequencies_ms.includes(device.poll_frequency),
      `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
    );
  }

  assert.ok(device.features.length > 0, `${where}: no feature`);
  const externalIds = new Set();
  const names = new Set();
  for (const feature of device.features) {
    const at = `${where} / ${feature.name}`;
    assert.ok(
      table.categories.includes(feature.category),
      `${at}: unknown category ${feature.category}`,
    );
    const pair = table.pairs[`${feature.category}/${feature.type}`];
    assert.ok(pair, `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`);
    assert.ok(pair.label_en && pair.label_fr && pair.icon, `${at}: couple without label or icon`);

    assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
    assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
    assert.ok(
      Number.isFinite(feature.min) && Number.isFinite(feature.max),
      `${at}: finite min/max`,
    );
    assert.ok(feature.min <= feature.max, `${at}: min > max`);
    assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
    assert.equal(typeof feature.has_feedback, 'boolean', `${at}: has_feedback must be a boolean`);
    if (feature.unit !== undefined) {
      assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
    }

    assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
    externalIds.add(feature.external_id);
    assert.ok(feature.external_id.startsWith(`${device.external_id}:`), `${at}: foreign id`);
    assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
    names.add(feature.name);
  }
}

const channels = parseServices(fixture('getservices-favourites'));
const scenarios = [
  { label: 'GigaBlue, favourites', about: 'about-gigablue-openatv', channels },
  { label: 'no MAC address, no bouquet', about: 'about-no-mac', channels: [] },
];

for (const language of ['en', 'fr', 'de', 'es']) {
  for (const scenario of scenarios) {
    test(`every built device follows the Gladys rules (${scenario.label}, ${language})`, () => {
      const gladys = createFakeGladys();
      const about = parseAbout(fixture(scenario.about));
      const device = buildDevice(gladys, {
        receiver: { slot: 1, name: null },
        identity: { ...about, mac: about.mac ?? 'host-192-0-2-20', host: '192.0.2.20' },
        channels: scenario.channels,
        language,
      });
      checkDevice(device);
    });
  }
}

test('every discovered device follows the Gladys rules (end to end, two receivers)', async () => {
  const receivers = [await startFakeReceiver(), await startFakeReceiver({ about: 'about-no-mac' })];
  const world = await createWorld({ receivers });
  try {
    const devices = world.fake.discoveredDevices;
    assert.equal(devices.length, 2);
    devices.forEach(checkDevice);
    assert.notEqual(devices[0].external_id, devices[1].external_id);
    // The fake core validated the list like Gladys does, and accepted it.
    assert.ok(
      world.fake.requests.some((r) => r.path.endsWith('/discovered_device') && r.status === 200),
    );
  } finally {
    await world.close();
  }
});

test('the supported options of the channel list are what the core accepts', () => {
  const gladys = createFakeGladys();
  const about = parseAbout(fixture('about-gigablue-openatv'));
  const device = buildDevice(gladys, {
    receiver: { slot: 1, name: null },
    identity: { ...about, host: '192.0.2.20' },
    channels,
    language: 'fr',
  });
  const list = device.features.find((f) => f.external_id.endsWith(':channel_list'));
  assert.equal(list.category, 'text');
  assert.equal(list.type, 'select');
  const values = list.supported_options.map((o) => o.value);
  assert.equal(new Set(values).size, values.length, 'unique values');
  for (const option of list.supported_options) {
    assert.equal(typeof option.value, 'string');
    assert.ok(option.value.trim() !== '');
    assert.ok(option.label.trim() !== '');
  }
});
