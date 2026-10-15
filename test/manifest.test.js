// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES, REFRESH_INTERVALS, SLOTS } from '../src/config.js';
import { MESSAGE_TYPES } from '../src/scenes.js';
import { MemoryStore } from '../src/store.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[...(manifest.actions ?? []), ...(manifest.scene_actions ?? [])].flatMap(
    (item) => item.fields ?? [],
  ),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

/** The handlers the integration registers, by kind. */
function registered() {
  const gladys = createFakeGladys();
  const keys = { action: [], sceneAction: [], widgetGet: [], widgetAction: [] };
  for (const kind of Object.keys(keys)) {
    const method = `on${kind[0].toUpperCase()}${kind.slice(1)}`;
    const original = gladys[method].bind(gladys);
    gladys[method] = (key, handler) => {
      keys[kind].push(key);
      return original(key, handler);
    };
  }
  registerHandlers(gladys, { store: new MemoryStore(), timers: false });
  return keys;
}

const handlers = registered();

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

const isAtLeast = (version, required) => {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
};

test('identity: name, type, catalog category, local transport', () => {
  assert.equal(manifest.name, 'Enigma2');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  assert.equal(manifest.type, 'device');
  assert.deepEqual(manifest.categories, ['multimedia']);
  assert.deepEqual(manifest.transports, ['local']);
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-enigma2:/);
});

test('every manifest action, scene action and widget has its handler, and vice versa', () => {
  assert.deepEqual(handlers.action.sort(), keysOf(manifest.actions).sort());
  assert.deepEqual(handlers.sceneAction.sort(), keysOf(manifest.scene_actions).sort());
  assert.deepEqual(handlers.widgetGet.sort(), keysOf(manifest.widgets).sort());
  assert.deepEqual(handlers.widgetAction.sort(), keysOf(manifest.widgets).sort());
  assert.deepEqual(Object.keys(WIDGETS), keysOf(manifest.widgets));
});

test('the keys are the published ones (forever)', () => {
  assert.deepEqual(keysOf(manifest.actions), ['test_connection']);
  assert.deepEqual(keysOf(manifest.scene_actions), ['show_message', 'zap_channel']);
  assert.deepEqual(keysOf(manifest.widgets), ['receiver']);
  assert.deepEqual(Object.keys(WIDGET_ACTIONS), ['power', 'channel_down', 'channel_up', 'mute']);
  assert.equal(manifest.scene_triggers, undefined, 'no trigger: the device states are enough');
});

test('the scene action fields are the ones the handlers read', () => {
  const [message, zap] = manifest.scene_actions;
  assert.deepEqual(keysOf(message.fields), ['device', 'text', 'message_type', 'duration']);
  assert.deepEqual(
    message.fields.find((f) => f.key === 'message_type').options.map((o) => o.value),
    MESSAGE_TYPES,
  );
  assert.deepEqual(keysOf(zap.fields), ['device', 'channel']);
  assert.deepEqual(keysOf(zap.outputs), ['channel_name']);
  // Integer bounds and default: the number inputs are rendered without step.
  const duration = message.fields.find((f) => f.key === 'duration');
  for (const value of [duration.min, duration.max, duration.default]) {
    assert.ok(Number.isInteger(value));
  }
});

test('capabilities and categories require the right Gladys version', () => {
  assert.ok(isAtLeast(minGladysVersion(), [5, 1, 0]), 'widgets and scene actions need 5.1.0');
  // No widget button opens a form (that needs 5.2.0, Gladys#3168).
  assert.ok(isAtLeast(minGladysVersion(), [4, 86, 0]));
});

test('config_schema defaults and options stay consistent with the code', () => {
  const configKeys = manifest.config_schema.filter((f) => f.type !== 'section').map((f) => f.key);
  assert.deepEqual(configKeys.sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `default of ${field.key}`);
    }
  }
  const options = (key) =>
    manifest.config_schema.find((f) => f.key === key).options.map((o) => o.value);
  assert.deepEqual(options('refresh_interval'), REFRESH_INTERVALS);
  assert.deepEqual(options('language'), LANGUAGES);
  for (const slot of SLOTS) {
    const password = manifest.config_schema.find((f) => f.key === `receiver_${slot}_password`);
    assert.equal(password.type, 'secret');
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamicSelects = allFields.filter((f) => f.source !== undefined);
  assert.ok(dynamicSelects.length >= 3);
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined);
  }
});

test('no secret field in a manifest action (impossible to fill, Gladys#3154)', () => {
  for (const action of manifest.actions) {
    assert.ok((action.fields ?? []).every((f) => f.type !== 'secret'));
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('field placeholders are multi-language objects', () => {
  const withPlaceholder = allFields.filter((f) => f.placeholder !== undefined);
  assert.ok(withPlaceholder.length > 0);
  for (const field of withPlaceholder) {
    assert.equal(typeof field.placeholder, 'object', field.key);
  }
});
