// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Up to three receivers, each in its own slot (address, user, password, name).
// The slot only says where to reach a receiver: its identity in Gladys is the
// MAC address it reports (see src/hub.js), so moving a receiver to another
// slot, or changing its address, keeps the device and its history.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const SLOTS = [1, 2, 3];

// Refresh intervals offered in the configuration, in seconds.
export const REFRESH_INTERVALS = ['10', '30', '60'];

export const DEFAULT_CONFIG = {
  receiver_1_address: '',
  receiver_1_username: '',
  receiver_1_password: '',
  receiver_1_name: '',
  receiver_2_address: '',
  receiver_2_username: '',
  receiver_2_password: '',
  receiver_2_name: '',
  receiver_3_address: '',
  receiver_3_username: '',
  receiver_3_password: '',
  receiver_3_name: '',
  allow_self_signed: false,
  bouquet: '',
  refresh_interval: '30',
  language: 'fr',
};

const MAX_NAME_LENGTH = 40;
const MAX_BOUQUET_LENGTH = 100;

/**
 * Parse the address typed by the user into a base URL: a bare host or IP
 * (`192.0.2.10`, `vuplus:8080`), or the URL copied from the browser
 * (`https://192.0.2.10/`). HTTP by default, the path dropped.
 * @param {unknown} raw
 * @returns {string|null} `http(s)://host[:port]`, null when unusable
 */
export function parseAddress(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return null;
  }
  // Credentials typed in the address would end up in the logs and the device
  // params: they belong to the user and password fields.
  if (url.username || url.password) {
    return null;
  }
  return url.origin;
}

/** Host part shown to the user (no scheme). */
export const hostOf = (url) => url.replace(/^https?:\/\//, '');

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (key) => (typeof source[key] === 'string' ? source[key].trim() : '');
  const pick = (key, list) => {
    const value = source[key] === undefined || source[key] === null ? '' : String(source[key]);
    return list.includes(value) ? value : DEFAULT_CONFIG[key];
  };

  const receivers = [];
  const invalidSlots = [];
  for (const slot of SLOTS) {
    const typed = text(`receiver_${slot}_address`);
    if (!typed) {
      continue;
    }
    const url = parseAddress(typed);
    if (!url) {
      invalidSlots.push(slot);
      continue;
    }
    const password = source[`receiver_${slot}_password`];
    receivers.push({
      slot,
      url,
      username: text(`receiver_${slot}_username`),
      // Passwords are kept as typed: spaces may be part of them.
      password: typeof password === 'string' ? password : '',
      name: text(`receiver_${slot}_name`).slice(0, MAX_NAME_LENGTH) || null,
    });
  }

  return {
    receivers,
    invalidSlots,
    allowSelfSigned: source.allow_self_signed === true || source.allow_self_signed === 'true',
    bouquet: text('bouquet').slice(0, MAX_BOUQUET_LENGTH),
    refreshMs: Number(pick('refresh_interval', REFRESH_INTERVALS)) * 1000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
