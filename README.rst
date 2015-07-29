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
* Multi-user chat rooms `XEP 45 <http://xmpp.org/extensions/xep-0045.html>`_
* Direct invitations to chat rooms `XEP 249 <http://xmpp.org/extensions/xep-0249.html>`_
* vCard support `XEP 54 <http://xmpp.org/extensions/xep-0054.html>`_
* Service discovery `XEP 30 <http://xmpp.org/extensions/xep-0030.html>`_
* In-band registration `XEP 77 <http://xmpp.org/extensions/xep-0077.html>`_
* Contact rosters and groups
* Contact subscriptions
* Roster item exchange `XEP 144 <http://xmpp.org/extensions/tmp/xep-0144-1.1.html>`_
* Chat statuses (online, busy, away, offline)
* Custom status messages
* Typing and state notifications `XEP 85 <http://xmpp.org/extensions/xep-0085.html>`_
* Messages appear in all connnected chat clients `XEP 280 <http://xmpp.org/extensions/xep-0280.html>`_
* Third person "/me" messages `XEP 245 <http://xmpp.org/extensions/xep-0245.html>`_
* XMPP Ping `XEP 199 <http://xmpp.org/extensions/xep-0199.html>`_
* Server-side archiving of messages `XEP 313 <http://xmpp.org/extensions/xep-0313.html>`_
* Client state indication `XEP 352 <http://xmpp.org/extensions/xep-0352.html>`_
* Off-the-record encryption
* Translated into 16 languages

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
    `django-xmpp <https://github.com/fpytloun/django-xmpp>`_ adds XMPP chat integration with converse.js by letting Ejabberd authenticate against your Django site.
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
