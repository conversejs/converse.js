<h2 align="center">
  <a href="https://conversejs.org" target="_blank" rel="noopener">
    <img alt="Converse.js" src="https://github.com/conversejs/converse.js/blob/master/logo/readme.png" width="480">
  </a>
</h2>

[![XMPP Chat](https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![CI Tests](https://github.com/conversejs/converse.js/actions/workflows/karma-tests.yml/badge.svg)](https://github.com/conversejs/converse.js/actions/workflows/karma-tests.yml)
[![Translation status](https://hosted.weblate.org/widgets/conversejs/-/svg-badge.svg)](https://hosted.weblate.org/engage/conversejs/?utm_source=widget)

[Converse](https://conversejs.org) is a modern, feature-rich and 100% client-side [XMPP](https://xmpp.org) chat app that runs in a web browser.
It can be used as a standalone web app or seamlessly integrated into existing websites.

Join our [chat room](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org) (XMPP URL: [discuss@conference.conversejs.org](xmpp:discuss@conference.conversejs.org?join)).

## Quick Start

Try the hosted app at [conversejs.org](https://conversejs.org/fullscreen.html).
You can also download and install [Converse Desktop](https://github.com/conversejs/converse-desktop/releases) or [Converse Tauri](https://github.com/conversejs/converse-tauri/releases).

Or set up your own instance:

```bash
git clone git@github.com:conversejs/converse.js.git
npm install
npm run build
npm run serve -- -p 8008
```

You can then open http://localhost:8008/dev.html in your browser to access Converse.

See our [quickstart guide](https://conversejs.org/docs/html/quickstart.html) for more details.

## Live Demos

- **[Main App](https://conversejs.org/fullscreen.html)**: Try the full application
- **[Anonymous Login](https://conversejs.org/demo/anonymous.html)**: Test without creating an account
- **[Embedded Chat Room](https://conversejs.org/demo/embedded.html)**: See how to embed a single chat room

## Documentation

Comprehensive documentation is available at [conversejs.org/docs/html](https://conversejs.org/docs/html), including:

- [Quickstart Guide](https://conversejs.org/docs/html/quickstart.html)
- [Configuration Options](https://conversejs.org/docs/html/configuration.html)
- [Plugin Development](https://conversejs.org/docs/html/plugin_development.html)

## Key Features

- **Multiple UI Options**: Overlay chat boxes, full-page application, or embedded components
- **Rich Messaging**: Message styling, corrections, reactions, and URL previews
- **Privacy-Focused**: End-to-end encryption with OMEMO
- **User Status**: Custom status messages and availability indicators
- **Notifications**: Desktop notifications for new messages
- **File Sharing**: HTTP File Upload support
- **Extensible**: Plugin architecture based on [pluggable.js](https://conversejs.github.io/pluggable.js/)
- **Internationalized**: Translated into 40+ languages
- **Anonymous Login**: Use without registration (server permitting)
- **Responsive**: Works on desktop and mobile devices

### Display Modes

Converse adapts to your needs with multiple display options:

| Mode | Description |
|------|-------------|
| **Fullpage** (default) | Functions as a single-page application covering the entire viewport |
| **Overlay** | Chat boxes appear on top of your website |
| **Embedded** | Integrates into specific elements in your page's DOM |

<details>
<summary>View Screenshots</summary>

### Overlay Mode
![Screenshot of Converse in overlay mode](https://conversejs.org/screenshots/Converse-overlayed.png)

### Fullpage Mode
![Screenshot of Converse in fullpage mode](https://conversejs.org/screenshots/Converse-fullscreen.png)

### Dark Mode
![Screenshot of Converse with a dark theme](https://conversejs.org/screenshots/Converse-Dracula-Theme.png)

### Embedded Mode
![Screenshot of Converse in embedded mode](https://conversejs.org/screenshots/Converse-embedded.png)
</details>

## XMPP Protocol Support

Converse implements a wide range of XMPP Extensions (XEPs), making it one of the most protocol-compliant web clients available.

<details>
<summary><strong>View all supported XEPs (45+)</strong></summary>

| XEP | Name | Notes |
|-----|------|-------|
| [RFC-7395](https://tools.ietf.org/html/rfc7395) | XMPP Subprotocol for WebSocket | |
| [XEP-0004](https://xmpp.org/extensions/xep-0004.html) | Data Forms | |
| [XEP-0030](https://xmpp.org/extensions/xep-0030.html) | Service Discovery | |
| [XEP-0045](https://xmpp.org/extensions/xep-0045.html) | Multi-user Chat | |
| [XEP-0048](https://xmpp.org/extensions/xep-0048.html) | Bookmarks | |
| [XEP-0050](https://xmpp.org/extensions/xep-0050.html) | Ad-Hoc Commands | |
| [XEP-0054](https://xmpp.org/extensions/xep-0054.html) | VCard-temp | |
| [XEP-0059](https://xmpp.org/extensions/xep-0059.html) | Result Set Management | |
| [XEP-0060](https://xmpp.org/extensions/xep-0060.html) | Publish-Subscribe | Limited support |
| [XEP-0066](https://xmpp.org/extensions/xep-0066.html) | Out of Band Data | |
| [XEP-0077](https://xmpp.org/extensions/xep-0077.html) | In-band Registration | |
| [XEP-0085](https://xmpp.org/extensions/xep-0085.html) | Chat State Notifications | |
| [XEP-0115](https://xmpp.org/extensions/xep-0115.html) | Entity Capabilities | |
| [XEP-0124](https://xmpp.org/extensions/xep-0124.html) | BOSH | |
| [XEP-0144](https://xmpp.org/extensions/xep-0144.html) | Roster Item Exchange | |
| [XEP-0156](https://xmpp.org/extensions/xep-0156.html) | Discovering Alternative XMPP Connection Methods | |
| [XEP-0163](https://xmpp.org/extensions/xep-0163.html) | Personal Eventing Protocol | Limited support |
| [XEP-0184](https://xmpp.org/extensions/xep-0184.html) | Message Receipt | |
| [XEP-0198](https://xmpp.org/extensions/xep-0198.html) | Stream Management | |
| [XEP-0199](https://xmpp.org/extensions/xep-0199.html) | XMPP Ping | |
| [XEP-0203](https://xmpp.org/extensions/xep-0203.html) | Delayed Delivery | |
| [XEP-0206](https://xmpp.org/extensions/xep-0206.html) | XMPP Over BOSH | |
| [XEP-0245](https://xmpp.org/extensions/xep-0245.html) | The /me Command | |
| [XEP-0249](https://xmpp.org/extensions/xep-0249.html) | Direct MUC Invitations | |
| [XEP-0280](https://xmpp.org/extensions/xep-0280.html) | Message Carbons | |
| [XEP-0297](https://xmpp.org/extensions/xep-0297.html) | Stanza Forwarding | Limited support |
| [XEP-0308](https://xmpp.org/extensions/xep-0308.html) | Last Message Correction | |
| [XEP-0313](https://xmpp.org/extensions/xep-0313.html) | Message Archive Management | |
| [XEP-0316](https://xmpp.org/extensions/xep-0316.html) | MUC Eventing Protocol | Limited support |
| [XEP-0317](https://xmpp.org/extensions/xep-0317.html) | Hats | Limited support |
| [XEP-0333](https://xmpp.org/extensions/xep-0333.html) | Chat Markers | Limited support |
| [XEP-0352](https://xmpp.org/extensions/xep-0352.html) | Client State Indication | |
| [XEP-0357](https://xmpp.org/extensions/xep-0357.html) | Push Notifications | |
| [XEP-0359](https://xmpp.org/extensions/xep-0359.html) | Unique and Stable Stanza IDs | |
| [XEP-0363](https://xmpp.org/extensions/xep-0363.html) | HTTP File Upload | |
| [XEP-0372](https://xmpp.org/extensions/xep-0372.html) | References | |
| [XEP-0382](https://xmpp.org/extensions/xep-0382.html) | Spoiler Messages | |
| [XEP-0384](https://xmpp.org/extensions/xep-0384.html) | OMEMO Encryption | |
| [XEP-0393](https://xmpp.org/extensions/xep-0393.html) | Message Styling | |
| [XEP-0422](https://xmpp.org/extensions/xep-0422.html) | Message Fastening | Limited support |
| [XEP-0424](https://xmpp.org/extensions/xep-0424.html) | Message Retractions | |
| [XEP-0425](https://xmpp.org/extensions/xep-0425.html) | Message Moderation | |
| [XEP-0437](https://xmpp.org/extensions/xep-0437.html) | Room Activity Indicators | |
| [XEP-0453](https://xmpp.org/extensions/xep-0453.html) | DOAP Usage in XMPP | |
| [XEP-0454](https://xmpp.org/extensions/xep-0454.html) | OMEMO Media Sharing | |
</details>

## Integration Options

Converse integrates with popular platforms and frameworks:

### XMPP Servers
| Server | Plugin |
|--------|--------|
| [Openfire](https://www.igniterealtime.org/projects/openfire/) | [inverse](https://www.igniterealtime.org/projects/openfire/plugins.jsp) |
| [Prosody](https://prosody.im/) | [mod_conversejs](https://modules.prosody.im/mod_conversejs.html) |
| [Ejabberd](https://ejabberd.im/) | [mod-conversejs](https://docs.ejabberd.im/admin/configuration/modules/#mod-conversejs) |

### Web Frameworks & CMS
| Platform | Integration |
|----------|-------------|
| [Elgg](https://elgg.org) | [plugin](https://elgg.org/plugins/2997196) |
| [Peertube](https://github.com/JohnXLivingston/peertube-plugin-livechat) | [peertube-plugin-livechat](https://github.com/JohnXLivingston/peertube-plugin-livechat) |
| [Pàdé](https://www.igniterealtime.org/projects/pade/index.jsp) | [Pàdé](https://www.igniterealtime.org/projects/pade/index.jsp) |
| [Roundcube](https://roundcube.net) | [roundcube-converse.js-xmpp-plugin](https://github.com/devurandom/roundcube-converse.js-xmpp-plugin) |
| [Tiki Wiki CMS Groupware](https://tiki.org) | [built-in optional feature](https://doc.tiki.org/XMPP) |
| [Ubuntu-Touch](https://open-store.io/app/conversejs.luigi311) | [ConverseJS for Ubuntu-Touch](https://open-store.io/app/conversejs.luigi311) |
| [WordPress](https://wordpress.org) | [ConverseJS Plugin](https://wordpress.org/plugins/conversejs/) |

## Support the Project

If you find Converse useful, please consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/jcbrand)
- [Patreon](https://www.patreon.com/jcbrand)
- [Liberapay](https://liberapay.com/jcbrand)

Thanks to everyone who has supported this project over the years through donations, testing, bug reports, and code contributions.

## Sponsors

<div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: center;">
  <a href="https://bairesdev.com/sponsoring-open-source-projects/?utm_source=conversejs" target="_blank" rel="noopener">
    <img alt="BairesDev" src="https://raw.githubusercontent.com/conversejs/media/main/logos/bairesdev-primary.png" width="200">
  </a>
  <a href="https://blokt.com?utm_source=conversejs" target="_blank" rel="noopener">
    <img alt="Blokt Crypto & Privacy" src="https://raw.githubusercontent.com/conversejs/converse.js/541613d1fea8aef364af00180f60e959162e5e4b/logo/blokt.png" width="200">
  </a>
  <a href="https://www.keycdn.com?utm_source=conversejs" target="_blank" rel="noopener">
    <img alt="KeyCDN" src="https://raw.githubusercontent.com/conversejs/converse.js/541613d1fea8aef364af00180f60e959162e5e4b/logo/keycdn.png" width="200">
  </a>
</div>
