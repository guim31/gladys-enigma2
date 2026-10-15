// -----------------------------------------------------------------------------
// The receivers, as the integration follows them: identity, favourites,
// polling, commands.
//
// Identity. A receiver is known by the MAC address /api/about reports (the
// external id of its device), remembered under /data with its slot and
// address: a receiver in deep standby does not answer, yet its device keeps
// being published, with the same id, after a restart. A receiver that reports
// no MAC address is known by its address instead.
//
// Polling. The core cannot be trusted to call onPoll (GladysAssistant/Gladys
// #3198: a device keeps the polling fields it was created with), so the hub
// polls by itself, at the configured pace, the receivers whose device the
// user added; the core's onPoll is a fallback, skipped when the timer has
// just polled. One poll is /api/statusinfo, plus /api/getcurrent (programme
// guide) when the receiver is on: two small requests per period. The
// favourites bouquet is read again every hour.
//
// States go through publishChangedStates: only the changes, plus a heartbeat
// so a stable value never looks stale in Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { hostOf } from './config.js';
import {
  FEATURE,
  buildDevice,
  deviceName,
  formatProgram,
  receiverIds,
  receiverStates,
} from './devices.js';
import { MESSAGES, pick } from './i18n.js';
import { createIssueLog } from './issues.js';
import { OpenWebifClient } from './openwebif/client.js';
import {
  KEY,
  getAbout,
  getCurrent,
  getFavorites,
  getStatus,
  pressKey,
  setPower,
  setVolume,
  showMessage,
  zap,
} from './openwebif/api.js';

const logger = createLogger({ name: 'enigma2' });

export const WIDGET_KEY = 'receiver';

