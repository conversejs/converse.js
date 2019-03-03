.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

==========
Quickstart
==========

Getting a demo up and running
=============================

Option 1: Use the content delivery network
------------------------------------------

Converse has a `CDN <https://en.wikipedia.org/wiki/Content_delivery_network>`_, provided by `KeyCDN <http://keycdn.com/>`_,
which hosts its JavaScript and CSS files.

The latest versions of these files are available at these URLs:

* https://cdn.conversejs.org/dist/converse.min.js
* https://cdn.conversejs.org/css/converse.min.css

If you are integrating Converse into an existing website or app, then we recommend
that you load a specific version of Converse. Otherwise your website or app
might break when a new backwards-incompatible version of Converse is released.

To load a specific version of Converse you can put the version in the URL:

* https://cdn.conversejs.org/4.1.2/dist/converse.min.js
* https://cdn.conversejs.org/4.1.2/css/converse.min.css

You can include these two URLs inside the *<head>* element of your website
via the *script* and *link* tags:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="https://cdn.conversejs.org/4.1.2/css/converse.min.css">
    <script src="https://cdn.conversejs.org/4.1.2/dist/converse.min.js" charset="utf-8"></script>


Option 2: Building the files yourself
-------------------------------------

Instead of using the CDN, you can also create your own builds and host them yourself.

Have a look at the :ref:`creating_builds` section on how to create your own builds.

In short, you should be able to do it by running ``make dist`` inside a
checkout of the `Converse repo <http://github.com/conversejs/converse.js/>`_.

Besides including the ``converse.min.js`` and ``converse.min.css`` files,
you'll also need to make sure that the ``webfonts`` directory is available in
the same location as ``converse.min.css``.


Initializing Converse
---------------------

You'll need to initialize Converse with configuration settings relevant to your requirements.
Take a look at the :ref:`configuration-settings` section for info on all the available settings.

To quickly get started, you can put the following JavaScript code at the
bottom of your page (after the closing *</body>* element)::

    <script>
        converse.initialize({
            bosh_service_url: 'https://conversejs.org/http-bind/', // Please use this connection manager only for testing purposes
            show_controlbox_by_default: true
        });
    </script>

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the
Converse repository serves as a nice, usable example.

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

Have a look at the various :ref:`features <features>` that Converse provides, for some of
them you might have to do more setup work, like configuring an XMPP server or
webserver.

You might want to implement some kind of persistent single-session solution for
your website, where users authenticate once in your website and are then
automatically logged in to the XMPP server as well. For more info on how this
can be achieved, read: :ref:`session-support`.

For end-to-end encryption via OMEMO, you'll need to load `libsignal-protocol.js
<https://github.com/signalapp/libsignal-protocol-javascript>`_ separately in
your page. Take a look at the section on :ref:`libsignal <dependency-libsignal>` and the
:ref:`security considerations around OMEMO <feature-omemo>`.

Perhaps you want to create your own custom build of Converse? Then head over
to the :doc:`builds` section, or more generally the :doc:`development <development>`
documentation.

Do you want to know how to theme Converse? Then read the :doc:`theming <theming>`
documentation.

