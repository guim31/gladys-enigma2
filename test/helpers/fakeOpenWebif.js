// -----------------------------------------------------------------------------
// A fake receiver: an HTTP server on 127.0.0.1 answering the OpenWebif API
// from the fixtures (test/fixtures/openwebif), with a live state the commands
// change (standby, volume, mute, channel). Nothing leaves the machine.
// -----------------------------------------------------------------------------

import http from 'node:http';
import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/openwebif/${name}.json`, import.meta.url), 'utf8'));

const FAVOURITES_REF =
  '1:7:1:0:0:0:0:0:0:0:FROM BOUQUET "userbouquet.favourites.tv" ORDER BY bouquet';

/**
 * @param {object} [options]
 * @param {string} [options.about] fixture name of /api/about
 * @param {{ username: string, password: string }} [options.auth] required credentials
 * @param {boolean} [options.getcurrent] false: an older OpenWebif without /api/getcurrent
 */
export async function startFakeReceiver({
  about = 'about-gigablue-openatv',
  auth = null,
  getcurrent = true,
} = {}) {
  const services = fixture('getservices-favourites').services;
  const channels = services.filter((s) => /^1:0:/.test(s.servicereference));
  const receiver = {
    standby: false,
    volume: 100,
    muted: false,
    recording: false,
    ref: '1:0:19:2BA2:3F2:1:C00000:0:0:0:',
    offline: false,
    epg: true,
    requests: [],
    messages: [],
    keys: [],
  };

  const channelName = () =>
    channels.find((s) => s.servicereference === receiver.ref)?.servicename ?? 'Unknown';

  function statusinfo() {
    if (receiver.standby) {
      return {
        ...fixture('statusinfo-standby'),
        volume: receiver.volume,
        muted: receiver.muted,
        isRecording: String(receiver.recording),
      };
    }
    const base = fixture('statusinfo-on');
    const onZdfInfo = receiver.ref === base.currservice_serviceref;
    return {
      ...base,
      volume: receiver.volume,
      muted: receiver.muted,
      isRecording: String(receiver.recording),
      currservice_serviceref: receiver.ref,
      currservice_station: channelName(),
      ...(onZdfInfo && receiver.epg
        ? {}
        : {
            currservice_name: 'N/A',
            currservice_begin_timestamp: '',
            currservice_end_timestamp: '',
          }),
    };
  }

  const routes = {
    '/api/about': () => fixture(about),
    '/api/statusinfo': statusinfo,
    '/api/getcurrent': () => {
      if (!getcurrent) {
        return null;
      }
      const onZdfInfo = receiver.ref === fixture('statusinfo-on').currservice_serviceref;
      return onZdfInfo && receiver.epg ? fixture('getcurrent') : fixture('getcurrent-no-epg');
    },
    '/api/bouquets': () => fixture('bouquets-tv'),
    '/api/getservices': (query) =>
      query.get('sRef') === FAVOURITES_REF
        ? fixture('getservices-favourites')
        : fixture('getservices-sport'),
    '/api/vol': (query) => {
      const set = query.get('set') ?? '';
      if (set === 'up') receiver.volume = Math.min(100, receiver.volume + 5);
      else if (set === 'down') receiver.volume = Math.max(0, receiver.volume - 5);
      else if (set === 'mute') receiver.muted = !receiver.muted;
      else if (/^set\d+$/.test(set)) receiver.volume = Number(set.slice(3));
      return {
        result: true,
        message: 'Volume changed',
        current: receiver.volume,
        ismute: receiver.muted,
      };
    },
    '/api/powerstate': (query) => {
      const state = Number(query.get('newstate'));
      if (state === 4) receiver.standby = false;
      if (state === 5) receiver.standby = true;
      return { result: true, instandby: receiver.standby };
    },
    '/api/zap': (query) => {
      const ref = query.get('sRef');
      if (!channels.some((s) => s.servicereference === ref)) {
        return { result: false, message: 'Invalid service' };
      }
      receiver.ref = ref;
      return { result: true, message: `Active service is now '${channelName()}'` };
    },
    '/api/remotecontrol': (query) => {
      receiver.keys.push(Number(query.get('command')));
      return { result: true, message: 'RC command sent' };
    },
    '/api/message': (query) => {
      receiver.messages.push({
        text: query.get('text'),
        type: Number(query.get('type')),
        timeout: Number(query.get('timeout')),
      });
      return fixture('message');
    },
  };

  const server = http.createServer((req, res) => {
    if (receiver.offline) {
      req.socket.destroy();
      return;
    }
    const url = new URL(req.url, 'http://receiver');
    receiver.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
    if (auth) {
      const expected = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
      if (req.headers.authorization !== expected) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="OpenWebif"' });
        res.end('Unauthorized');
        return;
      }
    }
    const route = routes[url.pathname];
    const body = route ? route(url.searchParams) : null;
    if (body === null) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  receiver.address = `127.0.0.1:${port}`;
  receiver.url = `http://127.0.0.1:${port}`;
  receiver.channels = channels;
  receiver.close = () =>
    new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  /** Requests to a path since the start (or since `reset`). */
  receiver.count = (path) => receiver.requests.filter((r) => r.path === path).length;
  receiver.reset = () => {
    receiver.requests.length = 0;
  };
  return receiver;
}