// Re-send an unchanged state this often, so it never reads "no recent value".
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
// Read the favourites bouquet again this often.
export const FAVORITES_TTL_MS = 60 * 60 * 1000;
// Failed polls in a row before the receiver is shown off: one lost answer is
// not a receiver switched off.
export const FAILURES_BEFORE_OFF = 2;
// After a command, the state is read again this long after (the receiver
// needs a moment to switch on or zap).
export const AFTER_COMMAND_MS = 1500;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {object} options.store Store or MemoryStore
   * @param {boolean} [options.timers] run the polling timer
   * @param {object} [options.timings] { refreshMs, afterCommandMs } overrides (tests)
   * @param {() => number} [options.now]
   */
  constructor({ gladys, store, timers = true, timings = {}, now = () => Date.now() }) {
    this.gladys = gladys;
    this.store = store;
    this.timers = timers;
    this.timings = timings;
    this.now = now;
    this.config = null;
    /** @type {Map<number, object>} receivers by slot */
    this.entries = new Map();
    this.known = {};
    this.timer = null;
    this.stopped = false;
    this.issues = createIssueLog(logger);
    this.connectionStatus = null;
  }

  get refreshMs() {
    return this.timings.refreshMs ?? this.config?.refreshMs ?? 30000;
  }

  // --- Lifecycle -------------------------------------------------------------

  /** First start, or a new configuration: everything is read again. */
  async start(config) {
    this.stopTimer();
    this.stopped = false;
    this.config = config;
    this.known = (await this.store.load()).receivers ?? {};
    this.entries = new Map(
      config.receivers.map((receiver) => [receiver.slot, this.createEntry(receiver)]),
    );
    logger.info(`${config.receivers.length} receiver(s) configured`);
    await Promise.all([...this.entries.values()].map((entry) => this.identify(entry)));
    await this.publishDevices();
    await this.updateConnectionStatus();
    this.schedule();
    await this.cycle({ force: true });
  }

  /** Gladys came back (reconnection): it may have lost what was published. */
  async resync() {
    await this.publishDevices();
    this.connectionStatus = null;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates();
    await this.cycle({ force: true });
  }

  stop() {
    this.stopped = true;
    this.stopTimer();
    return this.store.flush();
  }

  createEntry(receiver) {
    const config = this.config;
    return {
      slot: receiver.slot,
      receiver,
      host: hostOf(receiver.url),
      client: new OpenWebifClient({
        url: receiver.url,
        username: receiver.username,
        password: receiver.password,
        allowSelfSigned: config.allowSelfSigned,
      }),
      identity: this.knownIdentity(receiver),
      channels: [],
      bouquet: null,
      favoritesAt: null,
      status: null,
      programs: null,
      reachable: null,
      failures: 0,
      authRefused: false,
      currentRef: null,
      previousRef: null,
      lastPolledAt: null,
      inFlight: null,
      webif: null,
      lastError: null,
    };
  }

  /** The identity remembered for this slot, if the address did not change. */
  knownIdentity(receiver) {
    const known = this.known[receiver.slot];
    if (known && known.url === receiver.url && typeof known.mac === 'string') {
      return {
        mac: known.mac,
        brand: known.brand ?? null,
        model: known.model ?? null,
        host: hostOf(receiver.url),
      };
    }
    return null;
  }

  // --- Identity and favourites ----------------------------------------------

  /**
   * Read who the receiver is and its favourites. Errors are logged, not thrown.
   * @returns {Promise<boolean>} whether the identity or the channels changed
   */
  async identify(entry) {
    let changed = false;
    try {
      const about = await getAbout(entry.client);
      const identity = {
        // No MAC reported: the address is the only stable thing left.
        mac: about.mac ?? `host-${entry.host.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        brand: about.brand,
        model: about.model,
        host: entry.host,
      };
      if (entry.identity?.mac !== identity.mac || entry.identity?.model !== identity.model) {
        changed = true;
        logger.info(
          `Receiver ${entry.slot} (${entry.host}): ${deviceName(entry.receiver, identity)}` +
            `${about.webif ? `, ${about.webif}` : ''}${about.image ? `, ${about.image}` : ''}`,
        );
      }
      entry.identity = identity;
      entry.webif = about.webif;
      entry.lastError = null;
      entry.authRefused = false;
      this.remember(entry);
      changed = (await this.readFavorites(entry)) || changed;
    } catch (err) {
      entry.authRefused = err.kind === 'auth';
      entry.lastError = err;
      this.issues.fail(
        `receiver-${entry.slot}`,
        `Receiver ${entry.slot} unreachable: ${err.message}`,
      );
    }
    return changed;
  }

  remember(entry) {
    const { mac, brand, model } = entry.identity;
    const known = this.known[entry.slot];
    if (known?.url === entry.receiver.url && known.mac === mac && known.model === model) {
      return;
    }
    this.known = { ...this.known, [entry.slot]: { url: entry.receiver.url, mac, brand, model } };
    this.store.save({ receivers: this.known });
  }

  /** @returns {Promise<boolean>} whether the channel list changed */
  async readFavorites(entry) {
    try {
      const favorites = await getFavorites(entry.client, this.config.bouquet);
      entry.favoritesAt = this.now();
      if (!favorites.found) {
        this.issues.fail(
          `bouquet-${entry.slot}`,
          `Receiver ${entry.slot}: no TV bouquet named "${this.config.bouquet}", ` +
            `using "${favorites.bouquet}"`,
        );
      } else {
        this.issues.ok(`bouquet-${entry.slot}`, `Receiver ${entry.slot}: bouquet found`);
      }
      const before = JSON.stringify(entry.channels);
      entry.channels = favorites.channels;
      entry.bouquet = favorites.bouquet;
      logger.debug(
        `Receiver ${entry.slot}: ${favorites.channels.length} channel(s) in "${favorites.bouquet}"`,
      );
      return before !== JSON.stringify(entry.channels);
    } catch (err) {
      logger.debug(`Receiver ${entry.slot}: favourites not read (${err.message})`);
      return false;
    }
  }

  // --- Devices ---------------------------------------------------------------

  devices() {
    return [...this.entries.values()]
      .filter((entry) => entry.identity)
      .map((entry) =>
        buildDevice(this.gladys, {
          receiver: entry.receiver,
          identity: entry.identity,
          channels: entry.channels,
          language: this.config.language,
        }),
      );
  }

  async publishDevices() {
    try {
      await this.gladys.publishDiscoveredDevices(this.devices());
    } catch (err) {
      logger.error(`Publishing the devices failed: ${err.message}`);
    }
  }

  /** Scan request: read the receivers again, then publish. */
  async rediscover() {
    await Promise.all([...this.entries.values()].map((entry) => this.identify(entry)));
    await this.publishDevices();
    await this.updateConnectionStatus();
  }

  /** The "Test the receivers" action: read them all again, then report. */
  async test() {
    await this.rediscover();
    return {
      invalidSlots: this.config.invalidSlots,
      receivers: [...this.entries.values()].map((entry) => ({
        slot: entry.slot,
        host: entry.host,
        answered: entry.lastError === null && entry.identity !== null,
        authRefused: entry.authRefused,
        name: entry.identity ? deviceName(entry.receiver, entry.identity) : null,
        webif: entry.webif,
        channels: entry.channels.length,
        bouquet: entry.bouquet,
      })),
    };
  }

  entryByDevice(externalId) {
    return [...this.entries.values()].find(
      (entry) =>
        entry.identity && receiverIds(this.gladys, entry.identity.mac).device === externalId,
    );
  }

  isCreated(entry) {
    const id = receiverIds(this.gladys, entry.identity.mac).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The connection status of the Configuration screen, sent when it changes. */
  async updateConnectionStatus() {
    const entries = [...this.entries.values()];
    let status;
    if (entries.length === 0) {
      status =
        this.config.invalidSlots.length > 0 ? MESSAGES.invalidAddress : MESSAGES.notConfigured;
    } else if (entries.some((entry) => entry.authRefused)) {
      status = MESSAGES.authRefused;
    } else if (this.config.invalidSlots.length > 0) {
      status = MESSAGES.invalidAddress;
    } else if (!entries.some((entry) => entry.identity)) {
      status = MESSAGES.noneReachable;
    } else {
      status = true;
    }
    const key = status === true ? 'ok' : status.en;
    if (key === this.connectionStatus) {
      return;
    }
    this.connectionStatus = key;
    try {
      if (status === true) {
        await this.gladys.setConnectionStatus(true);
      } else {
        await this.gladys.setConnectionStatus(false, status);
      }
    } catch (err) {
      this.connectionStatus = null;
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  // --- Polling -------------------------------------------------------------

  schedule() {
    this.stopTimer();
    if (!this.timers || this.stopped) {
      return;
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        this.schedule();
      }
    }, this.refreshMs);
  }

  stopTimer() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** One cycle: every receiver whose device was added. Never throws. */
  async cycle({ force = false } = {}) {
    if (this.gladys.connected === false) {
      logger.debug('Gladys unreachable: poll skipped');
      return;
    }
    await Promise.all(
      [...this.entries.values()].map((entry) => this.pollEntry(entry, { force }).catch(() => {})),
    );
    await this.updateConnectionStatus();
  }

  /** The core's onPoll: a fallback, skipped while the timer runs. */
  async pollFromCore(device) {
    const entry = this.entryByDevice(device.external_id);
    if (!entry) {
      logger.debug(`onPoll ignored for ${device.external_id}`);
      return;
    }
    await this.pollEntry(entry, { minGap: 0.9 });
  }

  /** The user added (or updated) a device: its states again, now. */
  async onDeviceCreated(device) {
    const entry = this.entryByDevice(device.external_id);
    if (!entry) {
      return;
    }
    // The SDK forgot what it had published for this device: all is sent again.
    await this.pollEntry(entry, { force: true }).catch(() => {});
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /**
   * Poll one receiver, unless it was polled less than `minGap` periods ago.
   * Only the receivers whose device the user added are read: the core drops
   * the states of a device it does not know.
   */
  async pollEntry(entry, { force = false, minGap = 0.5 } = {}) {
    if (entry.inFlight) {
      if (!force) {
        return entry.inFlight;
      }
      await entry.inFlight.catch(() => {});
    }
    if (!entry.identity) {
      // Never answered yet: try again, and publish its device once it does.
      if (await this.identify(entry)) {
        await this.publishDevices();
      }
      if (!entry.identity) {
        return undefined;
      }
    }
    if (!this.isCreated(entry)) {
      return undefined;
    }
    if (
      !force &&
      entry.lastPolledAt !== null &&
      this.now() - entry.lastPolledAt < this.refreshMs * minGap
    ) {
      logger.debug(
        `Receiver ${entry.slot}: polled ${this.now() - entry.lastPolledAt} ms ago, skipped`,
      );
      return undefined;
    }
    entry.lastPolledAt = this.now();
    entry.inFlight = this.readAndPublish(entry);
    try {
      return await entry.inFlight;
    } finally {
      entry.inFlight = null;
    }
  }

  async readAndPublish(entry) {
    const issueKey = `receiver-${entry.slot}`;
    const before = this.widgetSignature(entry);
    try {
      const status = await getStatus(entry.client);
      let programs = null;
      if (!status.standby) {
        // Older OpenWebif versions have no /api/getcurrent: statusinfo still
        // gives the current programme.
        programs = await getCurrent(entry.client).catch((err) => {
          logger.debug(`Receiver ${entry.slot}: no programme guide (${err.message})`);
          return null;
        });
      }
      // One info line when it ends an outage (the issue log knows).
      this.issues.ok(issueKey, `Receiver ${entry.slot} (${entry.host}) answers again`);
      logger.debug(
        `Receiver ${entry.slot}: ${status.standby ? 'standby' : (status.channel ?? 'on')}, ` +
          `volume ${status.volume}${status.muted ? ' (muted)' : ''}` +
          `${status.recording ? ', recording' : ''}`,
      );
      entry.status = status;
      entry.programs = programs;
      entry.reachable = true;
      entry.failures = 0;
      entry.authRefused = false;
      if (status.serviceRef && !status.playback && status.serviceRef !== entry.currentRef) {
        entry.previousRef = entry.currentRef;
        entry.currentRef = status.serviceRef;
      }
      if (entry.favoritesAt === null || this.now() - entry.favoritesAt >= FAVORITES_TTL_MS) {
        if (await this.readFavorites(entry)) {
          await this.publishDevices();
        }
      }
    } catch (err) {
      entry.failures += 1;
      entry.authRefused = err.kind === 'auth';
      this.issues.fail(
        issueKey,
        `Receiver ${entry.slot} (${entry.host}) does not answer: ${err.message}`,
      );
      if (entry.failures < FAILURES_BEFORE_OFF) {
        return;
      }
      entry.reachable = false;
      entry.status = null;
      entry.programs = null;
    }
    await this.publishStates(entry);
    if (this.widgetSignature(entry) !== before) {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  async publishStates(entry) {
    const ids = receiverIds(this.gladys, entry.identity.mac);
    const states = receiverStates(
      ids,
      { reachable: entry.reachable === true, status: entry.status, programs: entry.programs },
      entry.channels,
      this.config.language,
    );
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      this.issues.ok(`publish-${entry.slot}`, `Receiver ${entry.slot}: states accepted again`);
    } catch (err) {
      this.issues.fail(
        `publish-${entry.slot}`,
        `Receiver ${entry.slot}: states refused (${err.message})`,
      );
    }
  }

  /** What the widget shows: a refresh is asked only when it changed. */
  widgetSignature(entry) {
    const { status, programs } = entry;
    return JSON.stringify([
      entry.reachable,
      status?.standby,
      status?.serviceRef,
      status?.recording,
      status?.muted,
      status?.volume,
      programs?.now?.title ?? status?.now?.title,
      programs?.next?.title,
    ]);
  }

  // --- Commands ------------------------------------------------------------

  /** onSetValue: a feature of a receiver device. */
  async setValue(device, feature, value) {
    const entry = this.entryByDevice(device.external_id);
    if (!entry) {
      throw new Error(pick(MESSAGES.unknownReceiver, 'en'));
    }
    const prefix = `${device.external_id}:`;
    const key = feature.external_id.startsWith(prefix)
      ? feature.external_id.slice(prefix.length)
      : null;
    logger.info(`Receiver ${entry.slot}: ${key} = ${value}`);
    await this.runCommand(entry, key, value);
    await this.afterCommand(entry);
  }

  async runCommand(entry, key, value) {
    const client = entry.client;
    switch (key) {
      case FEATURE.POWER:
        return setPower(client, Number(value) === 1);
      case FEATURE.VOLUME:
        return setVolume(client, Number(value));
      case FEATURE.VOLUME_UP:
        return setVolume(client, 'up');
      case FEATURE.VOLUME_DOWN:
        return setVolume(client, 'down');
      case FEATURE.MUTE:
        // A push button: each press toggles the sound.
        return setVolume(client, 'mute');
      case FEATURE.CHANNEL_UP:
        return this.step(entry, 1);
      case FEATURE.CHANNEL_DOWN:
        return this.step(entry, -1);
      case FEATURE.CHANNEL_PREVIOUS:
        if (!entry.previousRef) {
          throw new Error('No previous channel yet');
        }
        return zap(client, entry.previousRef);
      case FEATURE.CHANNEL_NUMBER: {
        const channel = entry.channels[Number(value) - 1];
        if (!channel) {
          throw new Error(`${pick(MESSAGES.unknownChannel, 'en')} (${value})`);
        }
        return zap(client, channel.ref);
      }
      case FEATURE.CHANNEL_LIST: {
        const channel = entry.channels.find((c) => c.ref === String(value));
        if (!channel) {
          throw new Error(pick(MESSAGES.unknownChannel, 'en'));
        }
        return zap(client, channel.ref);
      }
      default:
        throw new Error(`Feature ${key} cannot be controlled`);
    }
  }

  /**
   * Next / previous channel. Inside the favourites bouquet when the current
   * channel belongs to it (whatever menu is open on screen), else the remote
   * key, which follows the receiver's own channel list.
   */
  async step(entry, direction) {
    const index = entry.channels.findIndex((c) => c.ref === entry.status?.serviceRef);
    if (index < 0 || entry.status?.standby) {
      return pressKey(entry.client, direction > 0 ? KEY.CHANNEL_UP : KEY.CHANNEL_DOWN);
    }
    const count = entry.channels.length;
    return zap(entry.client, entry.channels[(index + direction + count) % count].ref);
  }

  /** Read the receiver again shortly after a command, and refresh the widget. */
  async afterCommand(entry) {
    const delay = this.timings.afterCommandMs ?? AFTER_COMMAND_MS;
    const refresh = async () => {
      await this.pollEntry(entry, { force: true }).catch(() => {});
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    };
    if (delay <= 0) {
      await refresh();
      return;
    }
    setTimeout(() => {
      if (!this.stopped) {
        refresh();
      }
    }, delay).unref?.();
  }

  /** The receiver of a device chosen in a scene or a widget, or an error. */
  requireEntry(externalId, language) {
    const entry = typeof externalId === 'string' ? this.entryByDevice(externalId) : null;
    if (!entry) {
      throw new Error(pick(MESSAGES.unknownReceiver, language));
    }
    return entry;
  }

  /** Scene action: a message on the TV screen. */
  async message(externalId, { text, type, timeout }) {
    const language = this.config.language;
    const entry = this.requireEntry(externalId, language);
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) {
      throw new Error(pick(MESSAGES.emptyMessage, language));
    }
    logger.info(`Receiver ${entry.slot}: message (${type}, ${timeout} s)`);
    try {
      await showMessage(entry.client, body.slice(0, 1000), type, timeout);
    } catch (err) {
      throw new Error(`${pick(MESSAGES.receiverUnreachable, language)} ${err.message}`, {
        cause: err,
      });
    }
  }

  /**
   * Scene action: zap to a channel of the favourites, given by its number,
   * its name (case and accents ignored) or its service reference.
   * @returns {Promise<{ channel: object }>}
   */
  async zapTo(externalId, wanted) {
    const language = this.config.language;
    const entry = this.requireEntry(externalId, language);
    if (entry.channels.length === 0) {
      await this.readFavorites(entry);
    }
    const channel = findChannel(entry.channels, wanted);
    if (!channel) {
      throw new Error(
        `${pick(MESSAGES.unknownChannel, language)} (${String(wanted).slice(0, 60)})`,
      );
    }
    logger.info(`Receiver ${entry.slot}: zap to ${channel.name}`);
    await zap(entry.client, channel.ref);
    await this.afterCommand(entry);
    return channel;
  }

  /** Widget: run a remote key on a receiver. */
  async widgetCommand(externalId, key) {
    const entry = this.requireEntry(externalId, 'en');
    logger.info(`Receiver ${entry.slot}: widget ${key}`);
    if (key === FEATURE.POWER) {
      // The button toggles: wake up a receiver in standby, else put it to sleep.
      await setPower(entry.client, entry.status?.standby !== false);
    } else {
      await this.runCommand(entry, key, 1);
    }
    // The core re-pulls the widget as soon as the action resolves: read now.
    await this.pollEntry(entry, { force: true }).catch(() => {});
  }

  /** What the widget shows about a receiver (from the last poll). */
  view(externalId) {
    const entry = typeof externalId === 'string' ? this.entryByDevice(externalId) : null;
    if (!entry) {
      return null;
    }
    const ids = receiverIds(this.gladys, entry.identity.mac);
    return {
      name: deviceName(entry.receiver, entry.identity),
      ids,
      reachable: entry.reachable,
      status: entry.status,
      now: entry.programs?.now ?? entry.status?.now ?? null,
      next: entry.programs?.next ?? null,
      formatProgram,
    };
  }
}

const fold = (text) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** A channel by number, name or reference. */
export function findChannel(channels, wanted) {
  const raw = String(wanted ?? '').trim();
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return channels[Number(raw) - 1] ?? null;
  }
  const byRef = channels.find((c) => c.ref === raw);
  if (byRef) {
    return byRef;
  }
  const name = fold(raw);
  return (
    channels.find((c) => fold(c.name) === name) ??
    channels.find((c) => fold(c.name).startsWith(name)) ??
    null
  );
}
