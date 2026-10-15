// -----------------------------------------------------------------------------
// End to end: the integration wired on the SDK's fake Gladys (src/app.js, as
// index.js does) against fake receivers on 127.0.0.1 serving the OpenWebif
// fixtures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createWorld } from './helpers/world.js';
import { startFakeReceiver } from './helpers/fakeOpenWebif.js';
import { MESSAGES } from '../src/i18n.js';

const ZDFINFO = '1:0:19:2BA2:3F2:1:C00000:0:0:0:';
const DAS_ERSTE = '1:0:19:283D:3FB:1:C00000:0:0:0:';
const ZDF = '1:0:19:2B66:3F3:1:C00000:0:0:0:';
const SAT3 = '1:0:19:2B98:3F2:1:C00000:0:0:0:';

/** Run a command the way the dashboard does. */
async function set(world, key, value) {
  const device = world.fake.devices[0];
  const feature = device.features.find((f) => f.external_id.endsWith(`:${key}`));
  return world.fake.setValue(device, feature, value);
}

test('a receiver is discovered under its MAC address, with its favourites', async () => {
  const world = await createWorld();
  try {
    const [device] = world.fake.discoveredDevices;
    assert.equal(device.external_id, 'ext:test-integration:receiver:021deca00001');
    assert.equal(device.name, 'GigaBlue UHD QUAD 4K');
    assert.deepEqual(device.params, [{ name: 'host', value: world.receiver.address }]);
    // Feature names in French by default.
    assert.equal(world.feature('power').name, 'Marche / veille');
    // The marker and the sub-bouquet are not channels.
    assert.deepEqual(
      world.feature('channel_list').supported_options.map((o) => o.label),
      ['Das Erste HD', 'ZDF HD', 'ZDFinfo HD', 'Arte HD', '3sat HD'],
    );
    assert.deepEqual(world.fake.connectionStatus, { connected: true });
    // Nothing is published before the user adds the device.
    assert.equal(world.fake.states.length, 0);
  } finally {
    await world.close();
  }
});

test('adding the device publishes every state at once', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    assert.equal(world.state('power'), 1);
    assert.equal(world.state('volume'), 100);
    assert.equal(world.state('recording'), 0);
    assert.equal(world.state('channel_name'), 'ZDFinfo HD');
    assert.equal(world.state('program_now'), '15:30–16:15 Flucht aus Saudi-Arabien');
    assert.equal(world.state('program_next'), '16:15–17:00 Terra X History');
    assert.equal(world.state('channel_number'), 3);
    assert.equal(world.state('channel_list'), ZDFINFO);
    // The widget is nudged, so an open dashboard shows the device at once.
    assert.ok(world.fake.widgetRefreshes.includes('receiver'));
  } finally {
    await world.close();
  }
});

test('the states refresh on the container timer, without any onPoll from the core', async (t) => {
  const world = await createWorld({ timers: true, timings: { refreshMs: 40 } });
  try {
    const poll = t.mock.method(world.gladys.fake, 'poll');
    await world.createAll();
    assert.equal(world.state('channel_name'), 'ZDFinfo HD');

    // Someone zaps with the remote of the receiver.
    world.receiver.ref = DAS_ERSTE;
    world.receiver.recording = true;
    await waitFor(() => world.state('channel_name') === 'Das Erste HD');
    assert.equal(world.state('channel_number'), 1);
    assert.equal(world.state('recording'), 1);
    // No programme guide on that channel in the fixture.
    assert.equal(world.state('program_now'), 'Pas de guide des programmes');
    assert.equal(poll.mock.callCount(), 0, 'the core never polled');
  } finally {
    await world.close();
  }
});

test("the core's onPoll is a fallback, skipped right after the timer polled", async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    world.receiver.reset();
    assert.deepEqual(await world.fake.poll(world.fake.devices[0]), { success: true });
    assert.equal(world.receiver.count('/api/statusinfo'), 0, 'just polled: skipped');

    // Long after the last poll, the fallback reads the receiver.
    world.hub.entries.get(1).lastPolledAt -= 60_000;
    await world.fake.poll(world.fake.devices[0]);
    assert.equal(world.receiver.count('/api/statusinfo'), 1);
  } finally {
    await world.close();
  }
});

test('only the changes are published, so a normal cycle sends nothing new', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    const before = world.fake.states.length;
    await world.hub.cycle({ force: true });
    assert.equal(world.fake.states.length, before);
    world.receiver.volume = 55;
    await world.hub.cycle({ force: true });
    assert.deepEqual(world.fake.states.slice(before), [
      { device_feature_external_id: `${world.device().external_id}:volume`, state: 55 },
    ]);
  } finally {
    await world.close();
  }
});

