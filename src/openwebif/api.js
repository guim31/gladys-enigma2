// -----------------------------------------------------------------------------
// The OpenWebif calls the integration makes, and the reading of their answers.
//
// The answers are taken as OpenWebif gives them (documented in the OpenWebif
// wiki, and in the fixtures of openwebifpy and of the Home Assistant enigma2
// integration): booleans that are sometimes the strings "true"/"false",
// "N/A" for a missing programme, markers mixed with channels in a bouquet.
// The parse* functions are pure, and tested on those fixtures.
// -----------------------------------------------------------------------------

import { OpenWebifError } from './client.js';

// /api/powerstate `newstate` values (OpenWebif): 4 wakes up, 5 goes to
// standby. Deep standby (1) is never sent: the receiver then stops answering
// and only its remote can wake it up.
export const POWER_STATE = { WAKEUP: 4, STANDBY: 5 };

// /api/message `type` values.
export const MESSAGE_TYPE = { info: 1, warning: 2, error: 3 };

// Linux input key codes understood by /api/remotecontrol.
export const KEY = { CHANNEL_UP: 402, CHANNEL_DOWN: 403 };

// At most this many channels of the bouquet are offered in the channel list.
export const MAX_CHANNELS = 200;

const isTrue = (value) => value === true || value === 'true';

/** A programme title, or null when OpenWebif has none ("", "N/A"). */
function title(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text && text !== 'N/A' ? text : null;
}

const finiteOrNull = (value) => {
  const number = Number(value);
  return value !== null && value !== '' && Number.isFinite(number) ? number : null;
};

/**
 * /api/about → identity of the receiver.
 * @returns {{ mac: string|null, brand: string|null, model: string|null, boxtype: string|null,
 *   webif: string|null, image: string|null }}
 */
export function parseAbout(answer) {
  const info = answer?.info ?? {};
  const ifaces = Array.isArray(info.ifaces) ? info.ifaces : [];
  const mac = ifaces.map((iface) => normalizeMac(iface?.mac)).find((value) => value !== null);
  const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    mac: mac ?? null,
    brand: text(info.brand),
    model: text(info.model),
    boxtype: text(info.boxtype),
    webif: text(info.webifver),
    image:
      [text(info.friendlyimagedistro) ?? text(info.imagedistro), text(info.imagever)]
        .filter(Boolean)
        .join(' ') || null,
  };
}

/** `12:34:56:78:90:AB` → `1234567890ab`; null for anything else. */
export function normalizeMac(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const hex = value.toLowerCase().replace(/[^0-9a-f]/g, '');
  return hex.length === 12 && hex !== '000000000000' ? hex : null;
}

/**
 * /api/statusinfo → the live state.
 */
export function parseStatus(answer) {
  const source = answer ?? {};
  const standby = isTrue(source.inStandby);
  const serviceRef =
    typeof source.currservice_serviceref === 'string' && source.currservice_serviceref
      ? source.currservice_serviceref
      : null;
  const volume = finiteOrNull(source.volume);
  return {
    standby,
    recording: isTrue(source.isRecording),
    volume: volume === null ? null : Math.max(0, Math.min(100, Math.round(volume))),
    muted: source.muted === undefined ? null : isTrue(source.muted),
    serviceRef,
    // A recording played back has a file reference (1:0:0:...:/media/...).
    playback: serviceRef !== null && /^1:0:0:/.test(serviceRef),
    channel: title(source.currservice_station),
    now: title(source.currservice_name)
      ? {
          title: title(source.currservice_name),
          begin: finiteOrNull(source.currservice_begin_timestamp),
          end: finiteOrNull(source.currservice_end_timestamp),
        }
      : null,
  };
}

/** One EPG event of /api/getcurrent, or null. */
function parseEvent(event) {
  if (!event || !title(event.title)) {
    return null;
  }
  const begin = finiteOrNull(event.begin_timestamp);
  const duration = finiteOrNull(event.duration_sec);
  return {
    title: title(event.title),
    begin,
    end: begin !== null && duration !== null ? begin + duration : null,
  };
}

/** /api/getcurrent → the current and next programmes of the channel. */
export function parseCurrent(answer) {
  return { now: parseEvent(answer?.now), next: parseEvent(answer?.next) };
}

/** /api/bouquets → `[{ ref, name }]`. */
export function parseBouquets(answer) {
  const list = Array.isArray(answer?.bouquets) ? answer.bouquets : [];
  return list
    .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && entry[0])
    .map(([ref, name]) => ({ ref, name: typeof name === 'string' ? name.trim() : ref }));
}

/**
 * The service reference flags (second field): 1 directory (a sub-bouquet),
 * 64 marker (a separator line). Neither can be zapped to.
 */
function isPlayable(ref) {
  const flags = Number(ref.split(':')[1]);
  return Number.isInteger(flags) && (flags & (1 | 64)) === 0;
}

/** /api/getservices → the channels of a bouquet, `[{ ref, name }]`, markers left out. */
export function parseServices(answer) {
  const list = Array.isArray(answer?.services) ? answer.services : [];
  const seen = new Set();
  const channels = [];
  for (const service of list) {
    const ref = service?.servicereference;
    const name = typeof service?.servicename === 'string' ? service.servicename.trim() : '';
    if (typeof ref !== 'string' || !ref || !name || !isPlayable(ref) || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    channels.push({ ref, name });
    if (channels.length >= MAX_CHANNELS) {
      break;
    }
  }
  return channels;
}

/** A command answer: `{ result: true, ... }`, anything else is a refusal. */
function checkResult(answer, what) {
  if (answer?.result !== true && answer?.result !== 'true') {
    const reason =
      typeof answer?.message === 'string' && answer.message ? `: ${answer.message}` : '';
    throw new OpenWebifError('refused', `${what} refused by the receiver${reason}`);
  }
  return answer;
}

// --- Calls -------------------------------------------------------------------

export const getAbout = async (client) => parseAbout(await client.get('/api/about'));

export const getStatus = async (client) => parseStatus(await client.get('/api/statusinfo'));

export const getCurrent = async (client) => parseCurrent(await client.get('/api/getcurrent'));

/**
 * The channels of the favourites bouquet: the TV bouquet named `bouquet`
 * (case-insensitive, or its reference), the first one when empty or unknown.
 * @returns {Promise<{ bouquet: string|null, found: boolean, channels: Array<{ref, name}> }>}
 */
export async function getFavorites(client, bouquet = '') {
  const bouquets = parseBouquets(await client.get('/api/bouquets', { stype: 'tv' }));
  if (bouquets.length === 0) {
    return { bouquet: null, found: bouquet === '', channels: [] };
  }
  const wanted = bouquet.trim().toLowerCase();
  const match = wanted
    ? bouquets.find((b) => b.name.toLowerCase() === wanted || b.ref.toLowerCase() === wanted)
    : null;
  const chosen = match ?? bouquets[0];
  const channels = parseServices(await client.get('/api/getservices', { sRef: chosen.ref }));
  return { bouquet: chosen.name, found: !wanted || Boolean(match), channels };
}

export async function setPower(client, on) {
  checkResult(
    await client.get('/api/powerstate', {
      newstate: on ? POWER_STATE.WAKEUP : POWER_STATE.STANDBY,
    }),
    'Power',
  );
}

/** @param {number|'up'|'down'|'mute'} value a level 0-100, or a step */
export async function setVolume(client, value) {
  const set =
    typeof value === 'number' ? `set${Math.max(0, Math.min(100, Math.round(value)))}` : value;
  const answer = checkResult(await client.get('/api/vol', { set }), 'Volume');
  return {
    volume: finiteOrNull(answer.current),
    muted: answer.ismute === undefined ? null : isTrue(answer.ismute),
  };
}

export async function zap(client, ref) {
  checkResult(await client.get('/api/zap', { sRef: ref }), 'Channel change');
}

export async function pressKey(client, code) {
  checkResult(await client.get('/api/remotecontrol', { command: code }), 'Remote key');
}

/**
 * Show a message on the TV screen.
 * @param {string} text
 * @param {'info'|'warning'|'error'} type
 * @param {number} timeout seconds; 0 keeps it until dismissed with the remote
 */
export async function showMessage(client, text, type, timeout) {
  checkResult(
    await client.get('/api/message', {
      text,
      type: MESSAGE_TYPE[type] ?? MESSAGE_TYPE.info,
      timeout: timeout > 0 ? timeout : -1,
    }),
    'Message',
  );
}
