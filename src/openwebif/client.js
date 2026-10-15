// -----------------------------------------------------------------------------
// HTTP client of the OpenWebif API (`http(s)://<receiver>/api/...`), built on
// node:http / node:https: no dependency, and per-request control of the TLS
// check (receivers serve self-signed certificates).
//
// One request at a time per receiver: the web server of a set-top box is
// small, and the integration never needs parallel calls to the same one.
// The credentials travel in the Authorization header only, never in a URL, a
// log line or an error message.
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';
import { hostOf } from '../config.js';

export const REQUEST_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// The account of every Enigma2 image: used when only a password is typed.
export const DEFAULT_USERNAME = 'root';

/** A failed call. `kind`: auth | unreachable | timeout | http | invalid. */
export class OpenWebifError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = 'OpenWebifError';
    this.kind = kind;
    this.status = status;
  }
}

export class OpenWebifClient {
  /**
   * @param {object} options
   * @param {string} options.url `http(s)://host[:port]`
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {boolean} [options.allowSelfSigned]
   * @param {number} [options.timeoutMs]
   */
  constructor({ url, username = '', password = '', allowSelfSigned = false, timeoutMs }) {
    this.url = url;
    this.host = hostOf(url);
    this.allowSelfSigned = allowSelfSigned;
    this.timeoutMs = timeoutMs ?? REQUEST_TIMEOUT_MS;
    const user = username || (password ? DEFAULT_USERNAME : '');
    this.authorization = user
      ? `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
      : null;
    this.queue = Promise.resolve();
  }

  /**
   * GET an API path and parse its JSON answer.
   * @param {string} path e.g. `/api/statusinfo`
   * @param {Record<string, string|number>} [params] query string
   * @returns {Promise<any>}
   */
  get(path, params = {}) {
    const run = this.queue.then(() => this.request(path, params));
    // The next call waits for this one, whatever its outcome.
    this.queue = run.catch(() => {});
    return run;
  }

  request(path, params) {
    const target = new URL(path, this.url);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, String(value));
    }
    const isHttps = target.protocol === 'https:';
    const transport = isHttps ? https : http;
    const headers = { Accept: 'application/json' };
    if (this.authorization) {
      headers.Authorization = this.authorization;
    }
    const where = `${this.host}${path}`;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        target,
        {
          method: 'GET',
          headers,
          timeout: this.timeoutMs,
          ...(isHttps ? { rejectUnauthorized: !this.allowSelfSigned } : {}),
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
              req.destroy(new OpenWebifError('invalid', `${where}: answer too large`));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            if (res.statusCode === 401 || res.statusCode === 403) {
              reject(
                new OpenWebifError('auth', `${where}: access refused (HTTP ${res.statusCode})`),
              );
              return;
            }
            if (res.statusCode !== 200) {
              reject(
                new OpenWebifError('http', `${where}: HTTP ${res.statusCode}`, res.statusCode),
              );
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
              reject(new OpenWebifError('invalid', `${where}: not an OpenWebif JSON answer`));
            }
          });
          res.on('error', (err) => reject(networkError(where, err)));
        },
      );
      req.on('timeout', () => {
        req.destroy(
          new OpenWebifError('timeout', `${where}: no answer within ${this.timeoutMs} ms`),
        );
      });
      req.on('error', (err) => reject(networkError(where, err)));
      req.end();
    });
  }
}

function networkError(where, err) {
  if (err instanceof OpenWebifError) {
    return err;
  }
  if (/certificate|self[- ]signed|SSL|TLS/i.test(`${err.code} ${err.message}`)) {
    return new OpenWebifError('unreachable', `${where}: TLS certificate refused (${err.code})`);
  }
  // The code alone (ECONNREFUSED, EHOSTUNREACH...): the message may repeat the URL.
  return new OpenWebifError('unreachable', `${where}: ${err.code ?? 'network error'}`);
}
