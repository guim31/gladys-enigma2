#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only check of a real receiver, with the integration's own client and
// parsers: what the integration would read, and whether it reads it right.
//
//   node scripts/probe.mjs <address> [--insecure]
//   OPENWEBIF_USER=root OPENWEBIF_PASSWORD=... node scripts/probe.mjs https://192.168.1.20 --insecure
//
// Only GET requests that change nothing on the receiver (about, statusinfo,
// getcurrent, bouquets, getservices). Prints no password, no IP address read
// from the receiver, and only the manufacturer half of its MAC address.
// Exit code: 0 when everything was read, 1 otherwise.
// -----------------------------------------------------------------------------

import { parseAddress } from '../src/config.js';
import { OpenWebifClient } from '../src/openwebif/client.js';
import {
  parseAbout,
  parseBouquets,
  parseCurrent,
  parseServices,
  parseStatus,
} from '../src/openwebif/api.js';

const args = process.argv.slice(2);
const address = args.find((arg) => !arg.startsWith('--'));
const url = parseAddress(address);
if (!url) {
  console.error('Usage: node scripts/probe.mjs <address> [--insecure]');
  process.exit(2);
}
const options = {
  url,
  username: process.env.OPENWEBIF_USER ?? '',
  password: process.env.OPENWEBIF_PASSWORD ?? '',
  allowSelfSigned: args.includes('--insecure'),
};
const client = new OpenWebifClient(options);
let failures = 0;

async function step(label, path, params, show) {
  try {
    const answer = await client.get(path, params);
    console.log(`OK   ${label}: ${show(answer)}`);
    return answer;
  } catch (err) {
    failures += 1;
    console.log(`FAIL ${label}: ${err.kind ?? 'error'} — ${err.message}`);
    return null;
  }
}

const maskMac = (mac) => (mac ? `${mac.slice(0, 6).match(/../g).join(':')}:xx:xx:xx` : 'none');

console.log(`Probing ${url} (${options.password ? 'with' : 'without'} credentials)`);

await step('about', '/api/about', {}, (answer) => {
  const about = parseAbout(answer);
  return `${about.brand} ${about.model} (${about.boxtype}), ${about.webif}, ${about.image}, MAC ${maskMac(about.mac)}`;
});

await step('statusinfo', '/api/statusinfo', {}, (answer) => {
  const status = parseStatus(answer);
  return [
    status.standby ? 'standby' : 'on',
    `volume ${status.volume}${status.muted ? ' (muted)' : ''}`,
    status.recording ? 'recording' : 'not recording',
    `channel ${status.channel ?? '-'}`,
    `programme ${status.now?.title ?? '-'}`,
    status.playback ? 'playing a recording' : '',
  ]
    .filter(Boolean)
    .join(', ');
});

await step('getcurrent', '/api/getcurrent', {}, (answer) => {
  const { now, next } = parseCurrent(answer);
  return `now ${now?.title ?? '-'}, next ${next?.title ?? '-'}`;
});

const bouquets = await step('bouquets', '/api/bouquets', { stype: 'tv' }, (answer) => {
  const list = parseBouquets(answer);
  return `${list.length} TV bouquet(s): ${list
    .map((b) => b.name)
    .slice(0, 5)
    .join(', ')}`;
});

const first = bouquets ? parseBouquets(bouquets)[0] : null;
if (first) {
  await step(`getservices "${first.name}"`, '/api/getservices', { sRef: first.ref }, (answer) => {
    const channels = parseServices(answer);
    const raw = Array.isArray(answer?.services) ? answer.services.length : 0;
    return `${channels.length} channel(s) out of ${raw} entries: ${channels
      .slice(0, 5)
      .map((c) => c.name)
      .join(', ')}`;
  });
}

if (options.password) {
  // The refusal path, with a password that cannot be the right one.
  const wrong = new OpenWebifClient({ ...options, password: `${options.password}-probe-wrong` });
  const err = await wrong.get('/api/statusinfo').then(
    () => null,
    (e) => e,
  );
  console.log(
    err?.kind === 'auth'
      ? 'OK   wrong password refused (HTTP 401)'
      : `NOTE wrong password not refused (${err ? err.message : 'accepted: no login required?'})`,
  );
}

console.log(failures === 0 ? 'Everything was read.' : `${failures} call(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
