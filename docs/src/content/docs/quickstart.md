---
title: Quickstart
description: Get Converse up and running in under 5 minutes.
---

## Chat now

Start chatting immediately at [chat.conversejs.org](https://chat.conversejs.org).

Log in with any existing XMPP account, or create a new one via the registration form.

## Host your own instance

To run your own instance, follow the steps below. You'll need:
- An XMPP server (or an account on a public server like [conversations.im](https://conversations.im) or [jabber.de](https://jabber.de))
- A web server (or just a local HTML file for testing)

## Step 1: Get the files

### Fastest: Use the CDN

Add these lines to your HTML `<head>`:

```html
<link rel="stylesheet" href="https://cdn.conversejs.org/dist/converse.min.css">
<script src="https://cdn.conversejs.org/dist/converse.min.js"></script>
```

You can also pin to a specific version:

```html
<link rel="stylesheet" href="https://cdn.conversejs.org/12.0.0/dist/converse.min.css">
<script src="https://cdn.conversejs.org/12.0.0/dist/converse.min.js"></script>
```

### Alternative: Self-host

If you prefer to host the files yourself, either:
- **Download** the latest [release archive](https://github.com/conversejs/converse.js/releases) and extract the `dist/` folder, or
- **Build from source** — see [Generating Builds](/development/builds/)

:::note
When self-hosting, all files in the `dist/` directory must be available. Converse loads additional assets dynamically from this path. Use [`assets_path`](/configuration/#assets_path) to change it.
:::

### Already run an XMPP server?

Many servers have built-in plugins that serve Converse for you:
- **Openfire**: [inverse plugin](https://www.igniterealtime.org/projects/openfire/plugin-archive.jsp?plugin=inverse)
- **Prosody**: [mod_conversejs](https://modules.prosody.im/mod_conversejs.html)
- **ejabberd**: [mod_conversejs](https://docs.ejabberd.im/admin/configuration/modules/#mod_conversejs)

Check your server's documentation — this is often the easiest path.

## Step 2: Initialize Converse

Add this before your closing `</body>` tag:

```html
<script>
    converse.initialize({
        // Replace with your XMPP server's BOSH or WebSocket URL
        bosh_service_url: 'https://your-xmpp-server:5280/bosh',
        // Or use WebSocket:
        // websocket_url: 'wss://your-xmpp-server:5280/ws',
    });
</script>
```

### Complete minimal example

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Chat</title>
    <link rel="stylesheet" href="https://cdn.conversejs.org/12.0.0/dist/converse.min.css">
    <script src="https://cdn.conversejs.org/12.0.0/dist/converse.min.js"></script>
</head>
<body>
    <script>
        converse.initialize({
            bosh_service_url: 'https://conversejs.org/http-bind/',
        });
    </script>
</body>
</html>
```

Save this as `index.html` and open it in your browser. You'll see a login screen where you can enter any XMPP account.

## Step 3: Choose your display mode

Converse supports three layouts:

| Mode | Description | Best for |
|------|-------------|----------|
| `fullscreen` | Chat fills the entire page | Standalone chat apps |
| `overlay` | Chat floats in a corner, toggleable | Adding chat to an existing site |
| `embedded` | Chat lives inside a specific `<div>` | Custom page layouts |

```javascript
converse.initialize({
    view_mode: 'fullscreen', // or 'overlay' or 'embedded'
});
```

See the [live demos](https://conversejs.org) for examples of each mode.

## What's next?

- **[Configuration](/configuration/)** — All available options for `converse.initialize()`
- **[Session Management](/session/)** — Auto-login users who are already authenticated on your site
- **[Features](/features/)** — File sharing, OMEMO encryption, group chats, and more
- **[Setup and Integration](/setup/)** — Production deployment guide with server-side auth
