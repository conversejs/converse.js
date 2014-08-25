===========
converse.js
===========

.. figure:: https://api.travis-ci.org/jcbrand/converse.js.png?branch=master
   :alt: Build Status

`Converse.js <https://conversejs.org>`_ is a web based `XMPP/Jabber <http://xmpp.org>`_
instant messaging client.

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
* Translated into multiple languages  (af, de, en, es, fr, he, hu, id, it, ja, nl, pt_BR, ru)
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
* `Wordpress <http://wordpress.org>`_:
    `ConverseJS <http://wordpress.org/plugins/conversejs>`_
* `Patternslib <http://patternslib.com>`_:
    `patterns.converse <https://github.com/jcbrand/patterns.converse>`_ provides a Patternslib pattern for Converse.js
* `Alfresco <http://www.alfresco.com>`_:
    `alfresco-js-chat-share`_: `alfresco-js-chat-share <https://github.com/keensoft/alfresco-js-chat-share>`_

----
Demo
----

A live demo is available at `<https://conversejs.org>`_

-----
Tests
-----

We use behavior-driven tests written with `jasmine.js <http://pivotal.github.io/jasmine>`_.

Open `tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
in your browser, and the tests will run automatically.

-------------
Documentation
-------------

The developer/integrator documentation can be found at `<https://conversejs.org/docs/html>`_.

-------
Licence
-------

``Converse.js`` is released under the `Mozilla Public License (MPL) <https://www.mozilla.org/MPL/2.0/index.txt>`_.

-------
Support
-------

For support queries and discussions, please join the mailing list: conversejs@librelist.com

Also take a look at the `mailing list archives <http://librelist.com/browser/conversejs>`_.

Issues can be logged on the `Github issue tracker <https://github.com/jcbrand/converse.js/issues>`_.

----------------------------------
Donations and tips are appreciated
----------------------------------

* Bitcoin: 16FsPqE9DhFTryxrUenpsGX4LJ1TPu8GqS

.. _`Integrated into a Plone site`: http://opkode.com/media/blog/instant-messaging-for-plone-with-javascript-and-xmpp
.. _`In a static HTML page`: http://opkode.com/media/blog/2013/04/02/converse.js-xmpp-instant-messaging-with-javascript
