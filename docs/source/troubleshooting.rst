.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup.rst">Edit me on GitHub</a></div>

=============================
Troubleshooting and debugging
=============================

General tips on debugging Converse
==================================

When debugging Converse, always make sure that you pass in ``debug: true`` to
the ``converse.initialize`` call.

Converse will then log debug information to the browser's developer console.
Open the developer console and study the data that is logged to it.

`Strope.js <http://strophe.im/>`_ the underlying XMPP library which Converse
uses, swallows errors, so that messaging can continue in cases where
non-critical errors occur.

This is a useful feature and provides more stability, but it makes debugging
trickier, because the app doesn't crash when something goes wrong somewhere.

That's why checking the debug output in the browser console is so important. If
something goes wrong somewhere, the error will be logged there and you'll be
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

