.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup.rst">Edit me on GitHub</a></div>

.. _what-you-will-need:

=====================
Setup and integration
=====================

This page documents what you'll need to do to be able to connect Converse with
your own XMPP server and to better integrate it into your website.

At the very least you'll need Converse and an :ref:`XMPP server` with
:ref:`websocket-section` or :ref:`BOSH-section` enabled. That's definitely
enough to simply demo Converse or to do development work on it.

For end-to-end encryption via OMEMO, you'll need to load `libsignal-protocol.js
<https://github.com/signalapp/libsignal-protocol-javascript>`_ separately in
your page. Take a look at the section on :ref:`libsignal <dependency-libsignal>` and the
:ref:`security considerations around OMEMO <feature-omemo>`.

If you want to more fully integrate it into a website
then you'll likely need to set up more services and components.

The diagram below shows a fairly common setup for a website or intranet:

* Converse runs in the web-browser on the user's device.

* It communicates with the XMPP server via BOSH or websocket which is usually
  reverse-proxied by a web-server in order to overcome cross-site scripting
  restrictions in the browser. For more info on that, read the section:
  `Overcoming cross-domain request restrictions`_

* Optionally the XMPP server is configured to use a SQL database for storing
  archived chat messages.

* Optionally there is a user directory such as Active Directory or LDAP, which
  the XMPP server is configured to use, so that users can log in with those
  credentials.

* Usually (but optionally) there is a backend web application which hosts a
  website in which Converse appears.

.. figure:: images/diagram.png
   :align: center
   :alt: A diagram of a possible setup, consisting of Converse, a web server, a backend web application, an XMPP server, a user directory such as LDAP and an XMPP server.

   This diagram shows the various services in a fairly common setup (image generated with `draw.io <https://draw.io>`_).

----------------------
The various components
----------------------

.. _`XMPP server`:

An XMPP server
==============

Converse uses `XMPP <https://xmpp.org/about-xmpp/>`_ as its
messaging protocol, and therefore needs to connect to an XMPP/Jabber
server (Jabber® is an older and more user-friendly synonym for XMPP).

You can connect to public XMPP servers like ``conversejs.org`` but if you want to
integrate Converse into your own website and to use your website's
authentication sessions to log in users to the XMPP server (i.e. :ref:`session support <session-support>`)
then you'll have to set up your own XMPP server.

You can find a list of public XMPP servers/providers on `compliance.conversations.im <http://compliance.conversations.im/>`_
and a list of servers that you can set up yourself on `xmpp.org <https://xmpp.org/xmpp-software/servers/>`_.

.. _`BOSH-section`:

BOSH
====

Web-browsers do not allow the persistent, direct TCP socket connections used by
desktop XMPP clients to communicate with XMPP servers.

Instead, we have HTTP and websocket as available protocols.

`BOSH`_ can be seen as XMPP-over-HTTP. In other words, it allows for XMPP
stanzas to be sent over an HTTP connection.

HTTP connections are stateless and usually shortlived.
XMPP connections on the other hand are stateful and usually last much longer.

So to enable a web application like Converse to communicate with an XMPP
server, we need a proxy which acts as a bridge between these two protocols.

This is the job of a BOSH connection manager. BOSH (Bidirectional-streams Over
Synchronous HTTP) is a protocol for allowing XMPP communication over HTTP. The
protocol is defined in `XEP-0206: XMPP Over BOSH <https://xmpp.org/extensions/xep-0206.html>`_.

Popular XMPP servers such as `Ejabberd <http://www.ejabberd.im>`_,
Prosody `(mod_bosh) <http://prosody.im/doc/setting_up_bosh>`_ and
`OpenFire <http://www.igniterealtime.org/projects/openfire/>`_ all include
their own BOSH connection managers (but you usually have to enable them in the
configuration).

