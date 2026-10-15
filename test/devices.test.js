// -----------------------------------------------------------------------------
// A receiver → its Gladys device and states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  FEATURE_KEYS,
  buildDevice,
  formatProgram,
  receiverIds,
  receiverStates,
} from '../src/devices.js';
import { parseCurrent, parseServices, parseStatus } from '../src/openwebif/api.js';
import { fixture } from './helpers/fakeOpenWebif.js';
import './helpers/world.js'; // TZ=UTC

const gladys = createFakeGladys();
const ids = receiverIds(gladys, '021deca00001');
const channels = parseServices(fixture('getservices-favourites'));
const identity = {
  mac: '021deca00001',
  brand: 'GigaBlue',
  model: 'UHD QUAD 4K',
  host: '192.0.2.20',
};

const byKey = (states) =>
  Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.text ?? s.state]),
  );

test('the feature keys are forever', () => {
  assert.deepEqual(FEATURE_KEYS, [
    'power',
    'volume',
    'volume_up',
    'volume_down',
    'mute',
    'channel_up',
    'channel_down',
    'channel_previous',
    'channel_number',
    'channel_list',
    'channel_name',
    'program_now',
    'program_next',
    'recording',
  ]);
});

test('the device is polled by the container, named after the user or the model', () => {
  const device = buildDevice(gladys, {
    receiver: { slot: 1, name: null },
    identity,
    channels,
    language: 'en',
  });
  assert.equal(device.name, 'GigaBlue UHD QUAD 4K');
  assert.equal(device.should_poll, true);
  assert.equal(device.poll_frequency, 30000);
  const named = buildDevice(gladys, {
    receiver: { slot: 1, name: 'Salon' },
    identity,
    language: 'es',
  });
  assert.equal(named.name, 'Salon');
  assert.equal(
    named.features.find((f) => f.external_id === ids.feature('channel_list')).supported_options,
    undefined,
  );
  assert.equal(named.features[0].name, 'Encendido / reposo');
});

test('states of a receiver that is on', () => {
  const states = receiverStates(
    ids,
    {
      reachable: true,
      status: parseStatus(fixture('statusinfo-on')),
      programs: parseCurrent(fixture('getcurrent')),
    },
    channels,
    'en',
  );
  assert.deepEqual(byKey(states), {
    power: 1,
    volume: 100,
    recording: 0,
    channel_name: 'ZDFinfo HD',
    program_now: '15:30–16:15 Flucht aus Saudi-Arabien',
    program_next: '16:15–17:00 Terra X History',
    channel_number: 3,
    channel_list: '1:0:19:2BA2:3F2:1:C00000:0:0:0:',
  });
});

test('states of a receiver in standby, and of one that does not answer', () => {
  assert.deepEqual(
    byKey(
      receiverStates(
        ids,
        { reachable: true, status: parseStatus(fixture('statusinfo-standby')) },
        channels,
        'fr',
      ),
    ),
    {
      power: 0,
      volume: 100,
      recording: 0,
      channel_name: 'En veille',
      program_now: 'Aucune',
      program_next: 'Aucune',
    },
  );
  assert.deepEqual(byKey(receiverStates(ids, { reachable: false }, channels, 'de')), {
    power: 0,
    channel_name: 'Nicht erreichbar',
    program_now: 'Keine',
    program_next: 'Keine',
  });
});

test('no text state is ever empty', () => {
  const states = receiverStates(
    ids,
    {
      reachable: true,
      status: { ...parseStatus(fixture('statusinfo-on')), channel: null },
      programs: null,
    },
    [],
    'es',
  );
  for (const state of states.filter((s) => 'text' in s)) {
    assert.ok(state.text.length > 0);
  }
  assert.equal(byKey(states).channel_name, 'Ninguno');
});

test('a programme without times keeps its title', () => {
  assert.equal(formatProgram({ title: 'News', begin: null, end: null }, 'en'), 'News');
  assert.equal(formatProgram(null, 'en'), null);
});
