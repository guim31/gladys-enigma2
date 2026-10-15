// -----------------------------------------------------------------------------
// Scene actions, run the way a scene runs them (fake Gladys → onSceneAction).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';
import { findChannel } from '../src/hub.js';
import { parseServices } from '../src/openwebif/api.js';
import { fixture } from './helpers/fakeOpenWebif.js';

test('show_message puts the text on the TV screen, with its type and duration', async () => {
  const world = await createWorld();
  try {
    const device = world.device().external_id;
    const result = await world.fake.sceneAction('show_message', {
      device,
      text: 'Quelqu’un sonne à la porte',
      message_type: 'warning',
      duration: 20,
    });
    assert.equal(result.success, true);
    assert.deepEqual(world.receiver.messages, [
      { text: 'Quelqu’un sonne à la porte', type: 2, timeout: 20 },
    ]);

    // Duration 0: until dismissed with the remote (-1 for OpenWebif).
    await world.fake.sceneAction('show_message', { device, text: 'Lessive finie', duration: 0 });
    assert.deepEqual(world.receiver.messages[1], { text: 'Lessive finie', type: 1, timeout: -1 });
  } finally {
    await world.close();
  }
});

test('show_message refuses an empty text and an unknown device', async () => {
  const world = await createWorld();
  try {
    const empty = await world.fake.sceneAction('show_message', {
      device: world.device().external_id,
      text: '   ',
    });
    assert.equal(empty.success, false);
    assert.equal(empty.error, 'Le message est vide.');
    const unknown = await world.fake.sceneAction('show_message', {
      device: 'ext:test-integration:receiver:nope',
      text: 'Hello',
    });
    assert.equal(unknown.success, false);
    assert.equal(world.receiver.messages.length, 0);
  } finally {
    await world.close();
  }
});

test('zap_channel switches by number or name, and returns the channel name', async () => {
  const world = await createWorld();
  try {
    const device = world.device().external_id;
    const byName = await world.fake.sceneAction('zap_channel', { device, channel: 'arte hd' });
    assert.deepEqual(byName, { success: true, data: { outputs: { channel_name: 'Arte HD' } } });
    assert.equal(world.receiver.ref, '1:0:19:283E:3FB:1:C00000:0:0:0:');
    await world.fake.sceneAction('zap_channel', { device, channel: '2' });
    assert.equal(world.receiver.ref, '1:0:19:2B66:3F3:1:C00000:0:0:0:');
    const missing = await world.fake.sceneAction('zap_channel', { device, channel: 'Canal+' });
    assert.equal(missing.success, false);
    assert.match(missing.error, /^Chaîne introuvable/);
  } finally {
    await world.close();
  }
});

test('findChannel matches a number, a reference, a name without case nor accents', () => {
  const channels = [
    ...parseServices(fixture('getservices-favourites')),
    { ref: '1:0:1:1:1:1:0:0:0:0:', name: 'Télé Bleue' },
  ];
  assert.equal(findChannel(channels, '1').name, 'Das Erste HD');
  assert.equal(findChannel(channels, 5).name, '3sat HD');
  assert.equal(findChannel(channels, '99'), null);
  assert.equal(findChannel(channels, '1:0:19:2B66:3F3:1:C00000:0:0:0:').name, 'ZDF HD');
  assert.equal(findChannel(channels, 'tele bleue').name, 'Télé Bleue');
  assert.equal(findChannel(channels, 'ZDFi').name, 'ZDFinfo HD');
  assert.equal(findChannel(channels, ''), null);
});
