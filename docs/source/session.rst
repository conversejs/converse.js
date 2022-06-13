.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/session.rst">Edit me on GitHub</a></div>

==================
Session Management
==================

.. _`session-support`:

Shared Sessions
===============

It's possible to enable shared sessions whereby users already
logged in to your website will also automatically be logged in on the XMPP server,

Once a user is logged in, the session will be kept alive across page loads.

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

You'll need to configure Converse with the :ref:`prebind` :ref:`prebind_url` settings.

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


Keeping users logged-in across page reloads
===========================================

If you've properly set up :ref:`shared session support <session-support>`, then
your users will stay logged-in to the XMPP server upon page reloads.

However, if users are logging in manually, then users might get logged out between requests.

Credential Management API
-------------------------

Users with modern browsers which properly support the
`Credential Management API <https://w3c.github.io/webappsec-credential-management>`_
should be automatically logged-in across page reloads and therefore maintain
their sessions.

Using a cookie
--------------

The main reason why users can get logged-out between page reloads is because we
don't (and can't) use cookies to maintain user sessions as is usually done with
websites.

This is because XMPP servers generally don't have support for logging in with a
cookie. It would be theoretically possible to login with SASL-EXTERNAL and a
cookie which the XMPP server looks up as part of the BOSH HTTP request or the
websocket connection, but no XMPP servers currently support this out of the
box.

Prosody does have a plugin called `mod_auth_http_cookie <https://modules.prosody.im/mod_auth_http_cookie.html>`_
which does the above. You'd have to `configure Converse.js to use SASL-EXTERNAL <https://opkode.com/blog/strophe_converse_sasl_external/>`_
and then set up Prosody with that plugin. (Note, I haven't yet tested this setup personally).

This is however not a cross-platform solution and won't work for hosters who
want to support all or multple XMPP servers.

Storing the password in localStorage
------------------------------------

Since cookies are usually not an option, people have suggested storing the
password in localStorage and logging in with it again when the user reloads the
page.

We've purposefully not put this functionality in Converse.js due to the
security implications of storing plaintext passwords in localStorage.


Storing the SASL SCRAM-SHA1 hash in IndexedDB
---------------------------------------------

Another suggestion that's been suggested is to store the SCRAM-SHA1 computed
``clientKey`` in localStorage and to use that upon page reload to log the user in again.

We might implement this feature in core Converse.js eventually.
As always, contributions welcome!
