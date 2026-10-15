# OpenWebif fixtures

Answers of the OpenWebif API (`http://<receiver>/api/...`) used by the tests.

| File                                                      | Source                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `about-gigablue-openatv.json`, `about-no-mac.json`        | Real answers of a GigaBlue UHD Quad 4K (openATV 7.5, OWIF 2.2.0), from the tests of the Home Assistant `enigma2` integration (Apache-2.0). Anonymized: MAC address invented, IPv4 addresses moved to 192.0.2.x, IPv6 to 2001:db8::/32. |
| `statusinfo-on.json`, `statusinfo-standby.json`           | Same source, unchanged (they hold no address).                                                                                                                                                                                         |
| `getcurrent.json`, `getcurrent-no-epg.json`               | Written in the format of OpenWebif `getcurrent` (an `info`, a `now` and a `next` event), for the channel of `statusinfo-on.json`.                                                                                                      |
| `bouquets-tv.json`, `getservices-*.json`                  | Written in the format of OpenWebif `bouquets` and `getservices`, with a marker and a sub-bouquet as real bouquets have.                                                                                                                |
| `vol.json`, `powerstate.json`, `zap.json`, `message.json` | The command answers documented by OpenWebif (`result` plus a message or the new value).                                                                                                                                                |

`test/helpers/fakeOpenWebif.js` serves them over HTTP, with a live state (standby, volume, channel).
