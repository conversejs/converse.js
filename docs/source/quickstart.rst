.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

=========================================
Quickstart (to get a demo up and running)
=========================================

Converse.js has a [CDN](https://en.wikipedia.org/wiki/Content_delivery_network), provided by [KeyCDN](http://keycdn.com/), which hosts its Javascript and CSS files.

The latest versions of these files are available at these URLs:

* https://cdn.conversejs.org/dist/converse.min.js
* https://cdn.conversejs.org/css/converse.min.css

For a specific version of the files, you can put the version in the URL, as so:

* https://cdn.conversejs.org/1.0.3/dist/converse.min.js
* https://cdn.conversejs.org/1.0.3/css/converse.min.css

You can include these two URLs inside the *<head>* element of your website via the *script* and *link* tags:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="https://cdn.conversejs.org/css/converse.min.css">
    <script src="https://cdn.conversejs.org/dist/converse.min.js"></script>

You need to initialize Converse.js with configuration settings according to your requirements.

Please refer to the :ref:`configuration-variables` section for info on all the available configuration settings.

To configure and initialize Converse.js, put the following inline Javascript code at the
bottom of your page (after the closing *</body>* element).

.. code-block:: javascript

    <script>
    require(['converse'], function (converse) {
        converse.initialize({
            bosh_service_url: 'https://bind.conversejs.org', // Please use this connection manager only for testing purposes
            i18n: locales.en, // Refer to ./locale/locales.js to see which locales are supported
            show_controlbox_by_default: true,
            roster_groups: true
        });
    });
    </script>

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the
Converse.js repository may serve as a nice usable example.

These minified `.js` and `.css` files provide the same demo-like functionality as is available
on the `conversejs.org <http://conversejs.org>`_ website. Useful for testing or demoing.

You'll most likely want to implement some kind of persistent single-session solution for
your website, where users authenticate once in your website and then stay
logged in to their XMPP session upon the next page reload.

For more info on this, read: :ref:`session-support`.

You might also want to have more fine-grained control of what gets included in
the minified Javascript file. Read :doc:`builds` for more info on how to do that.