test('the dashboard commands reach the receiver', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    const r = world.receiver;

    assert.deepEqual(await set(world, 'volume', 30), { success: true });
    assert.equal(r.volume, 30);
    assert.equal(world.state('volume'), 30);

    await set(world, 'volume_up', 1);
    assert.equal(r.volume, 35);
    await set(world, 'volume_down', 1);
    assert.equal(r.volume, 30);

    await set(world, 'mute', 1);
    assert.equal(r.muted, true);
    await set(world, 'mute', 1);
    assert.equal(r.muted, false, 'each press toggles');

    // Channel up and down move inside the favourites, wrapping around.
    await set(world, 'channel_up', 1);
    assert.equal(r.ref, '1:0:19:283E:3FB:1:C00000:0:0:0:');
    await set(world, 'channel_down', 1);
    assert.equal(r.ref, ZDFINFO);
    await set(world, 'channel_number', 1);
    assert.equal(r.ref, DAS_ERSTE);
    await set(world, 'channel_down', 1);
    assert.equal(r.ref, SAT3, 'from the first channel to the last one');
    assert.equal(world.state('channel_number'), 5);

    await set(world, 'channel_list', ZDF);
    assert.equal(r.ref, ZDF);
    assert.equal(world.state('channel_list'), ZDF);

    // Back to the channel watched before.
    await set(world, 'channel_previous', 1);
    assert.equal(r.ref, SAT3);

    await set(world, 'power', 0);
    assert.equal(r.standby, true);
    assert.equal(world.state('power'), 0);
    assert.equal(world.state('channel_name'), 'En veille');
    await set(world, 'power', 1);
    assert.equal(r.standby, false);
    assert.equal(world.state('power'), 1);
    // Standby is the light one: deep standby (1) is never sent.
    assert.ok(
      r.requests.filter((q) => q.path === '/api/powerstate').every((q) => q.query.newstate !== '1'),
    );
  } finally {
    await world.close();
  }
});

test('a channel outside the favourites uses the remote keys, an unknown number is refused', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    world.receiver.ref = '1:0:1:445D:453:1:C00000:0:0:0:'; // not in the bouquet
    await world.hub.cycle({ force: true });
    await set(world, 'channel_up', 1);
    assert.deepEqual(world.receiver.keys, [402]);

    const result = await set(world, 'channel_number', 42);
    assert.equal(result.success, false);
    assert.match(result.error, /not found/);
  } finally {
    await world.close();
  }
});

test('a receiver that stops answering is shown off after two failed polls, and comes back', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    world.receiver.offline = true;
    await world.hub.cycle({ force: true });
    assert.equal(world.state('power'), 1, 'one lost answer is not a receiver off');
    await world.hub.cycle({ force: true });
    assert.equal(world.state('power'), 0);
    assert.equal(world.state('channel_name'), 'Injoignable');

    world.receiver.offline = false;
    await world.hub.cycle({ force: true });
    assert.equal(world.state('power'), 1);
    assert.equal(world.state('channel_name'), 'ZDFinfo HD');
  } finally {
    await world.close();
  }
});

test('a receiver in deep standby at startup keeps its device, thanks to /data', async () => {
  const receiver = await startFakeReceiver();
  receiver.offline = true;
  const world = await createWorld({
    receivers: [receiver],
    storeData: {
      receivers: {
        1: { url: receiver.url, mac: '021deca00001', brand: 'GigaBlue', model: 'UHD QUAD 4K' },
      },
    },
  });
  try {
    assert.equal(world.device().external_id, 'ext:test-integration:receiver:021deca00001');
    assert.deepEqual(world.fake.connectionStatus, { connected: true });
  } finally {
    await world.close();
  }
});

test('a receiver never seen is published as soon as it answers, and remembered', async () => {
  const receiver = await startFakeReceiver();
  receiver.offline = true;
  const world = await createWorld({ receivers: [receiver] });
  try {
    assert.equal(world.fake.discoveredDevices.length, 0);
    assert.equal(world.fake.connectionStatus.connected, false);
    assert.deepEqual(world.fake.connectionStatus.message, MESSAGES.noneReachable);

    receiver.offline = false;
    await world.hub.cycle();
    assert.equal(world.fake.discoveredDevices.length, 1);
    assert.deepEqual(world.fake.connectionStatus, { connected: true });
    assert.equal(world.store.data.receivers[1].mac, '021deca00001');
    assert.equal(JSON.stringify(world.store.data).includes('password'), false);
  } finally {
    await world.close();
  }
});

