.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/troubleshooting.rst">Edit me on GitHub</a></div>

=============================
Troubleshooting and debugging
=============================

General tips on debugging Converse
==================================

Enabling debug output
---------------------

Converse has a :ref:`loglevel` configuration setting which lets you turn on
debug logging in the browser's developer console. With the ``loglevel`` set
to ``debug``, Converse will log all XML traffic between itself and the XMPP server.

When debugging, you'll want to ensure this is set to ``debug`` when 
calling ``converse.initialize``.

Alternatively, you can enable debug output via the URL. This is useful when you don't
have access to the server where Converse is hosted. For this, 
add ``#converse?loglevel=debug`` to the URL in the browser's address bar, ensuring
any already existing URL fragment is removed first (the URL fragment
is the part that starts with a ``#``).

With debug logging on, the browser's developer console (often opened by pressing F12)
can be studied to see all Converse debug output logged to it. Ensure verbose logging
is enabled in the browser's developer console, otherwise not all logs from
Converse might be visible.

In Chrome and other browsers, contents of the developer console can be saved to
a file for later study by right clicking within the developer console.

What is logged at the debug loglevel?
-------------------------------------

`Strope.js <http://strophe.im/>`_, the underlying XMPP library which Converse
uses, quietly swallows non-critical errors so that messaging activities can generally continue 
in cases where non-critical errors have occurred. This is a useful feature and provides 
a better user experience and more stability in the client, but debugging is more challenging 
because the app doesn't obviously crash when something goes wrong somewhere.

That's why checking the debug output in the browser console is important.
If something goes wrong somewhere, the error will be logged there and you'll be
able to see it.

Additionally, in debug mode Converse also logs all XMPP stanzas
(the XML snippets being sent between it and the server) to the console.
This is very useful for debugging issues relating to the XMPP protocol.

For example, if a message or presence update doesn't appear, one of the first
things you can do is to set ``loglevel: debug`` and then confirm in the console
whether or not the relevant XMPP stanzas have actually been logged (meaning
they were at least received by Converse). If they're not present in the log, 
the problem is more likely on the XMPP server's end (perhaps a misconfiguration?). If they
**are** logged, then there might be a bug or misconfiguration in Converse.

Performance issues with large rosters
=====================================

Effort has been made to benchmark and optimize Converse to work with large
rosters.

See for example the benchmarking tests in `spec/profiling.js
<https://github.com/jcbrand/converse.js/blob/master/spec/profiling.js>`_ which
can be used together with the `profiling features of
Chrome <https://developer.chrome.com/devtools/docs/cpu-profiling>`_ to find
bottlenecks in the code.

However, with large rosters (more than 1000 contacts), rendering in
Converse is known to slow down considerably. It may become intolerably slow
in these cases.

One simple trick to improve performance is to set ``show_only_online_users: true``.
This usually reduces the number of contacts shown in the
roster, which eases this known performance bottlenecks.

File upload is not working
==========================

One of the most common causes for file upload not working is a lack of CORS
support by the file server to which the file should be uploaded.

CORS stands for `Cross-Origin Resource Sharing (CORS) <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>`_
and is a technique for overcoming browser restrictions related to the
`same-origin security policy <https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy>`_.

For example, if the domain under which you host Converse is *example.org*,
but the domain of your of your HTTP file server (for `XEP-0363 HTTP File Upload <https://xmpp.org/extensions/xep-0363.html>`_)
is *upload.example.org*, then the HTTP file server needs to enable CORS.

If you're not sure what the domain of the HTTP file server is, take a look at
the console of your browser's developer tools.

You might see an error like::

    Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://example.de:5443/...

You might also see a 404 HTTP response for an OPTIONS request in the `Network Tab` of your browser's developer tools.

An OPTIONS request is usually a so-called
`CORS pre-flight request <https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS#Preflighted_requests_in_CORS>`_
which is used by the browser to find out whether the endpoint supports
`Cross-Origin Resource Sharing (CORS) <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>`_.

If you get a 404 response for such a request, then the endpoint does NOT
support CORS and the browser will prevent requests from being made to it.

This will prevent you from uploading files to it.

Solving a CORS-related issue depends on your particular setup, most especially
what you're using as the HTTP file server. CORS is enabled by adding 
an ``Access-Control-Allow-Origin`` header, so you will
need to adjust your HTTP file server configuration to add this header.

Users don't stay logged in across page reloads
==============================================

A common complaint in the Converse chat room (`<xmpp:discuss@conference.conversejs.org?join>`_)
is that users are logged out when they reload the page.

The main way in which websites and web apps maintain a user's login session is via
authentication cookies, which are included in every HTTP request sent to the server.

But XMPP is not HTTP. Cookies aren't automatically included in traffic to
the XMPP server, and XMPP servers don't rely on cookies for authentication.

Instead, an XMPP client is expected to store the user credentials (username and
password, either plaintext or hashed and salted if
`SCRAM <https://en.wikipedia.org/wiki/Salted_Challenge_Response_Authentication_Mechanism>`_
is being used) and to then present those credentials to the XMPP server when authenticating.

This works well for non-web XMPP clients, but Converse has so far avoided
storing user credentials in browser storage, since they can then be accessed by
any scripts running in the browser under the same domain.

So what does Converse do to keep users logged in?
-------------------------------------------------

Use the Web Auth API
********************

Converse supports the `Web Authentication API <https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API>`_
which leverages the secure credential management of the web browser to get the
user credentials that are used to automatically log the user in. However, this requires
the user to save his or her username and password in the browser. Often the user
is automatically asked by the browser whether he/she wants to store the
credentials. If that doesn't happen, the user has to do so manually, usually by
clicking the key icon in the address bar. This works well on most modern browsers,
but not on Firefox, which has insufficient support for the Web Authentication API.

What can users do to stay logged in?
------------------------------------

Outsource credential management to something else
*************************************************

The issues mentioned above are mostly associated with integrations where users log in
manually. They do not pertain to integrations where Converse automatically fetches user 
credentials from the backend via the :ref:`credentials_url` setting.

Use BOSH instead of Websocket
*****************************

`BOSH <https://xmpp.org/extensions/xep-0206.html>`_ can be thought of
as XMPP-over-HTTP, and because HTTP is stateless BOSH needs to maintain login
sessions for a certain amount of time (usually 60 seconds) even if there is no
HTTP traffic between the client and server. This means that if you have a BOSH
session running, you can reload the page and you will stay logged in.

The tradeoff, however, is that BOSH connections are slower and have more overhead than 
Websocket connections.

User a browser with adequate support for the Web Auth API
*********************************************************

Another option is to only use a browser with well-developed support for the Web Auth
API (which mainly means avoiding Firefox) and then to save your credentials in the browser.

Use Converse Desktop
********************

The `desktop version of Converse <https://github.com/conversejs/converse-desktop>`_
does not experience this problem, since login credentials are stored in Electron
and there is no significant risk of other malicious scripts running.

What else can Converse do to keep users logged in?
--------------------------------------------------

This problem can also potentially be fixed by storing the
XMPP credentials securely with web crypto and IndexedDB. This could be done by
generating a private encryption key in non-exportable format, and then using that
to encrypt the credentials before storing them in IndexedDB.

This would protect the credentials from someone who has access to your
computer (or physical storage within your computer), but it still won't serve as
protection against malicious scripts running in the same domain as Converse is being hosted,
since they would have the same level of access as Converse itself (which legitimately needs
access to the credentials).

Common errors
=============

Error: A "url" property or function must be specified
-----------------------------------------------------

This is a relatively generic `Skeletor <https://github.com/conversejs/skeletor>`_ (or `Backbone <http://backbonejs.org/>_`)
error, and by itself it usually doesn't give enough information to know how to fix the underlying issue.

Generally, this error happens when a Model is being persisted, such as when model.save() is called
but no information has been specified as to where/how it should be persisted.

The Converse models are persisted to browser storage (e.g. sessionStorage, localStorage or IndexedDB),
and this happens by adding a browserStorage attribute on the model, or on the collection containing the model.

See for example here: https://github.com/conversejs/converse.js/blob/395aa8cb959bbb7e26472ed3356160c8044be081/src/headless/converse-chat.js#L359

If this error occurs, it means that a model being persisted doesn't have the ``browserStorage`` attribute,
and its containing collection (if there is one) also doesn't have that attribute.

This usually happens when a model has been removed from a collection, and then ``.save()`` is called on it.

In the context of Converse, it might indicate that an attempt has been made to persist data either 
before all models were properly initialized, or after models were removed from their containing collections.
