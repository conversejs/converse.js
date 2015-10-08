.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup.rst">Edit me on GitHub</a></div>

=====================
Setup and integration
=====================

.. contents:: Table of Contents
   :depth: 2
   :local:

.. _what-you-will-need:

------------------
What you will need
------------------

If you'd like to host your own version of converse.js or you would like to
integrate it into your website, then you'll need to set up and configure some
more server components.

For example, if you want to allow chat accounts under your own domain (for
example, the same domain as your website), then you will need to set up your
own :ref:`XMPP server`.

Besides an XMPP server, you also need a way for converse.js (which uses HTTP), to
communicate with XMPP servers (which use XMPP).

For this, you'll need :ref:`BOSH Connection Manager`.

Lastly, if you want to maintain a single chat session for your website's users,
you'll need to set up a BOSH session on your server, which converse.js can then
connect to once the page loads. Please see the section: :ref:`session-support`.

.. _`XMPP server`:

--------------
An XMPP server
--------------

*Converse.js* implements `XMPP <http://xmpp.org/about-xmpp/>`_ as its
messaging protocol, and therefore needs to connect to an XMPP/Jabber
server (Jabber is really just a synonym for XMPP).

You can connect to public XMPP servers like ``jabber.org`` but if you want to
have :ref:`session support <session-support>` you'll have to set up your own XMPP server.

You can find a list of public XMPP servers/providers on `xmpp.net <http://xmpp.net>`_ and a list of
servers that you can set up yourself on `xmpp.org <http://xmpp.org/xmpp-software/servers/>`_.


.. _`BOSH connection manager`:

-------------------------
A BOSH Connection Manager
-------------------------

Your website and *Converse.js* use `HTTP <https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol>`_
as protocol to communicate with the webserver. HTTP connections are stateless and usually shortlived.

`XMPP <https://en.wikipedia.org/wiki/Xmpp>`_ on the other hand, is the protocol that enables instant messaging, and
its connections are stateful and usually longer.

To enable a web application like *Converse.js* to communicate with an XMPP
server, we need a proxy which acts as a bridge between these two protocols.

This is the job of a BOSH connection manager. BOSH (Bidirectional-streams Over
Synchronous HTTP) is a protocol for allowing XMPP communication over HTTP. The
protocol is defined in `XEP-0206: XMPP Over BOSH <http://xmpp.org/extensions/xep-0206.html>`_.

Popular XMPP servers such as `ejabberd <http://www.ejabberd.im>`_,
`prosody <http://prosody.im/doc/setting_up_bosh>`_ and
`openfire <http://www.igniterealtime.org/projects/openfire/>`_ all include
their own connection managers (but you usually have to enable them in the
configuration).

