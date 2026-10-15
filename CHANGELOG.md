# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-15

### Added

- Enigma2 receivers (VU+, Dreambox, Zgemma, Octagon, GigaBlue…) through their
  OpenWebif interface, up to three, with optional user, password and HTTPS.
- One device per receiver, known by its MAC address: power (on / standby),
  volume, volume up / down, mute, next / previous / last channel, channel
  number, favourite channels list, current channel, current and next
  programme, recording in progress.
- Scene actions: show a message on the TV (information, warning or alert, for
  a number of seconds) and switch to a channel by number or name.
- Dashboard widget: channel and programmes on screen, volume, state,
  recording, sound, and power, channel − / + and mute buttons.
- "Test the receivers" button in the Configuration screen.
- The receivers are read by the integration itself every 10 s, 30 s or 1 min;
  a receiver in deep standby keeps its device after a restart.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/guim31/gladys-enigma2/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-enigma2/releases/tag/v1.0.1
