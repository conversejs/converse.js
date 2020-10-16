<h2 align="center">
  <a href="https://conversejs.org" target="_blank" rel="noopener">
    <img alt="Converse.js" src="https://github.com/conversejs/converse.js/blob/master/logo/readme.png" width="480">
  </a>
</h2>


[![XMPP Chat](https://inverse.chat/badge.svg?room=discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![Travis](https://api.travis-ci.org/conversejs/converse.js.png?branch=master)](https://travis-ci.org/conversejs/converse.js)
[![Bountysource bounties](https://img.shields.io/bountysource/team/converse.js/activity.svg?maxAge=2592000)](https://www.bountysource.com/teams/converse.js/issues?tracker_ids=194169)
[![Translation status](https://hosted.weblate.org/widgets/conversejs/-/svg-badge.svg)](https://hosted.weblate.org/engage/conversejs/?utm_source=widget)

[Converse](https://conversejs.org) is a web based [XMPP/Jabber](https://xmpp.org) chat client.

You can either use it as a webchat app, or you can integrate it into your own website.

It's 100% client-side JavaScript, HTML and CSS and the only backend required
is a modern XMPP server.

Please support this project via [Patreon](https://www.patreon.com/jcbrand) or [Liberapay](https://liberapay.com/jcbrand)

## Demo

Converse is hosted and can be used at [https://conversejs.org](https://conversejs.org).

A demo showing anonymous login is available at [https://conversejs.org/demo/anonymous.html](https://conversejs.org/demo/anonymous.html)
and a demo which shows how you can embed a single chat room into a page is
avialable at [https://conversejs.org/demo/embedded.html](https://conversejs.org/demo/embedded.html).

## Documentation

The developer/integrator documentation can be found at [https://conversejs.org/docs/html](https://conversejs.org/docs/html).

You'll probably want to begin with the [quickstart guide](https://conversejs.org/docs/html/quickstart.html),
which shows you how to use the CDN (content delivery network) to quickly get a demo up and running.

## Converse modes

### Overlay

In overlay mode, Converse appears overlayed chats on top of the website.

![Screenshot of Converse in overlay mode](https://opkode.com/img/Screen-Shot-2018-09-19-at-19.15.16.png)

### Fullpage

In fullpage mode, Converse behaves like a single-page app that covers the whole browser viewport.

![Screenshot of Converse in fullpage mode](https://opkode.com/img/Screen-Shot-2018-09-19-at-19.16.46.png)

### Embedded

In embedded mode, Converse can be embedded into an element in the DOM.

![Screenshot of Converse in embedded mode](https://opkode.com/img/Converse-embedded.png)

## Features
-   Available as overlayed chat boxes or as a fullscreen application. See [inverse.chat](https://inverse.chat) for the fullscreen version.
-   Custom status messages
-   Desktop notifications
-   A [plugin architecture](https://conversejs.org/docs/html/plugin_development.html) based on [pluggable.js](https://conversejs.github.io/pluggable.js/)
-   Chat statuses (online, busy, away, offline)
-   Anonymous logins, see the [anonymous login demo](https://conversejs.org/demo/anonymous.html)
-   Translated into over 30 languages

### Supported XMPP Extensions

- [RFC-7395](https://tools.ietf.org/html/rfc7395) XMPP Subprotocol support for WebSocket
- [XEP-0004](https://xmpp.org/extensions/xep-0004.html) Data Forms
- [XEP-0030](https://xmpp.org/extensions/xep-0030.html) Service discovery
- [XEP-0045](https://xmpp.org/extensions/xep-0045.html) Multi-user chat rooms
- [XEP-0048](https://xmpp.org/extensions/xep-0048.html) Bookmarks
- [XEP-0050](https://xmpp.org/extensions/xep-0050.html) Ad-Hoc Commands
- [XEP-0054](https://xmpp.org/extensions/xep-0054.html) VCard-temp
- [XEP-0059](https://xmpp.org/extensions/xep-0059.html) Result Set Management
- [XEP-0060](https://xmpp.org/extensions/xep-0060.html) Publish-Subscribe (limited support)
- [XEP-0066](https://xmpp.org/extensions/xep-0066.html) Out of Band Data
- [XEP-0077](https://xmpp.org/extensions/xep-0077.html) In-band registration
- [XEP-0085](https://xmpp.org/extensions/xep-0085.html) Chat State Notifications
- [XEP-0124](https://xmpp.org/extensions/xep-0124.html) Bidirectional-streams Over Synchronous HTTP (BOSH)
- [XEP-0144](https://xmpp.org/extensions/xep-0144.html) Roster item exchange
- [XEP-0156](https://xmpp.org/extensions/xep-0156.html) Discovering Alternative XMPP Connection Methods
- [XEP-0163](https://xmpp.org/extensions/xep-0163.html) Personal Eventing Protocol (limited support)
- [XEP-0184](https://xmpp.org/extensions/xep-0184.html) Message Receipt
- [XEP-0198](https://xmpp.org/extensions/xep-0198.html) Stream Management
- [XEP-0199](https://xmpp.org/extensions/xep-0199.html) XMPP Ping
- [XEP-0203](https://xmpp.org/extensions/xep-0203.html) Delayed Delivery
- [XEP-0206](https://xmpp.org/extensions/xep-0206.html) XMPP Over BOSH
- [XEP-0245](https://xmpp.org/extensions/xep-0245.html) The /me Command
- [XEP-0249](https://xmpp.org/extensions/xep-0249.html) Direct MUC Invitations
- [XEP-0280](https://xmpp.org/extensions/xep-0280.html) Message Carbons
- [XEP-0297](https://xmpp.org/extensions/xep-0297.html) Stanza Forwarding (limited support)
- [XEP-0308](https://xmpp.org/extensions/xep-0308.html) Last Message Correction
- [XEP-0313](https://xmpp.org/extensions/xep-0313.html) Message Archive Management
- [XEP-0317](https://xmpp.org/extensions/xep-0317.html) Hats (limited support)
- [XEP-0333](https://xmpp.org/extensions/xep-0333.html) Chat Markers (limited support)
- [XEP-0352](https://xmpp.org/extensions/xep-0352.html) Client State Indication
- [XEP-0357](https://xmpp.org/extensions/xep-0357.html) Push Notifications
- [XEP-0359](https://xmpp.org/extensions/xep-0359.html) Unique and Stable Stanza IDs
- [XEP-0363](https://xmpp.org/extensions/xep-0363.html) HTTP File Upload
- [XEP-0372](https://xmpp.org/extensions/xep-0372.html) References
- [XEP-0382](https://xmpp.org/extensions/xep-0382.html) Spoiler messages
- [XEP-0384](https://xmpp.org/extensions/xep-0384.html) OMEMO Encryption
- [XEP-0393](https://xmpp.org/extensions/xep-0393.html) Message styling
- [XEP-0422](https://xmpp.org/extensions/xep-0422.html) Message Fastening (limited support)
- [XEP-0424](https://xmpp.org/extensions/xep-0424.html) Message Retractions
- [XEP-0425](https://xmpp.org/extensions/xep-0425.html) Message Moderation


## Integration into other servers and frameworks

-   **[Alfresco](https://www.alfresco.com)**: [alfresco-js-chat-share](https://github.com/keensoft/alfresco-js-chat-share)
-   **[Django](https://www.djangoproject.com)**: [django-conversejs](https://pypi.python.org/pypi/django-conversejs) or [django-xmpp](https://github.com/fpytloun/django-xmpp)
-   **[Elgg](https://elgg.org)**: [plugin](https://elgg.org/plugins/2997196)
-   **[Friendica](https://friendi.ca)**: [converse](https://github.com/friendica/friendica-addons/tree/master/xmpp/converse)
-   **[Openfire](https://www.igniterealtime.org/projects/openfire/index.jsp)**: [inverse.jar](https://www.igniterealtime.org/projects/openfire/plugins.jsp)
-   **[Patternslib](http://patternslib.com)**: [patterns.converse](https://github.com/jcbrand/patterns.converse)
-   **[Plone](https://plone.com)**: [collective.converse](https://github.com/collective/collective.converse)
-   **[Prosody](https://prosody.im/)**: [mod_conversejs](https://modules.prosody.im/mod_conversejs.html)
-   **[Pàdé](https://www.igniterealtime.org/projects/pade/index.jsp)**: [Pàdé](https://www.igniterealtime.org/projects/pade/index.jsp)
-   **[Roundcube](https://roundcube.net)**: [roundcube-converse.js-xmpp-plugin](https://github.com/devurandom/roundcube-converse.js-xmpp-plugin)
-   **[Ruby on Rails](https://rubyonrails.org)**: [conversejs-rails](https://github.com/mikemarsian/conversejs-rails)
-   **[Tiki Wiki CMS Groupware](https://tiki.org)**: [built-in optional feature](https://doc.tiki.org/XMPP)
-   **[Wordpress](https://wordpress.org)**: [ConverseJS](https://wordpress.org/plugins/conversejs/)


## Tests

We use behavior-driven tests written with [jasmine.js](https://jasmine.github.io/).

Run `make check` to execute all the tests.

## Licence

`Converse.js` is released under the [Mozilla Public License (MPL)](https://www.mozilla.org/MPL/2.0/index.txt).

## Attribution

Emoji images are courtesy of [Twemoji](https://emojitwo.github.io/).

## Support

Issues can be logged on the [Github issue tracker](https://github.com/conversejs/converse.js/issues).

## Donations

A heartfelt thanks for everyone who has supported this project over the years.
Many people have contributed testing, bugfixes, features and corrections.

We accept donations via [Patreon](https://www.patreon.com/jcbrand) and [Liberapay](https://liberapay.com/jcbrand).
