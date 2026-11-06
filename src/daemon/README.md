# @converse/daemon

A long-lived process that holds one XMPP session, using `@converse/headless`, and
shares it with local clients over a unix socket.

## One session, multiple clients

Keeping one session open matters because XMPP assumes one. A tool that logged in
on every call would make your presence flap, miss messages that arrive between
calls, and spend seconds on each login. The daemon stays connected instead, so
reads and sends are quick, and messages reach a client as they arrive.

The daemon itself has no user interface. Clients talk to it over its socket:

- `converse-cli`, a short-lived command line client which can be
  driven by a script, an AI agent through a shell, or used by hand.
- A planned Ink-based terminal UI, for you to use directly.

## Access for AI agents

The daemon has a configurable access policy, so you can allow an AI agent to
read and send messages on your behalf.

Every send from a restricted client, such as an AI agent, is checked against the
policy and recorded in an audit log. Depending on the operating mode, it is sent
directly, queued as a draft for you to send or drop, or refused.

Setup, configuration, the operating modes and the policy are documented at
https://conversejs.org/docs/daemon/setup/
