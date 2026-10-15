// -----------------------------------------------------------------------------
// A receiver → its Gladys device, and its states.
//
// One device per receiver, in the `television` category the Gladys dashboard
// renders: power (on / standby), volume slider, remote keys as push buttons,
// channel number. The rest, which the television category has no type for,
// uses the generic types: the favourites list as a dynamic select
// (`text/select`, the channel references as values), the channel and
// programme names as texts, the recording as a binary input.
//
// The feature keys and categories are forever (external ids): never rename
// one, never move one to another device.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORY,
  DEVICE_FEATURE_TYPES as TYPE,
  DEVICE_FEATURE_UNITS as UNIT,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { NAMES, TEXT, langOf } from './i18n.js';

export const DEVICE_TYPE = 'receiver';

export const FEATURE = {
  POWER: 'power',
  VOLUME: 'volume',
  VOLUME_UP: 'volume_up',
  VOLUME_DOWN: 'volume_down',
  MUTE: 'mute',
  CHANNEL_UP: 'channel_up',
  CHANNEL_DOWN: 'channel_down',
  CHANNEL_PREVIOUS: 'channel_previous',
  CHANNEL_NUMBER: 'channel_number',
  CHANNEL_LIST: 'channel_list',
  CHANNEL_NAME: 'channel_name',
  PROGRAM_NOW: 'program_now',
  PROGRAM_NEXT: 'program_next',
  RECORDING: 'recording',
};

// The highest channel number accepted: the position in the favourites bouquet.
// A fixed bound, so a bouquet growing never changes the device structure.
export const MAX_CHANNEL_NUMBER = 9999;

// Longest text published as a state.
const MAX_TEXT = 200;

const push = (type) => ({
  category: CATEGORY.TELEVISION,
  type,
  read_only: false,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 1,
});

const text = () => ({
  category: CATEGORY.TEXT,
  type: TYPE.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  // NOT NULL in the core: without them, "Add to Gladys" fails with a 422.
  min: 0,
  max: 0,
});

// Feature key → its definition (name aside).
const FEATURES = {
  [FEATURE.POWER]: {
    category: CATEGORY.TELEVISION,
    type: TYPE.TELEVISION.BINARY,
    read_only: false,
    has_feedback: true,
    keep_history: true,
    min: 0,
    max: 1,
  },
  [FEATURE.VOLUME]: {
    category: CATEGORY.TELEVISION,
    type: TYPE.TELEVISION.VOLUME,
    unit: UNIT.PERCENT,
    read_only: false,
    has_feedback: true,
    keep_history: false,
    min: 0,
    max: 100,
  },
  [FEATURE.VOLUME_UP]: push(TYPE.TELEVISION.VOLUME_UP),
  [FEATURE.VOLUME_DOWN]: push(TYPE.TELEVISION.VOLUME_DOWN),
  [FEATURE.MUTE]: push(TYPE.TELEVISION.VOLUME_MUTE),
  [FEATURE.CHANNEL_UP]: push(TYPE.TELEVISION.CHANNEL_UP),
  [FEATURE.CHANNEL_DOWN]: push(TYPE.TELEVISION.CHANNEL_DOWN),
  [FEATURE.CHANNEL_PREVIOUS]: push(TYPE.TELEVISION.CHANNEL_PREVIOUS),
  [FEATURE.CHANNEL_NUMBER]: {
    category: CATEGORY.TELEVISION,
    type: TYPE.TELEVISION.CHANNEL,
    read_only: false,
    has_feedback: true,
    keep_history: false,
    min: 1,
    max: MAX_CHANNEL_NUMBER,
  },
  [FEATURE.CHANNEL_LIST]: {
    category: CATEGORY.TEXT,
    type: TYPE.TEXT.SELECT,
    read_only: false,
    has_feedback: true,
    keep_history: false,
    min: 0,
    max: 0,
  },
  [FEATURE.CHANNEL_NAME]: text(),
  [FEATURE.PROGRAM_NOW]: text(),
  [FEATURE.PROGRAM_NEXT]: text(),
  [FEATURE.RECORDING]: {
    category: CATEGORY.INPUT,
    type: TYPE.INPUT.BINARY,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    min: 0,
    max: 1,
  },
};

export const FEATURE_KEYS = Object.keys(FEATURES);

/** The ids of one receiver, from its MAC address. */
export const receiverIds = (gladys, mac) => gladys.externalIds(DEVICE_TYPE, mac);

/** The device name: the one typed by the user, else brand and model. */
export function deviceName(receiver, identity) {
  if (receiver.name) {
    return receiver.name;
  }
  const model = [identity.brand, identity.model].filter(Boolean).join(' ');
  return model || `Enigma2 ${identity.host ?? ''}`.trim();
}

