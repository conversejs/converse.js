===========
converse.js
===========

Converse.js_ implements an XMPP_ based instant messaging client in the browser.

It is used by collective.xmpp.chat_, which is a Plone_ instant messaging add-on.

The ultimate goal is to enable anyone to add chat functionality to their websites, regardless of the backend.
This is currently possible, except for adding new contacts, which still makes an XHR call to the (Plone) backend to fetch user info.

--------
Features
--------

It has the following features:

* Manually or automically subscribe to other users.
* Accept or decline contact requests
* Chat status (online, busy, away, offline)
* Custom status messages
* Typing notifications
* Third person messages (/me )
* Multi-user chat in chatrooms
* Chatroom Topics
* vCard support

-----------
Screencasts
-----------

* `In a static HTML page`_. Here we chat to external XMPP accounts on Jabber.org and Gmail.
* `Integrated into a Plone site`_ via collective.xmpp.chat.

------------
Dependencies
------------

It depends on quite a few third party libraries, including:

* strophe.js_
* backbone.js_ 
* require.js_

-------
Licence
-------

``Converse.js`` is released under both the MIT_ and GPL_ licenses.

.. _Converse.js: http://conversejs.org
.. _strophe.js: http://strophe.im/strophejs
.. _backbone.js: http:/backbonejs.org
.. _require.js: http:/requirejs.org
.. _collective.xmpp.chat: http://github.com/collective/collective.xmpp.chat
.. _Plone: http://plone.org
.. _XMPP: http://xmpp.org
.. _MIT: http://opensource.org/licenses/mit-license.php
.. _GPL: http://opensource.org/licenses/gpl-license.php
.. _here: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
.. _Screencast2: http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript
.. _`Integrated into a Plone site`: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
.. _`In a static HTML page`: http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript
