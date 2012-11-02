===========
converse.js
===========

``Converse.js`` implements an XMPP_ based instant messaging client in the browser.

*Warning*: *This library is still heavily under development and not usable currently.*

--------
Features
--------

It has the following features:

* Manually or automically subscribe to other users. 
* With manual roster subscriptions, you can accept or decline contact requests.
* Chat statuses (online, busy, away, offline)
* Custom status message
* Typing notifications (i.e when the contact is typing)
* Third person messages (/me )
* Multi-user chat in chatrooms
* Topics can be set for chatrooms
* Full name and profile picture support 

Converse.js is used by collective.xmpp.chat_, which is a Plone_ instant
messaging add-on.

A screencast of ``Converse.js`` in action via ``collective.xmpp.chat`` can be seen here_.

It depends on quite a few third party libraries, including strophe.js_,
backbone.js_ and require.js_.

-------
Licence
-------

``Converse.js`` is released under both the MIT_ and GPL_ licenses.

.. _strophe.js: http://strophe.im/strophejs
.. _backbone.js: http:/backbonejs.org
.. _require.js: http:/requirejs.org
.. _collective.xmpp.chat: http://github.com/collective/collective.xmpp.chat
.. _Plone: http://plone.org
.. _XMPP: http://xmpp.org
.. _MIT: http://opensource.org/licenses/mit-license.php
.. _GPL: http://opensource.org/licenses/gpl-license.php
.. _here: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
