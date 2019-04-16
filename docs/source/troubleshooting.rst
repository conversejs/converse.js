.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup.rst">Edit me on GitHub</a></div>

=============================
Troubleshooting and debugging
=============================

General tips on debugging Converse
==================================

Enabling debug output
---------------------

Converse has a :ref:`debug` configuration setting which lets you to turn on
debug logging in the browser's developer console.

When debugging, you always want to make sure that this setting is set to
``true`` when calling ``converse.initialize``.

You can also enable debug output via the URL, which is useful when you don't
have access to the server where Converse is hosted.

To do so, add ``#converse?debug=true`` to the URL in the browser's address bar.
Make sure to first remove any already existing URL fragment (the URL fragment
is the part that starts with a ``#``).

With debug mode on, you can open the browser's developer console and study the
data that is logged to it.

In Chrome you can right click in the developer console and save its contents to
a file for later study.

What is logged in debug mode?
-----------------------------

`Strope.js <http://strophe.im/>`_, the underlying XMPP library which Converse
uses, swallows errors so that messaging can continue in cases where
non-critical errors occur.

This is a useful feature and provides more stability, but it makes debugging
trickier, because the app doesn't crash when something goes wrong somewhere.

That's why checking the debug output in the browser console is important.
If something goes wrong somewhere, the error will be logged there and you'll be
able to see it.

Additionally, Converse will in debug mode also log all XMPP stanzas
(the XML snippets being sent between it and the server) to the console.
This is very useful for debugging issues relating to the XMPP protocol.

For example, if a message or presence update doesn't appear, one of the first
things you can do is to set ``debug: true`` and then to check in the console
whether the relevant XMPP stanzas are actually logged (which would mean that
they were received by Converse). If they're not logged, then the problem is
more likely on the XMPP server's end (perhaps a misconfiguration?). If they
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
Converse slows down a lot and it may become intolerably slow.

One simple trick to improve performance is to set ``show_only_online_users: true``.
This will (usually) reduce the amount of contacts that get rendered in the
roster, which eases one of the remaining performance bottlenecks.

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

You might see an error like this one::

    Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://example.de:5443/...

You might also see a 404 HTTP response for an OPTIONS request in the `Network Tab` of your browser's developer tools.

An OPTIONS request is usually a so-called
`CORS pre-flight request <https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS#Preflighted_requests_in_CORS>`_
which is used by the browser to find out whether the endpoint supports
`Cross-Origin Resource Sharing (CORS) <https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS>`_.

If you get a 404 response for such a request, then the endpoint does NOT
support CORS and the browser will prevent requests from being made to it.

This will prevent you from uploading files to it.

How you solve a CORS-related issue depends on your particular setup, specifically it depends on
what you're using as the HTTP file server.

CORS is enabled by adding an ``Access-Control-Allow-Origin`` header, so you'll
have to configure your file server to add this header.

