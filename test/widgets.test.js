// -----------------------------------------------------------------------------
// The dashboard widget: contents valid for the core vocabulary and budget
// (validateWidgetContent), bound to features that exist, localized, and its
// buttons acting on the receiver.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createWorld } from './helpers/world.js';

async function content(world, language = 'fr', settings) {
  const ack = await world.fake.widgetGet('receiver', {
    settings: settings ?? { receiver: world.device().external_id },
    language,
  });
  assert.equal(ack.success, true);
  return ack.data.content;
}

const texts = (c) => c.components.filter((x) => x.type === 'text').map((x) => x.text);

test('the widget shows the channel, the programmes, the state and a small remote', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    const c = await content(world);
    assert.deepEqual(validateWidgetContent(c), []);
    assert.deepEqual(texts(c), [
      'ZDFinfo HD',
      '15:30–16:15 Flucht aus Saudi-Arabien\nEnsuite : 16:15–17:00 Terra X History',
    ]);
    const featureIds = new Set(world.device().features.map((f) => f.external_id));
    for (const component of c.components.filter((x) => x.device_feature)) {
      assert.ok(featureIds.has(component.device_feature), `${component.device_feature} exists`);
    }
    const buttons = c.components.filter((x) => x.type === 'button');
    assert.deepEqual(
      buttons.map((b) => b.action.key),
      ['power', 'channel_down', 'channel_up', 'mute'],
    );
    assert.ok(
      buttons.every((b) => b.style !== 'primary'),
      'no state shown by the style',
    );
    for (const language of ['en', 'de', 'es']) {
      assert.deepEqual(validateWidgetContent(await content(world, language)), []);
    }
    const de = await content(world, 'de');
    assert.match(texts(de)[1], /Danach: 16:15/);
  } finally {
    await world.close();
  }
});

test('the widget buttons act on the receiver', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    const settings = { settings: { receiver: world.device().external_id } };
    assert.equal(
      (await world.fake.widgetAction('receiver', 'channel_up', {}, settings)).success,
      true,
    );
    assert.equal(world.receiver.ref, '1:0:19:283E:3FB:1:C00000:0:0:0:');
    await world.fake.widgetAction('receiver', 'mute', {}, settings);
    assert.equal(world.receiver.muted, true);
    await world.fake.widgetAction('receiver', 'power', {}, settings);
    assert.equal(world.receiver.standby, true);
    // Read again before the core re-pulls the widget: it shows standby at once.
    const c = await content(world, 'en');
    assert.deepEqual(validateWidgetContent(c), []);
    assert.equal(texts(c)[0], 'GigaBlue UHD QUAD 4K · Standby');
    assert.deepEqual(
      c.components.filter((x) => x.type === 'button').map((b) => b.action.key),
      ['power'],
    );
    await world.fake.widgetAction('receiver', 'power', {}, settings);
    assert.equal(world.receiver.standby, false);
  } finally {
    await world.close();
  }
});

test('the widget says what is missing: no receiver chosen, unknown, unreachable', async () => {
  const world = await createWorld();
  try {
    await world.createAll();
    const none = await content(world, 'es', {});
    assert.deepEqual(validateWidgetContent(none), []);
    assert.deepEqual(texts(none), ['Elija un receptor en los ajustes del widget.']);

    const unknown = await content(world, 'en', { receiver: 'ext:test-integration:receiver:gone' });
    assert.deepEqual(texts(unknown), ['Unknown receiver: pick one of the integration devices.']);

    world.receiver.offline = true;
    await world.hub.cycle({ force: true });
    await world.hub.cycle({ force: true });
    const down = await content(world, 'de');
    assert.deepEqual(validateWidgetContent(down), []);
    assert.equal(
      down.components.find((x) => x.type === 'status').items[0].value,
      'Nicht erreichbar',
    );
  } finally {
    await world.close();
  }
});
