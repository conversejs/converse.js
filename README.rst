===========
converse.js
===========

.. figure:: https://api.travis-ci.org/jcbrand/converse.js.png?branch=master
   :alt: Build Status

Converse.js_ is a web based `XMPP/Jabber`_ instant messaging client.

It enables you to add chat functionality to your website, independent of any
specific backend. You will however need an XMPP server to connect to, either
your own, or a public one.

It is used by collective.xmpp.chat_, which is a Plone_ instant messaging add-on.

--------
Features
--------

It has the following features:

* Single-user chat
* Multi-user chat in chatrooms
* vCard support
* Service discovery
* Contact rosters
* Manually or automically subscribe to other contacts
* Accept or decline contact requests
* Roster item exchange
* Chat statuses (online, busy, away, offline)
* Custom status messages
* Typing notifications
* Third person messages (/me )
* Translated into multiple languages  (af, de, es, it, pt_BR)

-----------
Screencasts
-----------

* `In a static HTML page`_. Here we chat to external XMPP accounts on Jabber.org and Gmail.
* `Integrated into a Plone site`_ via collective.xmpp.chat.

----
Demo
----

A live demo is available at `conversejs.org`_

-----
Tests
-----

We use behavior-driven tests written with jasmine.js_. They can run in your
browser or in the command line via phantom.js_.

-------------
Documentation
-------------

The developer/integrator documentation can be found at `<http://conversejs.org/docs/html>`_.


------------
Dependencies
------------

It depends on quite a few third party libraries, including:

* jquery_
* strophe.js_
* backbone.js_ 

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
.. _`XMPP/Jabber`: http://xmpp.org
.. _MIT: http://opensource.org/licenses/mit-license.php
.. _GPL: http://opensource.org/licenses/gpl-license.php
.. _here: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
.. _Screencast2: http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript
.. _`Integrated into a Plone site`: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
.. _`In a static HTML page`: http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript
.. _`conversejs.org`: http://conversejs.org
.. _jquery: http://jquery.com
.. _jasmine.js: http://pivotal.github.io/jasmine
.. _phantom.js: http://phantomjs.org
.. _`Travis-CI`: https://travis-ci.org