/**
 * @param {object} gladys
 * @param {object} options
 * @param {{ slot: number, name: string|null }} options.receiver the config slot
 * @param {{ mac: string, brand?: string, model?: string, host: string }} options.identity
 * @param {Array<{ ref: string, name: string }>} options.channels the favourites bouquet
 * @param {string} options.language feature names
 */
export function buildDevice(gladys, { receiver, identity, channels = [], language }) {
  const ids = receiverIds(gladys, identity.mac);
  const names = NAMES[langOf(language)];
  return {
    name: deviceName(receiver, identity),
    external_id: ids.device,
    model: [identity.brand, identity.model].filter(Boolean).join(' ') || 'Enigma2',
    // The container polls by itself (src/hub.js): the core's poll, when it
    // happens, is a fallback (GladysAssistant/Gladys#3198).
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    params: [{ name: 'host', value: identity.host }],
    features: FEATURE_KEYS.map((key) => {
      const feature = { name: names[key], external_id: ids.feature(key), ...FEATURES[key] };
      if (key === FEATURE.CHANNEL_LIST && channels.length > 0) {
        feature.supported_options = channels.map((channel, index) => ({
          value: channel.ref,
          label: channel.name,
          sort_order: index,
        }));
      }
      return feature;
    }),
  };
}

/** `HH:MM` in the time zone of Gladys (TZ, injected by the supervisor). */
export function formatTime(epochSeconds, language) {
  if (!Number.isFinite(epochSeconds)) {
    return null;
  }
  const options = { hour: '2-digit', minute: '2-digit', hour12: false };
  let format;
  try {
    format = new Intl.DateTimeFormat(langOf(language), {
      ...options,
      timeZone: process.env.TZ || undefined,
    });
  } catch {
    format = new Intl.DateTimeFormat(langOf(language), options);
  }
  return format.format(new Date(epochSeconds * 1000));
}

/** `20:00–20:45 Title`, the times when known. */
export function formatProgram(program, language) {
  if (!program) {
    return null;
  }
  const begin = formatTime(program.begin, language);
  const end = formatTime(program.end, language);
  const times = begin && end ? `${begin}–${end} ` : begin ? `${begin} ` : '';
  return `${times}${program.title}`.slice(0, MAX_TEXT);
}

/**
 * The states of a receiver, from what was read on it.
 * @param {object} ids receiverIds()
 * @param {object} snapshot
 * @param {boolean} snapshot.reachable
 * @param {object} [snapshot.status] parseStatus()
 * @param {object} [snapshot.programs] parseCurrent(), when read
 * @param {Array<{ref, name}>} channels favourites bouquet
 * @param {string} language
 * @returns {Array<{ device_feature_external_id: string, state?: number, text?: string }>}
 */
export function receiverStates(ids, { reachable, status, programs }, channels, language) {
  const t = TEXT[langOf(language)];
  const id = (key) => ids.feature(key);
  const value = (key, state) => ({ device_feature_external_id: id(key), state });
  const words = (key, text) => ({
    device_feature_external_id: id(key),
    // Never empty: the core ignores an empty text.
    text: (text || t.none).slice(0, MAX_TEXT),
  });

  if (!reachable || !status) {
    // Off, in deep standby or cut from the network: nothing is on screen.
    return [
      value(FEATURE.POWER, 0),
      words(FEATURE.CHANNEL_NAME, t.unreachable),
      words(FEATURE.PROGRAM_NOW, t.none),
      words(FEATURE.PROGRAM_NEXT, t.none),
    ];
  }

  const states = [value(FEATURE.POWER, status.standby ? 0 : 1)];
  if (status.volume !== null) {
    states.push(value(FEATURE.VOLUME, status.volume));
  }
  states.push(value(FEATURE.RECORDING, status.recording ? 1 : 0));

  if (status.standby) {
    states.push(
      words(FEATURE.CHANNEL_NAME, t.standby),
      words(FEATURE.PROGRAM_NOW, t.none),
      words(FEATURE.PROGRAM_NEXT, t.none),
    );
    return states;
  }

  const now = programs?.now ?? status.now;
  states.push(
    words(FEATURE.CHANNEL_NAME, status.playback ? t.recordingPlayback : status.channel),
    words(FEATURE.PROGRAM_NOW, formatProgram(now, language) ?? t.noProgram),
    words(FEATURE.PROGRAM_NEXT, formatProgram(programs?.next, language) ?? t.none),
  );

  // Number and list only for a channel of the favourites: a select cannot
  // show a value it does not offer.
  const index = channels.findIndex((channel) => channel.ref === status.serviceRef);
  if (index >= 0) {
    states.push(value(FEATURE.CHANNEL_NUMBER, index + 1), {
      device_feature_external_id: id(FEATURE.CHANNEL_LIST),
      text: channels[index].ref,
    });
  }
  return states;
}
