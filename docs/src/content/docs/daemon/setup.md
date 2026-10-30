---
title: Setting up the daemon
description: How to create the account, keep its password safe, and configure the daemon that lets an agent use your XMPP account.
---

The daemon lets an agent read your XMPP messages, and send or draft messages
for you. What the agent may send, and how, depends on the `mode` in the config
(see "Modes" below). By default, the agent never sends to anyone directly. Each
send it asks for becomes a draft, and the text of that draft is delivered to
you. You send it yourself, from your own client, or you don't.

For that to hold, the agent must not be able to act as you. The code can't
enforce that alone. The setup below is what makes it true.

The steps below are for the `owner_only` and `bot` modes, where the agent has its
own account. To let the agent use your own account instead, read
[Acting as yourself](#acting-as-yourself-as_user) first: it changes step 1, and
makes step 2 a requirement.

## 1. Create a bot account for the agent

Create a separate XMPP account for the agent, with its own password. Don't use
your own account. In the `owner_only` and `bot` modes, the config refuses to
start if `jid` and `owner` are the same.

## 2. Keep the agent away from the daemon's files

The send policy only binds an agent that has to go through the restricted
socket. An agent that runs as the daemon's OS user, with the same files, can get
round it:

- it can read the agent account's password from the config or the keyring, and
  log in without the daemon;
- it can connect to the full-access socket, which sits next to the restricted
  one;
- it can edit the audit log and the drafts.

The server still stops it from sending as you, since the account is the bot's.
But the allowlist, the drafts, the rate limits and the audit log no longer hold.

So give the agent the restricted socket and nothing else of the daemon's. There
are two ways: run it in a sandbox, or run it as another OS user. Either way, the
agent's CLI finds the socket through the `CONVERSE_SOCKET` environment variable,
and reads no config. It can't start the daemon, because it has no password, so
start the daemon yourself with `converse-cli daemon start`. If the daemon isn't
running, the agent's commands fail with exit code 7, saying so.

The restricted socket is the file `sock` in a directory of its own, so that a
sandbox can be given that directory alone. By default the directory is
`$XDG_RUNTIME_DIR/converse/<jid>.restricted/` (a hash of the JID, for a long
one). `"restricted_dir"` in the config puts it elsewhere. When the daemon
restarts, it makes a new socket file in the same directory, so a sandbox bound
to the directory, or another user, can carry on without being restarted. Give
each account a directory of its own.

### In a sandbox

The agent runs as your OS user, inside a sandbox (for example bubblewrap, a
container, or your agent's own sandbox) that can't see the daemon's files:

- **Mount the restricted socket's directory only.** Don't mount
  `$XDG_RUNTIME_DIR/converse/` itself, which holds the full access socket too.
  The daemon makes the directory when it first starts, so start it once
  before the sandbox.
- **Set `CONVERSE_SOCKET`** to the socket's path inside the sandbox.
- **Don't mount** the daemon's config (`~/.config/converse/`), its state
  directory (`~/.local/state/converse/`), or the session D-Bus, through which
  the keyring can be asked for the password.

With bubblewrap, for example (the agent's own files and tools need mounting too):

```sh
restricted="$XDG_RUNTIME_DIR/converse/agent@example.org.restricted"
bwrap \
    --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib \
    --proc /proc --dev /dev --tmpfs /tmp \
    --bind "$HOME/work" "$HOME/work" \
    --bind "$restricted" /run/converse \
    --setenv CONVERSE_SOCKET /run/converse/sock \
    --unshare-all --share-net \
    claude
```

Other options include a container (Docker or Podman, run as your own uid), or
your agent's own built-in sandbox. Prefer one where you list what the agent
may see, over one that starts from everything and hides what you list: a
hidden socket file doesn't stay hidden once the daemon restarts and makes a
new one.

### As another OS user

The daemon runs as one user, and the agent as another, which can't read the
daemon user's files at all. The restricted socket is opened to a group that
both users are in, and nothing else is:

1. Create the group, and add both users to it. Each must log in again to be in
   it.

   ```sh
   sudo groupadd converse-agents
   sudo usermod -aG converse-agents daemonuser
   sudo usermod -aG converse-agents agentuser
   ```

2. In the daemon user's config, name the group, and put the restricted socket
   outside `$XDG_RUNTIME_DIR`, which only its owner can enter:

   ```json
   "socket_group": "converse-agents",
   "restricted_dir": "/srv/converse/agent@example.org"
   ```

   The parent directory must let the agent user through. For example, make it
   owned by the daemon user, with mode `755`:

   ```sh
   sudo install -d -o daemonuser -m 755 /srv/converse
   ```

   The daemon
   makes `restricted_dir` itself, or takes the one there if the daemon user owns
   it, and refuses to start on a directory it doesn't own. It makes the
   directory `750` and the socket `660`, in the group. The full access socket,
   the pidfile, the config and the state stay readable by the daemon user only.

3. In the agent user's environment, set:

   ```sh
   export CONVERSE_SOCKET=/srv/converse/agent@example.org/sock
   ```

`socket_group` takes a group name or number. The daemon refuses to start if the
group doesn't exist, or if its user isn't in it. Without `socket_group`, the
restricted socket stays readable by the daemon user only.

The daemon never reads a file on a client's behalf. To upload a file, the CLI
reads it and sends its contents, so the agent can only share files it can read
itself. In a sandbox, mount only what you're happy for it to share.

In the `owner_only` and `bot` modes, your own password should never be in the
daemon's config or keyring. Only `as_user` mode uses it.

## 3. Write the config

The config is `~/.config/converse/daemon.json` in the daemon user's home, or
`$XDG_CONFIG_HOME/converse/daemon.json` when `XDG_CONFIG_HOME` is set.
`converse-cli --help` prints the path it uses. To configure more than one
account, see [Several accounts](#several-accounts).

```json
{
    "jid": "agent@example.org",
    "owner": "you@example.org",
    "websocket_url": "wss://example.org/xmpp-websocket",
    "consumer": "agent",
    "mode": "owner_only",
    "policy": {
        "allow": ["juliet@example.org"],
        "direct": [],
        "rooms": [],
        "rate_limit": { "per_conversation": 5, "overall": 20, "window": 60 }
    }
}
```

- `owner` is the account drafts are delivered to, and direct sends to you go
  to. It must be your account. In `as_user` mode it's the same as `jid`, and can
  be left out.
- `mode` is how the agent acts. See "Modes" below. It defaults to `owner_only`.
- `policy.allow` lists the people a draft may be for. A draft to anyone else is
  refused, and nothing is sent.
- `policy.direct` lists the people the agent may message directly, in `bot`
  mode. It is empty by default, and ignored in `owner_only` mode. In `as_user`
  mode the config refuses it.
- `policy.rooms` lists the rooms the agent may join, leave and send to. In
  `owner_only` and `as_user` modes a send to one of them is a draft. In `bot`
  mode it goes out directly.
- `policy.presence` (default `false`) lets a restricted agent change your
  availability and status message with `converse-cli presence set`. Full access
  can always do it.
- `allow_unencrypted_resend` (default `false`) lets you send a failed send in
  the clear, with `converse-cli resend --unencrypted`, when it failed because it
  couldn't be encrypted. It applies to full access only: an agent can never
  resend.
- The agent's password goes in the keyring under the service `converse`, with
  the agent's JID as the account, or in `password` if the daemon user's config
  is private to that user (`chmod 600`). Only the daemon reads it; the CLI never
  does. To store it in the keyring, as the daemon user:

  ```sh
  # Linux (libsecret)
  secret-tool store --label=Converse service converse account agent@example.org
  # macOS
  security add-generic-password -s converse -a agent@example.org -w
  ```

## Several accounts

Each account has a config file and a daemon of its own. `daemon.json` is the
account named `default`. Any other account is a file in the `accounts`
directory beside it, in the same format, named after the account:

```
~/.config/converse/daemon.json            the account "default"
~/.config/converse/accounts/juliet.json   the account "juliet"
~/.config/converse/accounts/nurse.json    the account "nurse"
```

Pick an account with `--account <name>`, or by setting `CONVERSE_ACCOUNT=<name>`.
The option wins over the variable. Without either, the CLI uses the default
account: `daemon.json` if it exists, otherwise the only account there is. With
several accounts and no `daemon.json`, there is no default, and the CLI lists the
accounts and asks you to pick one. A name that isn't configured fails with exit
code 3, listing the accounts there are.

```sh
converse-cli accounts                         # the accounts, and which is the default
converse-cli --account juliet inbox           # Juliet's inbox, from her daemon
CONVERSE_ACCOUNT=nurse converse-cli inbox     # the same, for the nurse
converse-cli daemon status --all              # every running daemon
```

This is how several agents run side by side, each with its own JID, so that they
can message one another directly or meet in a room: give each agent its own
account, and set `CONVERSE_ACCOUNT` in its environment. An agent given only a
socket, with `CONVERSE_SOCKET`, needs no account name.

The CLI finds a running daemon by its account's name. So if you change an
account's `jid` while its daemon runs, `converse-cli --account <name> daemon
stop` still stops it, and the next command starts a daemon with the new JID.

## Where the daemon keeps its files

Logs and state go in `~/.local/state/converse/` (or
`$XDG_STATE_HOME/converse/`), with one set of files per account:

- `<jid>.log` is what the daemon did, including why it failed to start. When
  the daemon won't start, the CLI's error names this file.
- `<jid>.audit.jsonl` has one line for every send, draft and refusal, with the
  client that asked for it, the mode and the route. Read it to check what an
  agent sent.
- The inbox cursors, drafts and joined rooms are kept beside them, so they
  survive a restart.
- The account's database (its roster, message history and OMEMO keys) is in
  this directory for the `default` account, and in `accounts/<name>/` for any
  other, so that daemons running side by side never share one. The settings'
  `storage_path` puts it elsewhere.

The full access socket and the pidfile go in `$XDG_RUNTIME_DIR/converse/`, or,
without `XDG_RUNTIME_DIR`, in a `converse-<uid>` directory in the system's
temporary directory. The directory is readable only by the daemon user. The
restricted socket is in a directory of its own, `<jid>.restricted/` inside it,
unless `restricted_dir` puts it elsewhere (see step 2).

## Modes

The `mode` decides which account the agent acts with, and so what each send
does. Every restricted send goes one of three ways. It is sent directly, queued
as a draft for you, or refused by the policy. The rate limits count all of them
alike.

- **`owner_only`** (the default). The agent sends nothing to anyone but you
  directly. A send to you goes out. A send to someone on `policy.allow`, or to a
  room on `policy.rooms`, is a draft. Anything else is refused.
- **`bot`**. As `owner_only`, plus: a send to a room on `policy.rooms`, or to a
  contact on `policy.direct`, goes out directly, from the agent's account. The
  agent's messages then come from the bot account, and show it as a bot. A
  contact on `policy.allow` is still a draft.
- **`as_user`**. The agent uses your own account. Nothing it asks for is sent:
  a send, reply, correction, retraction, reaction or upload to someone on
  `policy.allow`, or to a room on `policy.rooms`, is a draft, held in the daemon
  until you send it. Anything else is refused. See
  [Acting as yourself](#acting-as-yourself-as_user).

## Acting as yourself (`as_user`)

In `as_user` mode the daemon logs in to your own account, as a separate client
(under its `resource`). The agent reads what you can read: your whole roster,
your rooms and your history. It drafts the messages you ask it to write, and you
decide which of them go out. What you approve is sent as you, with nothing to
mark it as the agent's, and your other clients see it as one of your messages.

```json
{
    "jid": "you@example.org",
    "websocket_url": "wss://example.org/xmpp-websocket",
    "mode": "as_user",
    "policy": {
        "allow": ["juliet@example.org"],
        "rooms": []
    }
}
```

- `owner` can be left out. If it's set, it must be `jid`.
- `policy.direct` is refused: nothing goes out without your approval.
- Your password goes in the keyring under your own JID, as step 3 shows. Only
  the daemon reads it.

### Using the same daemon yourself

You and the agent share one daemon, which is the one session for your account.
You don't start a second one. The mode applies to the whole daemon, but it only
changes what happens on the restricted socket. Sends from the full-access socket
are never routed: they go out directly, as they would from any of your clients.

The CLI connects at the config's `access` level, which is `restricted` unless
the config says otherwise. With that default, a `converse-cli send` from your
own terminal would be drafted like the agent's. So set the level in your own
config:

```json
"access": "full"
```

The agent doesn't read your config: its CLI connects to the socket that
`CONVERSE_SOCKET` names, which is the restricted one, so it gets restricted
access whatever your config says.

### What it risks

XMPP has no scoped tokens, so your server enforces nothing here. Every limit on
the agent comes from the daemon's policy, and the policy only binds an agent
that has to go through the restricted socket. An agent that can reach the
full-access socket can send its own drafts, or anything else, as you. One that
can read the daemon's config or keyring has your password.

So for this mode, step 2 is a requirement, not advice: **run the agent in a
sandbox that can reach the restricted socket and nothing else of the daemon's.**
The daemon logs a warning when it starts in this mode, to say so.

The agent also reads everything your account receives, so whatever anyone sends
you reaches it. Treat that as you would any untrusted input to an agent.

### Reviewing and sending drafts

When the agent drafts something, the draft stays in the daemon. Nothing is
delivered to anyone, you included. From your own terminal, which can reach the
full-access socket:

```sh
converse-cli drafts list        # what's waiting
converse-cli drafts show d17    # one draft in full: recipient, the message it answers, its text
converse-cli drafts send d17    # send it as you
converse-cli drafts reject d17  # or drop it
```

`drafts send` sends the draft as it was asked for. A reply is sent as a reply, a
correction replaces your message, a retraction retracts it, and a reaction is
given. If it can't be sent, for example while the daemon is offline, the draft
is kept. Drafts survive a daemon restart.

The agent can list and show drafts too, so it can tell you which are waiting.
It can never send or withdraw one. The audit log records each draft, and each
draft you send or reject, with `mode: "as_user"`. A sent draft also records
`"approved_by": "full"`.

## What you will see

In the `owner_only` and `bot` modes, when the agent asks to send to Juliet, you
get a message from the agent's account like this:

```
Draft d1 for juliet@example.org, from agent. Nothing was sent. To send it, copy the text into your client:
"Shall we meet at noon?"
```

A draft can also be a reply, or a reaction, to a message. The notice then
quotes the start of that message, so you can find it:

```
Draft d2 for juliet@example.org, from agent. Nothing was sent. To send it, react to the message from juliet@example.org, "Noon?", with:
"👍"
```

In `owner_only` mode the agent can't correct, retract or remove a reaction
from a message, since a draft can't do any of those. In `bot` mode it can, where
the policy sends the message directly, and only to its own messages.

If you don't want it, withdraw it from the command line with
`converse-cli drafts reject d1`, and you get a note confirming it was withdrawn.
Nothing reaches Juliet unless you send it yourself.

## What the setup does not cover

- The agent can still read whatever the agent's account can read, so keep its
  roster to people you're happy for it to hear from.
- Anything that can read the daemon user's files can read the agent's password.
  Protect that user the same way you would protect your own password.
- If the agent runs outside a sandbox, as your own OS user, none of the policy
  binds it: it can read the agent account's password and use the full-access
  socket, as step 2 explains. The server still keeps it from sending as you.
