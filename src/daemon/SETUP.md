# Setting up the daemon

The daemon lets an agent read your XMPP messages and draft replies for you.
It is built so that the agent never sends to anyone directly. Each send the
agent asks for becomes a draft, and the text of that draft is delivered to you.
You send it yourself, from your own client, or you don't.

For that to hold, the agent must not be able to act as you. The code can't
enforce that alone. The setup below is what makes it true.

## 1. Create a bot account for the agent

Create a separate XMPP account for the agent, with its own password. Don't use
your own account. The config refuses to start if `jid` and `owner` are the same.

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
    "policy": {
        "allow": ["juliet@example.org"],
        "rate_limit": { "per_conversation": 5, "overall": 20, "window": 60 }
    }
}
```

- `owner` is the account drafts are delivered to. It must be your account.
- `policy.allow` lists the people a draft may be for. A draft to anyone else is
  refused, and nothing is sent.
- The agent's password goes in the keyring under the service `converse`, with
  the agent's JID as the account, or in `password` if the daemon user's config
  is private to that user.

## What you will see

When the agent asks to send to Juliet, you get a message from the agent's
account like this:

```
Draft d1 for juliet@example.org, from claude. Nothing was sent. To send it, copy the text into your client:
"Shall we meet at noon?"
```

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