However, if you intend to support multiple different servers (like
https://conversejs.org does), then you'll need a standalone connection manager.

For a standalone manager, see for example `Punjab <https://github.com/twonds/punjab>`_
and `node-xmpp-bosh <https://github.com/dhruvbird/node-xmpp-bosh>`_.

The demo on the `Converse homepage <https://conversejs.org>`_ uses a connection
manager located at https://conversejs.org/http-bind.

This connection manager is available for testing purposes only, please don't
use it in production.

Refer to the :ref:`bosh-service-url` configuration setting for information on
how to configure Converse to connect to a BOSH URL.


.. _`websocket-section`:

Websocket
=========

Websockets provide an alternative means of connection to an XMPP server from
your browser.

Websockets provide long-lived, bidirectional connections which do not rely on
HTTP. Therefore BOSH, which operates over HTTP, doesn't apply to websockets.

`Prosody <http://prosody.im>`_ (from version 0.10) and `Ejabberd <http://www.ejabberd.im>`_ support websocket connections, as
does the node-xmpp-bosh connection manager.

Refer to the :ref:`websocket-url` configuration setting for information on how to
configure Converse to connect to a websocket URL.

The Webserver
=============

Lets say the domain under which you host Converse is *example.org:80*,
but the domain of your connection manager or the domain of
your HTTP file server (for `XEP-0363 HTTP File Upload <https://xmpp.org/extensions/xep-0363.html>`_)
is at a different domain, either a different port like *example.org:5280* or a
different name like *elsehwere.org*.

In such a situation the same-origin security policy of the browser comes into force.
For security purposes a browser does not by default allow a website to
make certain types of requests to other domains.

There are two ways in which you can solve this problem.

.. _CORS:

1. Cross-Origin Resource Sharing (CORS)
---------------------------------------

CORS is a technique for overcoming browser restrictions related to the
`same-origin security policy <https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy>`_.

CORS is enabled by adding an ``Access-Control-Allow-Origin`` header. Where this
is configured depends on what webserver is used for your file upload server.


2. Reverse-proxy 
----------------

Another possible solution is to add a reverse proxy to a webserver such as Nginx or Apache to ensure that
all services you use are hosted under the same domain name and port.

Examples:
*********

Assuming your site is accessible on port ``80`` for the domain ``mysite.com``
and your connection manager manager is running at ``someothersite.com/http-bind``.

The *bosh_service_url* value you want to give Converse to overcome
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

            location = / {
                root    /path/to/converse.js/;  # Properly set the path here
                index   index.html;
            }
            location ~ ^/http-bind/ {
                proxy_pass http://someothersite.com;
            }
            # CORS
            location ~ .(ttf|ttc|otf|eot|woff|woff2|font.css|css|js)$ {
                add_header Access-Control-Allow-Origin "*"; # Decide here whether you want to allow all or only a particular domain
                root   /path/to/converse.js/;  # Properly set the path here
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


.. note::

    If you're getting XML parsing errors for your BOSH endpoint, for
    example::

        XML Parsing Error: mismatched tag. Expected: </hr>.
        Location: https://example.org/http-bind/
        Line Number 6, Column 3: bosh-anon:6:3
        Also ERROR: request id 12.2 error 504 happened

    Then your BOSH proxy is returning an HTML error page (for a 504 error in
    the above example).

    This might be because your webserver and BOSH proxy have the same timeout
    for BOSH requests. Because the webserver receives the request slightly earlier, 
    it gives up a few microseconds before the XMPP server’s empty result and thus returns a
    504 error page containing HTML to browser, which then gets parsed as if its
    XML.

    To fix this, make sure that the webserver's timeout is slightly higher.
    In Nginx you can do this by adding ``proxy_read_timeout 61;``;

    From Converse 4.0.0 onwards the default ``wait`` time is set to 59 seconds, to avoid
    this problem.


.. _`session-support`:

Single Session Support
======================

It's possible to enable shared sessions whereby users already
logged in to your website will also automatically be logged in on the XMPP server,

Once a user is logged in, the session will be kept alive across page loads by
way of the :ref:`keepalive` setting.

There are a few ways to let your users be automatically authenticated to an
XMPP server once they've logged in to your site.


Option 1). Server-side authentication via BOSH prebinding
---------------------------------------------------------

To **prebind** refers to a technique whereby your web application sets up an
authenticated BOSH session with the XMPP server or a standalone `BOSH <https://xmpp.org/about-xmpp/technology-overview/bosh/>`_
connection manager.

Once authenticated, it receives RID and SID tokens which need to be passed
on to Converse. Converse will then attach to that same session using
those tokens.

It's called "prebind" because you bind to the BOSH session beforehand, and then
later in the page you just attach to that session again.

The RID and SID tokens can be passed in manually when calling
`converse.initialize`, but a more convenient way is to pass Converse a :ref:`prebind_url`
which it will call when it needs the tokens. This way it will be able to
automatically reconnect whenever the connection drops, by simply calling that
URL again to fetch new tokens.

Prebinding reduces network traffic and also speeds up the startup time for
Converse. Additionally, because prebind works with tokens, it's not necessary
for the XMPP client to know or store users' passwords.

One potential drawback of using prebind is that in order to establish the
authenticated BOSH session server-side, you'll need to access and pass on the XMPP
credentials server-side, which, unless you're using tokens, means that you'll
need to store XMPP passwords in cleartext.

This is however not the case if you for example use LDAP or Active Directory as
your authentication backend, since you could then configure your XMPP server to
use that as well.

To prebind you will require a BOSH-enabled XMPP server for Converse to connect to
(see the :ref:`bosh-service-url` under :ref:`configuration-settings`)
as well as a BOSH client in your web application (written for example in
Python, Ruby or PHP) that will set up an authenticated BOSH session, which
Converse can then attach to.

.. note::
    A BOSH server acts as a bridge between HTTP, the protocol of the web, and
    XMPP, the instant messaging protocol.

    Converse can only communicate via HTTP (or websocket, in which case BOSH can't be used).
    It cannot open TCP sockets to communicate to an XMPP server directly.

    So the BOSH server acts as a middle man, translating our HTTP requests into XMPP stanzas and vice versa.

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

You'll need to configure Converse with the ``prebind``, :ref:`keepalive` and
:ref:`prebind_url` settings.

Please read the documentation on those settings for a fuller picture of what
needs to be done.

Example code for server-side prebinding
***************************************

* PHP:
    See `xmpp-prebind-php <https://github.com/candy-chat/xmpp-prebind-php>`_ by
    Michael Weibel and the folks from Candy chat.

* Python:
    See this `example Django application`_ by Jack Moffitt.


Option 2). Delegated authentication, also called external authentication
------------------------------------------------------------------------

Delegated authentication refers to the usecase where the XMPP server delegates
authentication to some other service.

This could be to LDAP or Active Directory (as shown in the diagram at the top
of the page), or it could be to an OAuth provider, a SQL server to a specific
website.

The Prosody webserver has various user-contributed modules which delegate
authentication to external services. They are listed in the `Prosody community modules
page <https://modules.prosody.im/>`_. Other XMPP servers have similar plugin modules.

If your web-application has access to the same credentials, it can send those
credentials to Converse so that user's are automatically logged in when the
page loads.

This is can be done by setting :ref:`auto_login` to true and configuring the 
the :ref:`credentials_url` setting.

Option 3). Temporary authentication tokens
------------------------------------------

The first option has the drawback that your web-application needs to know the
XMPP credentials of your users and that they need to be stored in the clear.

The second option has that same drawback and it also needs to pass those
credentials to Converse.

To avoid these drawbacks, you can instead let your backend web application
generate temporary authentication tokens which are then sent to the XMPP server
which in turn delegates authentication to an external authentication provider
(generally the same web-app that generated the tokens).

This can be combined with prebind or with the :ref:`credentials_url` setting.

Option 4). Cryptographically signed tokens
------------------------------------------

A third potential option is to generate cryptographically signed tokens (e.g.
HMAC tokens) which the XMPP server could authenticate by checking that they're
signed with the right key and that they conform to some kind of pre-arranged
format.

In this case, you would also use the :ref:`credentials_url` setting, to specify a
URL from which Converse should fetch the username and token.
