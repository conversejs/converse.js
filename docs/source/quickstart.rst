.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

==========
Quickstart
==========

Getting a demo up and running
=============================

Use the content delivery network
--------------------------------

Converse has a `CDN <https://en.wikipedia.org/wiki/Content_delivery_network>`_, provided by `KeyCDN <http://keycdn.com/>`_,
which hosts its JavaScript and CSS files.

The latest versions of these files are available at these URLs:

* https://cdn.conversejs.org/dist/converse.min.js
* https://cdn.conversejs.org/css/converse.min.css

It's however recommended that you load a specific version of Converse, to avoid
breakage when a new version is released and the above URLs load new resources.

To load a specific version of Converse you can put the version in the URL, like so:

* https://cdn.conversejs.org/4.0.1/dist/converse.min.js
* https://cdn.conversejs.org/4.0.1/css/converse.min.css

You can include these two URLs inside the *<head>* element of your website
via the *script* and *link* tags:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="https://cdn.conversejs.org/css/converse.min.css">
    <script src="https://cdn.conversejs.org/dist/converse.min.js" charset="utf-8"></script>


.. note:: Instead of always loading the latest version of Converse via the
    CDN, it's generally better to load a specific version (preferably the
    latest one), to avoid breakage when new backwards-incompatible versions are
    released.

Initializing Converse
---------------------

You'll then need to initialize Converse with configuration settings relevant to your requirements.
Refer to the :ref:`configuration-settings` section for info on all the available configuration settings.

To quickly get started, you can put the following JavaScript code at the
bottom of your page (after the closing *</body>* element)::

    <script>
        converse.initialize({
            bosh_service_url: 'https://conversejs.org/http-bind/', // Please use this connection manager only for testing purposes
            show_controlbox_by_default: true
        });
    </script>

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the
Converse repository may serve as a nice usable example.

Fullscreen version
------------------

Converse also comes in a fullscreen version.
A hosted version is available online at `conversejs.org/fullscreen <https://conversejs.org/fullscreen.html>`_.

Originally this version was available as a separate build file, but 
as of version 4.0.0 and higher, the difference between the "overlay" and the
"fullscreen" versions of converse.js is simply a matter of configuring the 
:ref:`view_mode`.

For example::

    <script>
        converse.initialize({
            bosh_service_url: 'https://conversejs.org/http-bind/', // Please use this connection manager only for testing purposes
            view_mode: 'fullscreen'
        });
    </script>

Where to go from here?
======================

You might want to implement some kind of persistent single-session solution for
your website, where users authenticate once in your website and are then
automatically logged in to the XMPP server as well. For more info on how this
can be achieved, read: :ref:`session-support`.

Perhaps you want to create your own custom build of Converse? Then head over
to the :doc:`builds` section, or more generally the :doc:`development`
documentation.

Do you want to know how to theme Converse? Then read the :doc:`theming`
documentation.

