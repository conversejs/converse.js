# Converse

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

### Converse in overlay mode

![Screenshot of Converse](https://opkode.com/img/Screen-Shot-2018-09-19-at-19.15.16.png)

## Converse in fullpage mode

![Screenshot of Converse in fullpage mode](https://opkode.com/img/Screen-Shot-2018-09-19-at-19.16.46.png)

## Documentation

The developer/integrator documentation can be found at [https://conversejs.org/docs/html](https://conversejs.org/docs/html).

You'll probably want to begin with the [quickstart guide](https://conversejs.org/docs/html/quickstart.html),
which shows you how to use the CDN (content delivery network) to quickly get a demo up and running.

## Features
-   Available as overlayed chat boxes or as a fullscreen application. See [inverse.chat](https://inverse.chat) for the fullscreen version.
-   A [plugin architecture](https://conversejs.org/docs/html/plugin_development.html) based on [pluggable.js](https://conversejs.github.io/pluggable.js/)
-   Single-user and group chats
-   Contacts and groups
-   Multi-user chat rooms [XEP 45](https://xmpp.org/extensions/xep-0045.html)
-   Chatroom bookmarks [XEP 48](https://xmpp.org/extensions/xep-0048.html)
-   Direct invitations to chat rooms [XEP 249](https://xmpp.org/extensions/xep-0249.html)
-   vCard support [XEP 54](https://xmpp.org/extensions/xep-0054.html)
-   Service discovery [XEP 30](https://xmpp.org/extensions/xep-0030.html)
-   In-band registration [XEP 77](https://xmpp.org/extensions/xep-0077.html)
-   Roster item exchange [XEP 144](https://xmpp.org/extensions/tmp/xep-0144-1.1.html)
-   Chat statuses (online, busy, away, offline)
-   Custom status messages
-   Typing and state notifications [XEP 85](https://xmpp.org/extensions/xep-0085.html)
-   Desktop notifications
-   File sharing / HTTP File Upload [XEP 363](https://xmpp.org/extensions/xep-0363.html)
-   Messages appear in all connnected chat clients / Message Carbons [XEP 280](https://xmpp.org/extensions/xep-0280.html)
-   Third person "/me" messages [XEP 245](https://xmpp.org/extensions/xep-0245.html)
-   XMPP Ping [XEP 199](https://xmpp.org/extensions/xep-0199.html)
-   Server-side archiving of messages [XEP 313](https://xmpp.org/extensions/xep-0313.html)
-   Hidden Messages (aka Spoilers) [XEP 382](https://xmpp.org/extensions/xep-0382.html)
-   Client state indication [XEP 352](https://xmpp.org/extensions/xep-0352.html)
-   Last Message Correction [XEP 308](https://xmpp.org/extensions/xep-0308.html)
-   Off-the-record encryption
-   OMEMO encrypted messaging [XEP 384](https://xmpp.org/extensions/xep-0384.html")
-   Supports anonymous logins, see the [anonymous login demo](https://conversejs.org/demo/anonymous.html).
-   Translated into 28 languages

## Integration into other frameworks

-   **[Prosody](https://prosody.im/)**: [mod_conversejs](https://modules.prosody.im/mod_conversejs.html)
-   **[Openfire](https://www.igniterealtime.org/projects/openfire/index.jsp)**: [inverse.jar](https://www.igniterealtime.org/projects/openfire/plugins.jsp)
-   **[Ruby on Rails](https://rubyonrails.org)**: [conversejs-rails](https://github.com/mikemarsian/conversejs-rails)
-   **[Django](https://www.djangoproject.com)**: [django-conversejs](https://pypi.python.org/pypi/django-conversejs) or [django-xmpp](https://github.com/fpytloun/django-xmpp)
-   **[Patternslib](http://patternslib.com)**: [patterns.converse](https://github.com/jcbrand/patterns.converse)
-   **[Roundcube](https://roundcube.net)**: [roundcube-converse.js-xmpp-plugin](https://github.com/devurandom/roundcube-converse.js-xmpp-plugin)
-   **[Wordpress](https://wordpress.org)**: [ConverseJS](https://wordpress.org/plugins/conversejs/)
-   **[Plone](https://plone.com)**: [collective.converse](https://github.com/collective/collective.converse)
-   **[Alfresco](https://www.alfresco.com)**: [alfresco-js-chat-share](https://github.com/keensoft/alfresco-js-chat-share)
-   **[Friendica](https://friendi.ca)**: [converse](https://github.com/friendica/friendica-addons/tree/master/xmpp/converse)
-   **[Tiki Wiki CMS Groupware](https://tiki.org)**: [built-in optional feature](https://doc.tiki.org/XMPP)

## Tests

We use behavior-driven tests written with [jasmine.js](https://jasmine.github.io/).

Open [tests.html](https://github.com/conversejs/converse.js/blob/master/tests.html) in your browser, and the tests will run automatically.

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
