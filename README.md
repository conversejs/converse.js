# converse.js

[![Travis](https://api.travis-ci.org/jcbrand/converse.js.png?branch=master)](https://travis-ci.org/jcbrand/converse.js)
[![Bountysource bounties](https://img.shields.io/bountysource/team/converse.js/activity.svg?maxAge=2592000)](https://www.bountysource.com/teams/converse.js/issues?tracker_ids=194169)
[![Translation status](https://hosted.weblate.org/widgets/conversejs/-/svg-badge.svg)](https://hosted.weblate.org/engage/conversejs/?utm_source=widget)

[Converse.js](https://conversejs.org) is a web based [XMPP/Jabber](http://xmpp.org) instant messaging client.

It enables you to add chat functionality to your website, independent of
any specific backend. You will however need an XMPP server to connect
to, either your own, or a public one.

## Demo

Converse.js is hosted and can be used at [https://conversejs.org](https://conversejs.org).

A demo showing anonymous login is available at [https://conversejs.org/demo/anonymous.html](https://conversejs.org/demo/anonymous.html)
and a demo which shows how you can embed a single chat room into a page is
avialable at [https://conversejs.org/demo/embedded.html](https://conversejs.org/demo/embedded.html).

### Converse.js: As seen on the conversejs.org website

![Screenshot of Converse.js](https://opkode.com/img/converse-screenshot.png)

### inVerse: a fullscreen version of converse.js

Converse.js is also available in a fullscreen version, called [inVerse](https://inverse.chat)

![Screenshot of inVerse](https://opkode.com/img/inverse-screenshot.png)

## Documentation

The developer/integrator documentation can be found at [https://conversejs.org/docs/html](https://conversejs.org/docs/html).

You'll probably want to begin with the [quickstart guide](https://conversejs.org/docs/html/quickstart.html),
which shows you how to use the CDN (content delivery network) to quickly get a demo up and running.

## Features

-   Single-user chat
-   Contacts and groups
-   Multi-user chat rooms [XEP 45](http://xmpp.org/extensions/xep-0045.html)
-   Direct invitations to chat rooms [XEP 249](http://xmpp.org/extensions/xep-0249.html)
-   vCard support [XEP 54](http://xmpp.org/extensions/xep-0054.html)
-   Service discovery [XEP 30](http://xmpp.org/extensions/xep-0030.html)
-   In-band registration [XEP 77](http://xmpp.org/extensions/xep-0077.html)
-   Chat room bookmarks [XEP 48](http://xmpp.org/extensions/xep-0048.html)
-   Roster item exchange [XEP 144](http://xmpp.org/extensions/tmp/xep-0144-1.1.html)
-   Chat statuses (online, busy, away, offline)
-   Custom status messages
-   Desktop notifications
-   Typing and state notifications [XEP 85](http://xmpp.org/extensions/xep-0085.html)
-   Messages appear in all connnected chat clients [XEP 280](http://xmpp.org/extensions/xep-0280.html)
-   Third person "/me" messages [XEP 245](http://xmpp.org/extensions/xep-0245.html)
-   XMPP Ping [XEP 199](http://xmpp.org/extensions/xep-0199.html)
-   Server-side archiving of messages [XEP 313](http://xmpp.org/extensions/xep-0313.html)
-   Client state indication [XEP 352](http://xmpp.org/extensions/xep-0352.html)
-   Off-the-record encryption
-   Translated into 16 languages

## Integration into other frameworks

-   **[Ruby on Rails](http://rubyonrails.org)**: [conversejs-rails](https://github.com/mikemarsian/conversejs-rails)
-   **[Django](http://www.djangoproject.com)**: [django-conversejs](https://pypi.python.org/pypi/django-conversejs) or [django-xmpp](https://github.com/fpytloun/django-xmpp)
-   **[Plone](http://plone.com)**: [collective.xmpp.chat](http://github.com/collective/collective.xmpp.chat)
-   **[Roundcube](http://roundcube.net)**: [roundcube-converse.js-xmpp-plugin](https://github.com/devurandom/roundcube-converse.js-xmpp-plugin)
-   **[Wordpress](http://wordpress.org)**: [ConverseJS](http://wordpress.org/plugins/conversejs)
-   **[Patternslib](http://patternslib.com)**: [patterns.converse](https://github.com/jcbrand/patterns.converse)
-   **[Alfresco](http://www.alfresco.com)**: [alfresco-js-chat-share](https://github.com/keensoft/alfresco-js-chat-share)
-   **[Friendica](http://friendica.com)**: [converse](https://github.com/friendica/friendica-addons/tree/master/xmpp/converse)

## Screencasts

*Note: These screencasts are already quite old! Converse.js has grown and evolved further since then.*

-   [In a static HTML page](http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript).
    Here we chat to external XMPP accounts on Jabber.org and Gmail.
-   [Integrated into a Plone site](http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp)
    via collective.xmpp.chat.
-   [Off-the-record encryption](https://opkode.com/media/blog/2013/11/11/conversejs-otr-support)
    in Converse 0.7.

## Tests

We use behavior-driven tests written with [jasmine.js](https://jasmine.github.io/).

Open [tests.html](https://github.com/jcbrand/converse.js/blob/master/tests.html) in your browser, and the tests will run automatically.

## Licence

`Converse.js` is released under the [Mozilla Public License (MPL)](https://www.mozilla.org/MPL/2.0/index.txt).

## Support

For support queries and discussions, please join the mailing list: <conversejs@librelist.com>

Also take a look at the [mailing list archives](http://librelist.com/browser/conversejs).

Issues can be logged on the [Github issue tracker](https://github.com/jcbrand/converse.js/issues).