test('the credentials are sent, and a refusal is reported in the configuration screen', async () => {
  const receiver = await startFakeReceiver({ auth: { username: 'root', password: 's3cr3t-pass' } });
  const good = await createWorld({
    receivers: [receiver],
    config: { receiver_1_password: 's3cr3t-pass' }, // user "root" by default
  });
  try {
    assert.equal(good.fake.discoveredDevices.length, 1);
  } finally {
    await good.app.stop();
  }
  const bad = await createWorld({
    receivers: [receiver],
    config: { receiver_1_username: 'root', receiver_1_password: 'wrong' },
  });
  try {
    assert.equal(bad.fake.discoveredDevices.length, 0);
    assert.deepEqual(bad.fake.connectionStatus.message, MESSAGES.authRefused);
  } finally {
    await bad.close();
  }
});

test('the test action reports every receiver, in four languages', async () => {
  const silent = await startFakeReceiver();
  silent.offline = true;
  const world = await createWorld({
    receivers: [await startFakeReceiver(), silent],
    config: { receiver_3_address: 'http://user:pw@192.0.2.30' },
  });
  try {
    const { success, data: ack } = await world.fake.action('test_connection');
    assert.equal(success, true);
    const data = ack.message;
    assert.deepEqual(Object.keys(data), ['en', 'fr', 'de', 'es']);
    assert.match(data.en, /Address 3 cannot be read/);
    assert.match(
      data.en,
      /GigaBlue UHD QUAD 4K, OWIF 2\.2\.0, 5 channel\(s\) in "Favourites \(TV\)"/,
    );
    assert.match(data.fr, /Démodulateur 2 .* ne répond pas/);
    assert.ok(!JSON.stringify(data).includes('pw@'));
  } finally {
    await world.close();
  }
});

test('the bouquet setting picks another TV bouquet', async () => {
  const world = await createWorld({ config: { bouquet: 'sport' } });
  try {
    assert.deepEqual(
      world.feature('channel_list').supported_options.map((o) => o.label),
      ['Sport1 HD'],
    );
  } finally {
    await world.close();
  }
});

test('an older OpenWebif without /api/getcurrent still gives the current programme', async () => {
  const world = await createWorld({ receivers: [await startFakeReceiver({ getcurrent: false })] });
  try {
    await world.createAll();
    assert.equal(world.state('program_now'), '15:30–16:15 Flucht aus Saudi-Arabien');
    assert.equal(world.state('program_next'), 'Aucune');
  } finally {
    await world.close();
  }
});

test('a normal cycle writes nothing at info level, and no secret ever reaches the logs', async (t) => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  const lines = [];
  const capture =
    (level) =>
    (...args) =>
      lines.push({ level, text: args.map(String).join(' ') });
  t.mock.method(console, 'log', capture('out'));
  t.mock.method(console, 'error', capture('err'));
  const secret = 'Pa55-w0rd-xyz';
  const receiver = await startFakeReceiver({ auth: { username: 'admin', password: secret } });
  const world = await createWorld({
    receivers: [receiver],
    config: { receiver_1_username: 'admin', receiver_1_password: secret },
  });
  try {
    await world.createAll();
    const start = lines.length;
    await world.hub.cycle({ force: true });
    world.receiver.ref = DAS_ERSTE; // a change, still a normal cycle
    await world.hub.cycle({ force: true });
    const cycleLines = lines.slice(start);
    assert.ok(cycleLines.length > 0, 'debug lines are written');
    assert.deepEqual(
      cycleLines.filter((line) => !line.text.includes('[DEBUG]')),
      [],
      'nothing above debug in a normal cycle',
    );

    // An outage: one warning when it starts, one info line when it ends.
    world.receiver.offline = true;
    for (let i = 0; i < 4; i += 1) {
      await world.hub.cycle({ force: true });
    }
    world.receiver.offline = false;
    await world.hub.cycle({ force: true });
    const outage = lines.filter((l) => /\[(WARN|INFO)\].*Receiver 1/.test(l.text));
    assert.equal(outage.filter((l) => l.text.includes('[WARN]')).length, 1);
    assert.equal(outage.filter((l) => l.text.includes('answers again')).length, 1);

    // A bad password too.
    await world.fake.configUpdated({
      receiver_1_address: receiver.address,
      receiver_1_username: 'admin',
      receiver_1_password: `${secret}-wrong`,
    });
    const encoded = Buffer.from(`admin:${secret}`).toString('base64');
    for (const line of lines) {
      assert.ok(!line.text.includes(secret), `secret in: ${line.text}`);
      assert.ok(!line.text.includes(encoded), `credentials in: ${line.text}`);
    }
  } finally {
    await world.close();
    process.env.LOG_LEVEL = previous;
  }
});

async function waitFor(predicate, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > end) {
      throw new Error('condition not met in time');
    }
    await sleep(10);
  }
}
