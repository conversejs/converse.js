---
title: Troubleshooting
description: Solve common issues and debug Converse.
---

## Connection problems

### Converse won't connect to the XMPP server

1. **Check the connection URL** — Ensure `bosh_service_url` or `websocket_url` points to the correct endpoint
2. **Check for CORS errors** — Open your browser's developer console (F12). If you see `Cross-Origin Request Blocked`, your XMPP server's BOSH/WebSocket endpoint needs CORS headers allowing your Converse domain
3. **Try switching protocols** — If WebSocket fails, try BOSH (or vice versa). Some servers/proxies handle one better than the other
4. **Verify the endpoint works** — Visit the BOSH URL directly in your browser. You should see an XML response or a "GET not allowed" message, not a 404

### WebSocket vs BOSH

- **WebSocket** (`wss://`) is faster and has less overhead, but may be blocked by strict proxies or firewalls
- **BOSH** (`https://`) is slower and generally worse than websocket, but may be the only way around a strict firewall.

## Users logged out on page reload

XMPP doesn't use HTTP cookies, so browsers can't automatically maintain sessions. Here's how to keep users logged in:

**For end users:**
- Save your credentials in the browser when prompted (the key icon in the address bar)
- Make sure your XMPP server uses SCRAM as the authentication mechanism. This lets Converse store reusable auth keys
  and thereby avoid asking for a password.
- Consider using [Converse Desktop](https://github.com/conversejs/converse-desktop) which securely stores credentials.

**For integrators:**
- Use the [`credentials_url`](/configuration/#credentials_url) setting to fetch credentials from your backend automatically
- Implement [Session Management](/session/) to auto-login users already authenticated on your site

## File upload not working

The most common cause is missing CORS headers on your HTTP file upload server.

1. Open your browser's developer console (F12) → Network tab
2. Try uploading a file
3. Look for a failed `OPTIONS` request (CORS preflight) or a `Cross-Origin Request Blocked` error
4. Configure your file server to include `Access-Control-Allow-Origin: <your-converse-domain>` in responses

See [HTTP File Upload (XEP-0363)](https://xmpp.org/extensions/xep-0363.html) for server-specific configuration guides.

## Performance with large rosters

Rosters over 1,000 contacts may cause noticeable slowdowns. To improve performance:

- Set `show_only_online_users: true` to reduce rendered contacts
- Use `roster_groups: true` to collapse groups by default
- Consider server-side roster filtering if your XMPP server supports it

## Debugging Converse

### Enable debug logging

Set `loglevel: 'debug'` in `converse.initialize()`, or append `#converse?loglevel=debug` to the URL.

With debug logging enabled:
- All XMPP stanzas (XML traffic) are logged to the browser console
- Non-critical errors that Strophe.js normally swallows will be visible
- You can confirm whether messages/presence are actually reaching Converse

**Tip:** In Chrome, right-click the console → "Save as..." to export logs for sharing.

### Interpreting debug output

- **Stanzas not appearing in logs?** The issue is likely server-side (misconfiguration, firewall, or routing)
- **Stanzas appear but UI doesn't update?** Likely a Converse bug or plugin conflict
- **Errors in console?** Search the [issue tracker](https://github.com/conversejs/converse.js/issues) or ask in the [Converse chat room](https://chat.conversejs.org)

### Common internal errors

**`Error: A "url" property or function must be specified`**
This is a Backbone/Skeletor error indicating a model was saved without a storage backend. In Converse, this usually means a model was removed from its collection before `.save()` was called. If you see this, check for plugin conflicts or report it as a bug.

## Getting help

If you're still stuck:

1. **Check the [issue tracker](https://github.com/conversejs/converse.js/issues)** — Your problem may already be solved
2. **Join the [Converse chat room](https://chat.conversejs.org)** — Real-time help from the community
3. **When reporting a bug, include:**
   - Converse version
   - Browser and OS
   - XMPP server software and version
   - Relevant console logs (with `loglevel: 'debug'`)
   - Steps to reproduce
