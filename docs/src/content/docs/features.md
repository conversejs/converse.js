---
title: Features
description: A complete overview of Converse's capabilities.
---

Converse is a full-featured XMPP client that runs in any modern browser. Below is an overview of what it offers.

## Core chat

- **One-to-one messaging** — Private chats with delivery receipts, typing indicators, and message corrections
- **Group chats (MUC)** — Multi-user chatrooms with moderation, bookmarks, and persistent history
- **Message reactions** — React to messages with emojis
- **Message corrections & retractions** — Edit or delete sent messages
- **Chat states** — See when contacts are typing, composing, or inactive
- **URL previews** — Links in messages can be rendered as clickable previews

## Security & privacy

- **OMEMO encryption** — End-to-end encrypted messaging as well as encrypted file sharing.
- **Client certificate auth** — Passwordless login via SASL-EXTERNAL and x509 certificates.
- **Untrusted device mode** — Check "This is not a trusted device" at login to use sessionStorage instead of localStorage, clearing all data on logout

## File sharing

Upload and share files directly in chat via HTTP File Upload (XEP-0363). The file server is configured by your XMPP server admin.

:::tip
If file sharing isn't working, the most common cause is missing CORS headers on the file server. It must include an `Access-Control-Allow-Origin` header that allows the domain hosting Converse. See the [CORS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) for details.
:::

## Integration

- **Embeddable** — Run as a standalone page, a floating overlay, or embedded inside a `<div>`
- **URL-based chat opening** — Link directly to a chat or room with URL fragments like `#converse/chat?jid=user@domain`
- **Session management** — Auto-login users already authenticated on your website
- **Plugin system** — Extend or customize behavior with plugins

## Notifications

- **Sound alerts** — Play a sound when new messages arrive
- **Desktop notifications** — Browser notifications when the tab isn't visible

## Internationalization

Converse is translated into 30+ languages, with translations loaded on demand from JSON files. Contribute or update translations on [Weblate](https://hosted.weblate.org/projects/conversejs/).

## Chatroom moderation

Moderators can use these slash commands in group chats:

| Command | Description | Example |
|---------|-------------|---------|
| `/ban` | Ban a user permanently | `/ban $nickname` |
| `/kick` | Remove a user (they can rejoin) | `/kick $nickname [$reason]` |
| `/mute` | Prevent a user from posting | `/mute $nickname [$reason]` |
| `/voice` | Unmute a user | `/voice $nickname [$reason]` |
| `/op` | Grant moderator status | `/op $nickname [$reason]` |
| `/deop` | Remove moderator status | `/deop $nickname [$reason]` |
| `/topic` | Set the room topic | `/topic New topic` |
| `/nick` | Change your nickname | `/nick NewNick` |
| `/me` | Speak in third person | `/me waves hello` |
| `/clear` | Clear visible messages | `/clear` |
| `/help` | Show available commands | `/help` |

## Security considerations

Converse uses "host-based" security — you trust the server that delivers the JavaScript each time you load the page. This differs from desktop apps where you trust the binary at install time.

**What this means:**
- You must trust the web server hosting Converse, but not necessarily the XMPP server (they can be different hosts)
- OMEMO protects messages from the XMPP server since it never sees your private key
- The dynamic nature of web delivery makes independent security audits more difficult

**How to improve security:**
- Host Converse yourself, ideally on your own infrastructure
- Use HTTPS and set strict [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) headers
- For high-threat scenarios, use [Converse Desktop](https://github.com/conversejs/converse-desktop) instead
