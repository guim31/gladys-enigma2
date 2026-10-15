# Enigma2 for Gladys Assistant

Control your **Enigma2 receivers** (VU+, Dreambox, Zgemma, Octagon, GigaBlue,
Edision…) from [Gladys Assistant](https://gladysassistant.com), over your local
network, through their **OpenWebif** web interface.

> **Developed without the hardware: feedback welcome.** The integration was
> built and tested against documented OpenWebif answers and real answers
> published by the Home Assistant `enigma2` integration and openwebifpy — not
> against a real receiver. Tell what works and what does not on the
> [Gladys forum](https://community.gladysassistant.com) or in the
> [issues](https://github.com/guim31/gladys-enigma2/issues).

## Features

- **One device per receiver** (up to three), in the television category of
  Gladys: power (on / standby), volume, volume up / down, mute, next /
  previous / last channel, channel number, favourite channels list.
- **What is on screen**, as texts: current channel, current and next
  programme (from the receiver's programme guide), and whether a recording
  runs.
- **Scene actions**: _show a message on the TV_ (information, warning or
  alert, for a number of seconds — the doorbell rang) and _switch to a
  channel_ (by number or name, from the favourites bouquet).
- **Dashboard widget**: channel and programmes on screen, volume, state,
  recording and sound, with power, channel − / + and mute buttons.
- **Test the receivers** button in the Configuration screen.
- Every text in English, French, German and Spanish.

No scene trigger: every change a scene may wait for (switched on, channel,
recording) is a device state the scene editor already offers.

## Requirements

- Gladys Assistant **5.1.0** or later.
- A receiver running an Enigma2 image (openATV, OpenPLi, OpenViX, VTi,
  Dreambox OS…) with the **OpenWebif** plugin enabled, reachable from Gladys.
- Its user (usually `root`) and password if OpenWebif asks for a login.

## Installation

In Gladys: **Integrations → Install from GitHub**, enter
`https://github.com/guim31/gladys-enigma2`, then fill the **Configuration**
tab (address of each receiver, with `https://` and `:port` if needed), press
**Test the receivers**, and add the receivers from the **Discovery** tab.
The full user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)).

## How it works

- The receivers are read through the OpenWebif HTTP API: `/api/about`
  (identity: the MAC address is the device id), `/api/statusinfo` (standby,
  volume, channel, recording), `/api/getcurrent` (current and next programme),
  `/api/bouquets` and `/api/getservices` (favourites bouquet); commands go
  through `/api/powerstate` (wake-up 4 / standby 5, never deep standby),
  `/api/vol`, `/api/zap`, `/api/remotecontrol` and `/api/message`.
- The integration polls by itself, every 10 s, 30 s or 1 min: Gladys 5.2.x
  does not poll external devices reliably (GladysAssistant/Gladys#3198). The
  core's poll is kept as a fallback. Only the changes are published, plus a
  heartbeat every six hours.
- The identity of each receiver is remembered in `/data`
  (`enigma2-receivers.json`: slot, address, MAC, brand, model — never a
  password), so a receiver in deep standby keeps its device after a restart.
- No dependency besides the Gladys SDK: HTTP through `node:http` / `node:https`.

## Limitations

- Developed without the hardware (see above).
- Up to three receivers; TV bouquets only, 200 channels at most.
- A receiver in deep standby cannot be woken up over the network.
- No automatic discovery: the container runs on a bridge network, and the
  receivers do not announce OpenWebif in a way the core relays.
- No picon, no screenshot, no timer management.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run the integration on the fake Gladys of the SDK
(`@gladysassistant/integration-sdk/testing`) against fake receivers on
127.0.0.1 (`test/helpers/fakeOpenWebif.js`), built from the fixtures of
`test/fixtures/openwebif/`. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

To check a real receiver from a machine of its network, read-only (nothing is
changed on the receiver, no password is printed):

```bash
node scripts/probe.mjs 192.168.1.20
OPENWEBIF_USER=root OPENWEBIF_PASSWORD=... node scripts/probe.mjs https://192.168.1.20 --insecure
```

Versions are published by the **Release** workflow (Actions → Release), which
bumps `package.json`, the manifest and the image tag together. Pushing a tag by
hand is possible only after bumping those three to the same version.

## Credits

- [OpenWebif](https://github.com/E2OpenPlugins/e2openplugin-OpenWebif) and its
  API documentation.
- [openwebifpy](https://github.com/autinerd/openwebifpy) by Finbarr Brady,
  autinerd and contributors (MIT): the calls and their reading (power states,
  message types, bouquet loading).
- Home Assistant's
  [`enigma2`](https://github.com/home-assistant/core/tree/dev/homeassistant/components/enigma2)
  integration (Apache-2.0): the choice of features, and the real `about` and
  `statusinfo` answers reused (anonymized) as test fixtures.
- The architecture and the conformity tests follow
  [gladys-wled](https://github.com/guim31/gladys-wled),
  [gladys-pihole](https://github.com/guim31/gladys-pihole) and
  [gladys-subsonic](https://github.com/guim31/gladys-subsonic).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by any receiver
manufacturer (VU+, Dream Property, Zgemma, Octagon, GigaBlue, Edision…) nor by
the Enigma2 or OpenWebif projects. The brands belong to their owners.

## License

Apache-2.0 (see [LICENSE](LICENSE)).
