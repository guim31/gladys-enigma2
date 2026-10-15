// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`): the channel and programme on screen,
// and a small remote (power, channel −/+, mute).
//
// The content is built from the last poll (no request to the receiver), in
// the dashboard language. The volume tile is bound to the volume feature, so
// it follows the states live. Budget of the core: 2 texts, 1 tile, 1 status,
// 4 buttons. A current choice is never shown by the button style (invisible
// in dark mode, Gladys#3153): the state is in the status list.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FEATURE } from './devices.js';
import { WIDGET_KEY } from './hub.js';
import { MESSAGES, TEXT, langOf, pick } from './i18n.js';

export const TTL_SECONDS = 30;

// Widget action key → the receiver command it runs. Keys are forever.
export const WIDGET_ACTIONS = {
  power: FEATURE.POWER,
  channel_down: FEATURE.CHANNEL_DOWN,
  channel_up: FEATURE.CHANNEL_UP,
  mute: FEATURE.MUTE,
};

const heading = (text) => ({ type: 'text', variant: 'heading', text: text.slice(0, 40) });
const sentence = (message, language) => ({
  ttl_seconds: TTL_SECONDS,
  components: [{ type: 'text', variant: 'body', text: pick(message, language) }],
});

/** The content of the widget for one receiver. */
export function buildContent(view, language) {
  const lang = langOf(language);
  const t = TEXT[lang];
  if (!view) {
    return sentence(MESSAGES.unknownReceiver, lang);
  }
  if (view.reachable !== true || !view.status) {
    return {
      ttl_seconds: TTL_SECONDS,
      components: [
        heading(view.name),
        {
          type: 'status',
          items: [
            {
              label: t.state,
              value: view.reachable === false ? t.unreachable : t.none,
              color: WIDGET_COLORS.WARNING,
            },
          ],
        },
      ],
    };
  }

  const { status } = view;
  const components = [];
  if (status.standby) {
    components.push(heading(`${view.name} · ${t.standby}`));
  } else {
    components.push(heading(status.playback ? t.recordingPlayback : (status.channel ?? view.name)));
    const now = view.formatProgram(view.now, lang) ?? t.noProgram;
    const next = view.formatProgram(view.next, lang);
    components.push({
      type: 'text',
      variant: 'body',
      text: (next ? `${now}\n${t.next} ${next}` : now).slice(0, 300),
    });
  }
  components.push({
    type: 'value',
    label: t.volume,
    icon: 'volume-2',
    device_feature: view.ids.feature(FEATURE.VOLUME),
  });
  components.push({
    type: 'status',
    items: [
      {
        label: t.state,
        value: status.standby ? t.standby : t.on,
        color: status.standby ? WIDGET_COLORS.NEUTRAL : WIDGET_COLORS.SUCCESS,
      },
      {
        label: t.recording,
        value: status.recording ? t.yes : t.no,
        color: status.recording ? WIDGET_COLORS.DANGER : WIDGET_COLORS.NEUTRAL,
      },
      ...(status.muted === null
        ? []
        : [
            {
              label: t.muted,
              value: status.muted ? t.soundOff : t.soundOn,
              color: status.muted ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
            },
          ]),
    ],
  });
  components.push({
    type: 'button',
    label: t.power,
    icon: 'power',
    style: 'secondary',
    action: { key: 'power' },
  });
  if (!status.standby) {
    components.push(
      {
        type: 'button',
        label: t.channelDown,
        icon: 'chevron-down',
        style: 'secondary',
        action: { key: 'channel_down' },
      },
      {
        type: 'button',
        label: t.channelUp,
        icon: 'chevron-up',
        style: 'secondary',
        action: { key: 'channel_up' },
      },
      {
        type: 'button',
        label: t.mute,
        icon: 'volume-x',
        style: 'secondary',
        action: { key: 'mute' },
      },
    );
  }
  return { ttl_seconds: TTL_SECONDS, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get(hub, { settings = {}, language }) {
      if (!settings.receiver) {
        return sentence(MESSAGES.chooseReceiver, language);
      }
      return buildContent(hub.view(settings.receiver), language);
    },

    async action(hub, { actionKey, settings = {} }) {
      const command = WIDGET_ACTIONS[actionKey];
      if (!command) {
        throw new Error(`Unknown widget action ${actionKey}`);
      }
      await hub.widgetCommand(settings.receiver, command);
      return undefined;
    },
  },
};
