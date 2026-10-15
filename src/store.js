// -----------------------------------------------------------------------------
// Small persistence under /data (the only writable path of the container): the
// identity (MAC address, brand, model) of each receiver seen so far, by slot
// and address. A receiver in deep standby does not answer: thanks to this
// file, its device is still published after a restart, under the same
// external id. Losing the file is harmless: the next answer rebuilds it.
// No secret is ever written here.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'enigma2-store' });
const FILE_NAME = 'enigma2-receivers.json';

export class Store {
  constructor(directory = process.env.ENIGMA2_DATA_DIR || '/data') {
    this.directory = directory;
    this.path = join(directory, FILE_NAME);
    this.pending = null;
    this.writing = null;
    // A read-only or full /data fails every write: logged once.
    this.issues = createIssueLog(logger);
  }

  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.path}: ${err.message}`);
      }
      return {};
    }
  }

  // Writes are coalesced and atomic (temporary file + rename): a crash never
  // leaves half a JSON file behind.
  save(data) {
    this.latest = data;
    if (!this.pending) {
      // Chained after the write in progress, if any: one writer at a time.
      this.pending = (this.writing ?? Promise.resolve()).then(async () => {
        const snapshot = this.latest;
        this.pending = null;
        try {
          await mkdir(this.directory, { recursive: true });
          const temporary = `${this.path}.tmp`;
          await writeFile(temporary, JSON.stringify(snapshot));
          await rename(temporary, this.path);
          this.issues.ok('write', `${this.path} written again`);
        } catch (err) {
          this.issues.fail('write', `Cannot write ${this.path}: ${err.message}`);
        }
      });
      this.writing = this.pending;
    }
    return this.pending;
  }

  /** Resolves once every write requested so far is on disk. */
  flush() {
    return this.writing ?? Promise.resolve();
  }
}

/** A store kept in memory (tests, or a /data that cannot be used). */
export class MemoryStore {
  constructor(data = {}) {
    this.data = structuredClone(data);
  }

  async load() {
    return structuredClone(this.data);
  }

  async save(data) {
    this.data = structuredClone(data);
  }

  async flush() {}
}
