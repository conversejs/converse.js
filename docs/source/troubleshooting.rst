.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup.rst">Edit me on GitHub</a></div>

=============================
Troubleshooting and debugging
=============================

.. contents:: Table of Contents
   :depth: 2
   :local:

General tips on debugging Converse.js
=====================================

When debugging converse.js, always make sure that you pass in ``debug: true`` to
the ``converse.initialize`` call.

Converse.js will then log debug information to the browser's developer console.
Open the developer console and study the data that is logged to it.

`Strope.js <http://strophe.im/>`_ the underlying XMPP library which Converse.js
uses, swallows errors, so that messaging can continue in cases where
non-critical errors occur.

This is a useful feature and provides more stability, but it makes debugging
trickier, because the app doesn't crash when something goes wrong somewhere.

That's why checking the debug output in the browser console is so important. If
something goes wrong somewhere, the error will be logged there and you'll be
able to see it.

Additionally, Converse.js will in debug mode also log all XMPP stanzas
(the XML snippets being sent between it and the server) to the console.
This is very useful for debugging issues relating to the XMPP protocol.

For example, if a message or presence update doesn't appear, one of the first
things you can do is to set ``debug: true`` and then to check in the console
whether the relevant XMPP stanzas are actually logged (which would mean that
they were received by Converse.js). If they're not logged, then the problem is
more likely on the XMPP server's end (perhaps a misconfiguration?). If they
**are** logged, then there might be a bug or misconfiguration in Converse.js.


Conflicts with other Javascript libraries
=========================================

Problem: 
---------

You are using other Javascript libraries (like JQuery plugins), and
get errors like these in your browser console::

    Uncaught TypeError: Object [object Object] has no method 'xxx' from example.js

Solution:
---------

First, find out which object is referred to by ``Object [object Object]``.

It will probably be the jQuery object ``$`` or perhaps the underscore.js object ``_``.

For the purpose of demonstration, I'm going to assume its ``$``, but the same
rules apply if its something else.

The bundled and minified default build of converse.js, ``converse.min.js``
includes within it all of converse.js's dependencies, which include for example *jQuery*.

If you are having conflicts where attributes or methods aren't available 
on the jQuery object, you are probably loading ``converse.min.js`` (which
includes jQuery) as well as your own jQuery version separately.

What then happens is that there are two ``$`` objects (one from
converse.js and one from the jQuery version you included manually)
and only one of them has been extended to have the methods or attributes you require.

Which jQuery object you get depends on the order in which you load the libraries.

There are multiple ways to solve this issue.

Firstly, make sure whether you really need to include a separate version of
jQuery. Chances are that you don't. If you can remove the separate
version, your problem should be solved, as long as your libraries are loaded in
the right order.

Either case, whether you need to keep two versions or not, the solution depends
on whether you'll use require.js to manage your libraries or whether you'll
load them manually.

With require.js
~~~~~~~~~~~~~~~

Instead of using ``converse.min.js``, manage all the libraries in your project
(i.e. converse.js and its dependencies plus all other libraries you use) as one
require.js project, making sure everything is loaded in the correct order.

Then, before deployment, you make your own custom minified build that bundles everything
you need.

With <script> tags
~~~~~~~~~~~~~~~~~~

Take a look at `non_amd.html <https://github.com/jcbrand/converse.js/blob/master/non_amd.html>`_
in the converse.js repo.

It shows in which order the libraries must be loaded via ``<script>`` tags. Add
your own libraries, making sure that they are loaded in the correct order (e.g.
jQuery plugins must load after jQuery).


Performance issues with large rosters
=====================================

Effort has been made to benchmark and optimize converse.js to work with large
rosters.

See for example the benchmarking tests in `spec/profiling.js
<https://github.com/jcbrand/converse.js/blob/master/spec/profiling.js>`_ which
can be used together with the `profiling features of
Chrome <https://developer.chrome.com/devtools/docs/cpu-profiling>`_ to find
bottlenecks in the code.

However, with large rosters (more than 1000 contacts), rendering in
converse.js slows down a lot and it may become intolerably slow.

One simple trick to improve performance is to set ``show_only_online_users: true``.
This will (usually) reduce the amount of contacts that get rendered in the
roster, which eases one of the remaining performance bottlenecks.

