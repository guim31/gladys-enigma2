// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`). Each receives the
// RESOLVED fields (scene variables substituted, defaults applied, validated
// by the core) and returns the declared outputs.
//
// No scene trigger: everything a scene may wait for (switched on, channel,
// programme, recording) is a state of the receiver device, which the scene
// editor already offers.
// -----------------------------------------------------------------------------

import { MESSAGE_TYPE } from './openwebif/api.js';

export const MESSAGE_TYPES = Object.keys(MESSAGE_TYPE);
export const DEFAULT_DURATION = 10;
export const MAX_DURATION = 300;

export const SCENE_ACTIONS = {
  /** A message on the TV screen: the doorbell rang, the washing is done... */
  async show_message(hub, { fields }) {
    const type = MESSAGE_TYPES.includes(fields.message_type) ? fields.message_type : 'info';
    const duration = Number(fields.duration);
    await hub.message(fields.device, {
      text: fields.text,
      type,
      timeout: Number.isFinite(duration)
        ? Math.max(0, Math.min(MAX_DURATION, Math.round(duration)))
        : DEFAULT_DURATION,
    });
    return undefined;
  },

  /** Switch to a channel of the favourites, by number, name or reference. */
  async zap_channel(hub, { fields }) {
    const channel = await hub.zapTo(fields.device, fields.channel);
    return { channel_name: channel.name };
  },
};
