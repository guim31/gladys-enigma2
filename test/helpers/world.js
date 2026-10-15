// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, fake receivers on 127.0.0.1,
// a store in memory, and the integration wired on top through
// registerHandlers — the same wiring as index.js.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { startFakeReceiver } from './fakeOpenWebif.js';

// The integration logs its lifecycle: keep the test output readable (the
// level is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';
// Programme times in a known zone.
process.env.TZ = 'UTC';

/** The config slots of the given receivers. */
export function receiverConfig(receivers, extra = {}) {
  const config = { ...extra };
  receivers.forEach((receiver, index) => {
    config[`receiver_${index + 1}_address`] = receiver.address;
  });
  return config;
}

/**
 * @param {object} [options]
 * @param {Array} [options.receivers] from startFakeReceiver; one by default
 * @param {object} [options.config] extra raw config
 * @param {object} [options.storeData] content of /data
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.timers] run the polling timer
 * @param {object} [options.timings]
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  receivers,
  config = {},
  storeData = {},
  devices = [],
  timers = false,
  timings = {},
  connect = true,
} = {}) {
  const fakes = receivers ?? [await startFakeReceiver()];
  const gladys = createFakeGladys({ config: receiverConfig(fakes, config), devices });
  const store = new MemoryStore(storeData);
  const app = registerHandlers(gladys, {
    store,
    timers,
    timings: { afterCommandMs: 0, ...timings },
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  const world = {
    gladys,
    fake: gladys.fake,
    app,
    hub: app.hub,
    store,
    receivers: fakes,
    receiver: fakes[0],
    /** The discovered device of the n-th receiver. */
    device: (index = 0) => gladys.fake.discoveredDevices[index],
    /** Add every discovered device to Gladys, as the user would. */
    async createAll() {
      for (const device of gladys.fake.discoveredDevices) {
        await gladys.fake.deviceCreated(device);
      }
    },
    /** Last state of a feature of the first device. */
    state: (key, index = 0) =>
      gladys.fake.lastState(`${gladys.fake.discoveredDevices[index].external_id}:${key}`),
    feature: (key, index = 0) =>
      gladys.fake.discoveredDevices[index].features.find((f) => f.external_id.endsWith(`:${key}`)),
    async close() {
      await app.stop();
      await Promise.all(fakes.map((receiver) => receiver.close()));
    },
  };
  return world;
}
