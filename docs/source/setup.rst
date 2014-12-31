=====================
Setup and integration
=====================

.. contents:: Table of Contents
   :depth: 2
   :local:

.. _what-you-will-need:

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


-------------------------
A BOSH Connection Manager
-------------------------

Your website and *Converse.js* use `HTTP <https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol>`_
as protocol to communicate with the webserver. HTTP connections are stateless and usually shortlived.

`XMPP <https://en.wikipedia.org/wiki/Xmpp>`_ on the other hand, is the protocol that enables instant messaging, and
its connections are stateful and usually longer.

To enable a web application like *Converse.js* to communicate with an XMPP
server, we need a proxy in the middle that can act as a bridge between the two
protocols.

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the

This is the job of a connection manager. A connection manager can be either a
standalone application or part of an XMPP server. Popular XMPP servers such as
`ejabberd <http://www.ejabberd.im>`_, `prosody <http://prosody.im/doc/setting_up_bosh>`_ and
`openfire <http://www.igniterealtime.org/projects/openfire/>`_ all include their own connection managers
(but you usually have to enable them in the configuration).

Standalone connection managers also exist, see for example `Punjab <https://github.com/twonds/punjab>`_.

The demo on the `Converse.js homepage <http://conversejs.org>`_ uses a connection manager located at https://bind.conversejs.org.
This connection manager is available for testing purposes only, please don't use it in production.

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
-----

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
------

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

Server-side authentication
==========================

It's possible to enable single-site login, whereby users already
authenticated in your website will also automatically be logged in on the chat server,

This session should also persist across page loads. In other words, we don't
want the user to have to give their chat credentials every time they reload the
page.

To do this you will require a `BOSH server <http://xmpp.org/about-xmpp/technology-overview/bosh/>`_
for converse.js to connect to (see the :ref:`bosh-service-url` under :ref:`configuration-variables`)
as well as a BOSH client on your own server (written for example in Python, Ruby or PHP) that will
do the pre-authentication before the web page loads.

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

When you initialize converse.js in your browser, you need to pass it these two
tokens. Converse.js will then use them to attach to the session you just
created.

You can embed the RID and SID tokens in your HTML markup or you can do an
XMLHttpRequest call to your server and ask it to return them for you.

Below is one example of how this could work. An Ajax call is made to the
relative URL **/prebind** and it expects to receive JSON data back.

.. code-block:: javascript

    $.getJSON('/prebind', function (data) {
        converse.initialize({
            prebind: true,
            bosh_service_url: data.bosh_service_url,
            jid: data.jid,
            sid: data.sid,
            rid: data.rid
        });
    );

**Here's what's happening:**

The JSON data returned from the Ajax call to example.com/prebind contains the user's JID (jabber ID), RID, SID and the URL to the
BOSH server (also called a *connection manager*).

These values are then passed to converse.js's ``initialize`` method.

.. note::
   If you want to enable single session support, you need to set **prebind: true**
   when calling **converse.initialize** (see ./index.html).
   Additionally you need to pass in valid **jid**, **sid**, **rid** and
   **bosh_service_url** values.


Example code for server-side prebinding
=======================================

* PHP:
    See `xmpp-prebind-php <https://github.com/candy-chat/xmpp-prebind-php>`_ by
    Michael Weibel and the folks from Candy chat.

* Python:
    See this `example Django application`_ by Jack Moffitt.
