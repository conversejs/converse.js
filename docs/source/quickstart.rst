.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

=========================================
Quickstart (to get a demo up and running)
=========================================

When you download a specific release of *Converse.js* there will be two minified files inside the zip file.

* builds/converse.min.js
* css/converse.min.css

You can include these two files inside the *<head>* element of your website via the *script* and *link*
tags:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="css/converse.min.css">
    <script src="builds/converse.min.js"></script>

You need to initialize Converse.js with configuration settings according to
your requirements.

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
