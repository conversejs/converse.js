===========
converse.js
===========

.. figure:: https://api.travis-ci.org/jcbrand/converse.js.png?branch=master
   :alt: Build Status

Converse.js_ is a web based `XMPP/Jabber`_ instant messaging client.

It enables you to add chat functionality to your website, independent of any
specific backend. You will however need an XMPP server to connect to, either
your own, or a public one.

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
* Translated into multiple languages  (af, de, es, fr, it, hu, pt-BR, ru)
* Off-the-record encryption support (via `OTR.js <http://arlolra.github.io/otr>`_)

-----------
Screencasts
-----------

* `In a static HTML page`_. Here we chat to external XMPP accounts on Jabber.org and Gmail.
* `Integrated into a Plone site`_ via collective.xmpp.chat.
* `Off-the-record encryption <https://opkode.com/media/blog/2013/11/11/conversejs-otr-support>`_ in Converse 0.7.

Integration into other frameworks
---------------------------------

* `Plone <http://plone.org>`_: 
    `collective.xmpp.chat <http://github.com/collective/collective.xmpp.chat>`_ is an add-on for Plone that uses *Converse.js*. Together with `collective.xmpp.core <http://github.com/collective/collective.xmpp.core>`_, it provides for single-signon-support (SSO) and also enables you to manually or automatically register your Plone users onto your XMPP server.
* `Django <http://www.djangoproject.com>`_: 
    `django-conversejs <https://pypi.python.org/pypi/django-conversejs>`_ is an app that makes it easer to integrate *Converse.js* into Django.
* `Roundcube <http://roundcube.net>`_: 
    `roundcube-converse.js-xmpp-plugin <https://github.com/priyadi/roundcube-converse.js-xmpp-plugin>`_ is a plugin for Roundcube Webmail.

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

------
Donate
------

* Bitcoin: 16FsPqE9DhFTryxrUenpsGX4LJ1TPu8GqS
* Litecoin: LLvLH6qJch7HAamLguHkwobCrxmHLhiwZw

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
