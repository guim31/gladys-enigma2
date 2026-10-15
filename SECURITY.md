# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Secrets**: the OpenWebif user and password of each receiver live in the
  Gladys configuration of the integration (password fields are `secret`). They
  travel only in the `Authorization` header of the requests to that receiver,
  never in a URL, a log line, an error message or a file. An address typed
  with credentials in it (`http://user:pass@...`) is refused.
- **`/data`**: `enigma2-receivers.json` holds, per configuration slot, the
  address of the receiver, its MAC address, brand and model — no password.
- **Network**: plain HTTP or HTTPS requests from the container to the
  addresses typed in the configuration, on the local network; nothing else,
  no cloud. With HTTPS, the certificate is checked unless "Accept a
  self-signed certificate" is ticked (OpenWebif serves a self-signed one).
- **Commands**: standby / wake-up (never deep standby, never reboot),
  volume, channel change, remote channel keys and on-screen messages. Nothing
  that opens, unlocks or disarms anything.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the receivers, their Enigma2 image and OpenWebif (report to their projects).
