// -----------------------------------------------------------------------------
// OpenWebif answers (fixtures from real receivers) and the HTTP client.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { OpenWebifClient, OpenWebifError } from '../src/openwebif/client.js';
import {
  getFavorites,
  normalizeMac,
  parseAbout,
  parseBouquets,
  parseCurrent,
  parseServices,
  parseStatus,
  setVolume,
  zap,
} from '../src/openwebif/api.js';
import { fixture, startFakeReceiver } from './helpers/fakeOpenWebif.js';

test('about: identity of a GigaBlue on openATV', () => {
  assert.deepEqual(parseAbout(fixture('about-gigablue-openatv')), {
    mac: '021deca00001',
    brand: 'GigaBlue',
    model: 'UHD QUAD 4K',
    boxtype: 'gbquad4k',
    webif: 'OWIF 2.2.0',
    image: 'openATV 7.5.20241101',
  });
  assert.equal(parseAbout(fixture('about-no-mac')).mac, null);
  assert.equal(parseAbout({}).mac, null);
  assert.equal(normalizeMac('00:00:00:00:00:00'), null);
  assert.equal(normalizeMac('02-1D-EC-A0-00-01'), '021deca00001');
});

test('statusinfo: on, with the current programme', () => {
  assert.deepEqual(parseStatus(fixture('statusinfo-on')), {
    standby: false,
    recording: false,
    volume: 100,
    muted: false,
    serviceRef: '1:0:19:2BA2:3F2:1:C00000:0:0:0:',
    playback: false,
    channel: 'ZDFinfo HD',
    now: { title: 'Flucht aus Saudi-Arabien', begin: 1734622200, end: 1734624900 },
  });
});

test('statusinfo: standby, no programme ("N/A")', () => {
  const status = parseStatus(fixture('statusinfo-standby'));
  assert.equal(status.standby, true);
  assert.equal(status.muted, true);
  assert.equal(status.serviceRef, null);
  assert.equal(status.now, null);
});

test('statusinfo: a recording played back, booleans as booleans', () => {
  const status = parseStatus({
    inStandby: false,
    isRecording: true,
    volume: '42',
    currservice_serviceref:
      '1:0:0:0:0:0:0:0:0:0:/media/hdd/movie/20241019 2027 - Arte HD - Film.ts',
  });
  assert.equal(status.playback, true);
  assert.equal(status.recording, true);
  assert.equal(status.volume, 42);
  assert.equal(status.muted, null);
});

test('getcurrent: current and next programme, nothing without a guide', () => {
  assert.deepEqual(parseCurrent(fixture('getcurrent')), {
    now: { title: 'Flucht aus Saudi-Arabien', begin: 1734622200, end: 1734624900 },
    next: { title: 'Terra X History', begin: 1734624900, end: 1734627600 },
  });
  assert.deepEqual(parseCurrent(fixture('getcurrent-no-epg')), { now: null, next: null });
});

test('bouquets and services: markers and sub-bouquets are left out', () => {
  assert.deepEqual(
    parseBouquets(fixture('bouquets-tv')).map((b) => b.name),
    ['Favourites (TV)', 'Sport'],
  );
  assert.deepEqual(
    parseServices(fixture('getservices-favourites')).map((s) => s.name),
    ['Das Erste HD', 'ZDF HD', 'ZDFinfo HD', 'Arte HD', '3sat HD'],
  );
  assert.deepEqual(parseServices({ services: 'nope' }), []);
});

test('the client reads the API, sends the commands, and finds the bouquet by name', async () => {
  const receiver = await startFakeReceiver();
  try {
    const client = new OpenWebifClient({ url: receiver.url });
    const sport = await getFavorites(client, 'SPORT');
    assert.equal(sport.bouquet, 'Sport');
    assert.equal(sport.found, true);
    const unknown = await getFavorites(client, 'Kids');
    assert.equal(unknown.bouquet, 'Favourites (TV)');
    assert.equal(unknown.found, false);

    assert.deepEqual(await setVolume(client, 140), { volume: 100, muted: false });
    await assert.rejects(
      zap(client, '1:0:1:0:0:0:0:0:0:0:'),
      /Channel change refused by the receiver: Invalid service/,
    );
  } finally {
    await receiver.close();
  }
});

test('errors say what failed, never with the credentials', async () => {
  const receiver = await startFakeReceiver({ auth: { username: 'root', password: 'hunter2' } });
  try {
    const refused = new OpenWebifClient({ url: receiver.url, password: 'nope' });
    const err = await refused.get('/api/about').catch((e) => e);
    assert.ok(err instanceof OpenWebifError);
    assert.equal(err.kind, 'auth');
    assert.ok(!err.message.includes('nope'));

    const notFound = await new OpenWebifClient({ url: receiver.url, password: 'hunter2' })
      .get('/api/nothing')
      .catch((e) => e);
    assert.equal(notFound.kind, 'http');
    assert.equal(notFound.status, 404);

    receiver.offline = true;
    const down = await new OpenWebifClient({ url: receiver.url, password: 'hunter2' })
      .get('/api/statusinfo')
      .catch((e) => e);
    assert.equal(down.kind, 'unreachable');
    assert.ok(!down.message.includes('hunter2'));
  } finally {
    await receiver.close();
  }
});

test('a receiver that does not answer in time is a timeout', async () => {
  const server = http.createServer(() => {}); // never answers
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new OpenWebifClient({
      url: `http://127.0.0.1:${server.address().port}`,
      timeoutMs: 50,
    });
    const err = await client.get('/api/statusinfo').catch((e) => e);
    assert.equal(err.kind, 'timeout');
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('an answer that is not JSON is refused', async () => {
  const server = http.createServer((req, res) => res.end('<html>login</html>'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new OpenWebifClient({ url: `http://127.0.0.1:${server.address().port}` });
    const err = await client.get('/api/statusinfo').catch((e) => e);
    assert.equal(err.kind, 'invalid');
  } finally {
    server.close();
  }
});