However, if you intend to support multiple different servers (like
https://conversejs.org does), then you'll need a standalone connection manager.

For a standalone manager, see for example `Punjab <https://github.com/twonds/punjab>`_
and `node-xmpp-bosh <https://github.com/dhruvbird/node-xmpp-bosh>`_.

The demo on the `Converse.js homepage <http://conversejs.org>`_ uses a connection
manager located at https://conversejs.org/http-bind.

This connection manager is available for testing purposes only, please don't
use it in production.

Websockets
==========

Websockets provide an alternative means of connection to an XMPP server from
your browser.

Websockets provide long-lived, bidirectional connections which do not rely on
HTTP. Therefore BOSH, which operates over HTTP, doesn't apply to websockets.

`Prosody <http://prosody.im>`_ (from version 0.10) supports websocket connections, as
does the node-xmpp-bosh connection manager.

Overcoming cross-domain request restrictions
============================================

Lets say your domain is *example.org*, but the domain of your connection
manager is *example.com*.

HTTP requests are made by *Converse.js* to the connection manager via XmlHttpRequests (XHR).
Until recently, it was not possible to make such requests to a different domain
than the one currently being served (to prevent XSS attacks).

Luckily there is now a standard called
`CORS <https://en.wikipedia.org/wiki/Cross-origin_resource_sharing>`_
(Cross-origin resource sharing), which enables exactly that.
Modern browsers support CORS, but there are problems with Internet Explorer < 10.

IE 8 and 9 partially support CORS via a proprietary implementation called
XDomainRequest. There is a `Strophe.js plugin <https://gist.github.com/1095825/6b4517276f26b66b01fa97b0a78c01275fdc6ff2>`_
which you can use to enable support for XDomainRequest when it is present.

In IE < 8, there is no support for CORS.

Instead of using CORS, you can add a reverse proxy in
Apache/Nginx which serves the connection manager under the same domain as your
website. This will remove the need for any cross-domain XHR support.

For example:
------------

Assuming your site is accessible on port ``80`` for the domain ``mysite.com``
and your connection manager manager is running at ``someothersite.com/http-bind``.

The *bosh_service_url* value you want to give Converse.js to overcome
the cross-domain restriction is ``mysite.com/http-bind`` and not
``someothersite.com/http-bind``.

Your ``nginx`` or ``apache`` configuration will look as follows:

Nginx
~~~~~

.. code-block:: nginx

    http {
        server {
            listen       80
            server_name  mysite.com;
            location ~ ^/http-bind/ {
                proxy_pass http://someothersite.com;
            }
        }
    }

Apache
~~~~~~

.. code-block:: apache

    <VirtualHost *:80>
        ServerName mysite.com
        RewriteEngine On
        RewriteRule ^/http-bind(.*) http://someothersite.com/http-bind$1 [P,L]
    </VirtualHost>


.. _`session-support`:

----------------------
Single Session Support
----------------------

.. note::
    What is prebinding?

    **Prebind** refers to a technique whereby your web application sets up an
    authenticated BOSH session with a BOSH connection manager (which could be your
    XMPP server). Then later, in the browser, converse.js attaches to that
    session that was previously set up.

    This reduces network traffic and also speeds up loading times for
    converse.js. Additionally, because prebinding works with tokens, it's not necessary
    for the XMPP client to store users' passwords).

Server-side authentication (prebind)
====================================

It's possible to enable shared sessions whereby users already
authenticated in your website will also automatically be logged in on the XMPP server,

This session can also be made to persist across page loads. In other words, we want
a user to automatically be logged in to chat when they log in to the website,
and we want their chat session to persist across page loads.

To do this you will require a `BOSH server <http://xmpp.org/about-xmpp/technology-overview/bosh/>`_
for converse.js to connect to (see the :ref:`bosh-service-url` under :ref:`configuration-variables`)
as well as a BOSH client in your web application (written for example in
Python, Ruby or PHP) that will set up an authenticated BOSH session, which
converse.js can then attach to.

.. note::
    A BOSH server acts as a bridge between HTTP, the protocol of the web, and
    XMPP, the instant messaging protocol.
    Converse.js can only communicate via HTTP, but we need to communicate with
    an XMPP server in order to chat. So the BOSH server acts as a middle man,
    translating our HTTP requests into XMPP stanzas and vice versa.

Jack Moffitt has a great `blogpost <http://metajack.im/2008/10/03/getting-attached-to-strophe>`_
about this and even provides an
`example Django application <https://github.com/metajack/strophejs/tree/master/examples/attach>`_
to demonstrate it.

When you authenticate to the XMPP server on your backend application (for
example via a BOSH client in Django), you'll receive two tokens, RID (request ID) and SID (session ID).

The **Session ID (SID)** is a unique identifier for the current *session*. This
number stays constant for the entire session.

The **Request ID (RID)** is a unique identifier for the current *request* (i.e.
page load). Each page load is a new request which requires a new unique RID.
The best way to achieve this is to simply increment the RID with each page
load.

You'll need to configure converse.js with the ``prebind``, :ref:`keepalive` and
:ref:`prebind_url` settings.

Please read the documentation on those settings for a fuller picture of what
needs to be done.

Example code for server-side prebinding
=======================================

* PHP:
    See `xmpp-prebind-php <https://github.com/candy-chat/xmpp-prebind-php>`_ by
    Michael Weibel and the folks from Candy chat.

* Python:
    See this `example Django application`_ by Jack Moffitt.

