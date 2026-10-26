# Setting up the daemon

The daemon lets an agent read your XMPP messages, and send or draft messages
for you. What the agent may send, and how, depends on the `mode` in the config
(see "Modes" below). By default, the agent never sends to anyone directly. Each
send it asks for becomes a draft, and the text of that draft is delivered to
you. You send it yourself, from your own client, or you don't.

For that to hold, the agent must not be able to act as you. The code can't
enforce that alone. The setup below is what makes it true.

## 1. Create a bot account for the agent

Create a separate XMPP account for the agent, with its own password. Don't use
your own account. In the `owner_only` and `bot` modes, the config refuses to
start if `jid` and `owner` are the same.

## 2. Keep your password away from the agent

The agent runs as your OS user, so anything your user can read, the agent can
read too. Choose one of:

- **Run the daemon as a separate OS user**, for example `converse-agent`. Its
  config file and keyring entries belong to that user and are unreadable by you
  or the agent, and the socket directory is shared through a group.
- **Don't store your password on the machine.** The daemon can't start without a
  password, and you type it in when it does.

Your own password should never be in the daemon's config or keyring, under the
agent's user or yours.

## 3. Write the config

`daemon.json` in the daemon user's config directory:

```json
{
    "jid": "agent@example.org",
    "owner": "you@example.org",
    "websocket_url": "wss://example.org/xmpp-websocket",
    "consumer": "claude",
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
  to. It must be your account.
- `mode` is how the agent acts. See "Modes" below. It defaults to `owner_only`.
- `policy.allow` lists the people a draft may be for. A draft to anyone else is
  refused, and nothing is sent.
- `policy.direct` lists the people the agent may message directly, in `bot`
  mode. It is empty by default, and ignored in `owner_only` mode.
- `policy.rooms` lists the rooms the agent may join, leave and send to. In
  `owner_only` mode a send to one of them is a draft. In `bot` mode it goes out
  directly.
- `policy.presence` (default `false`) lets a restricted agent change your
  availability and status message with `converse-cli presence set`. Full access
  can always do it.
- The agent's password goes in the keyring under the service `converse`, with
  the agent's JID as the account, or in `password` if the daemon user's config
  is private to that user.

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
- **`as_user`**. Acting with your own credentials. Not implemented yet, and the
  daemon refuses to start in it.

## What you will see

When the agent asks to send to Juliet, you get a message from the agent's
account like this:

```
Draft d1 for juliet@example.org, from claude. Nothing was sent. To send it, copy the text into your client:
"Shall we meet at noon?"
```

A draft can also be a reply, or a reaction, to a message. The notice then
quotes the start of that message, so you can find it:

```
Draft d2 for juliet@example.org, from claude. Nothing was sent. To send it, react to the message from juliet@example.org, "Noon?", with:
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
- If the agent runs as your own OS user, it can reach the full socket and call
  `drafts list` and `drafts reject`. Those can only hide or withdraw a draft, and
  every withdrawal is reported to you. Running the daemon as a separate user, as
  in step 2, closes this too.
