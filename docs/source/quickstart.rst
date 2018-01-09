.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

==========
Quickstart
==========

Getting a demo up and running
=============================

Use the content delivery network
--------------------------------

Converse.js has a `CDN <https://en.wikipedia.org/wiki/Content_delivery_network>`_, provided by `KeyCDN <http://keycdn.com/>`_,
which hosts its JavaScript and CSS files.

The latest versions of these files are available at these URLs:

* https://cdn.conversejs.org/dist/converse.min.js
* https://cdn.conversejs.org/css/converse.min.css

To load a specific version of Converse.js you can put the version in the URL, like so:

* https://cdn.conversejs.org/3.0.3/dist/converse.min.js
* https://cdn.conversejs.org/3.0.3/css/converse.min.css

You can include these two URLs inside the *<head>* element of your website
via the *script* and *link* tags:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="https://cdn.conversejs.org/css/converse.min.css">
    <script src="https://cdn.conversejs.org/dist/converse.min.js"></script>


.. note:: For the fullscreen version of converse.js, replace
    ``converse.min.js`` with ``inverse.min.js`` and ``converse.min.css`` with
    ``inverse.min.css``.

.. note:: Instead of always loading the latest version of Converse.js via the
    CDN, it's generally better to load a specific version (preferably the
    latest one), to avoid breakage when new backwards-incompatible versions are
    released.

Initializing Converse.js
------------------------

You'll then need to initialize Converse.js with configuration settings relevant to your requirements.
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
Converse.js repository may serve as a nice usable example.

Alternative builds of Converse.js
=================================

The minified ``.js`` and ``.css`` files provide the same functionality as is available
on the `conversejs.org <https://conversejs.org>`_ website. Useful for testing or demoing.

Converse.js is composed out of plugins, and you are able to exclude certain
plugins (and to include your own new plugins) when creating a build. This
enables you to create your own custom builds of Converse.js that differ from
the standard one.

Besides the standard build, the Converse.js repository includes configuration
for certain other non-standard builds, which we'll now mention below.

Mobile version
--------------

Besides the default build mentioned above, there is a build intended for mobile
websites, called ``converse-mobile.min.js``.
Take a look at the ``mobile.html`` file in the Converse.js repository
for an example of this build being used. There's an additional CSS file called 
``mobile.min.css`` which should be used with the mobile build.

When you load `conversejs.org <https://conversejs.org>`_ with a mobile device
then the mobile JavaScript build and its CSS will be used.

Excluding all 3rd party dependencies
------------------------------------

Then there is also a build that contains no 3rd party dependencies, called 
``converse-no-dependencies.min.js`` and which is used in the ``non_amd.html``
page in the repository.

Headless build
--------------

There is also the option of making a headless build of converse.js.
This means a build without any UI but still containing core functionality of
maintaining a roster, chat boxes and messages.

The file `src/headless.js <https://github.com/jcbrand/converse.js/blob/master/src/headless.js>`_
is used to determine which plugins are included in the build.

Unfortunately it's currently not yet possible to include Multi-user chat (MUC)
functionality in the headless build. This is because both the UI and core
functionality is still contained in one plugin and would first need to be
split up into two parts, with the UI part dropped for this build.

Fullscreen version
------------------

Converse.js also comes in a fullscreen version (often referred to as Inverse).
A hosted version is available online at `inverse.chat <https://inverse.chat>`_.

Originally this version was available as a separate build file, but 
as of version 4.0.0 and higher, the difference between the "overlay" and the
"fullscreen" versions of converse.js is simply a matter of configuring the 
:ref:`view_mode` and including the right CSS file.

For the default "overlay" version, ``converse.css`` is used, and for the
"fullscreen" version ``inverse.css`` is used.

We'd like to eventually not require two different CSS files, and to allow you
to seamlessly switch between the different view modes.

To generate the headless build, run ``make dist/converse-headless.js`` and/or 
``make dist/converse-headless.min.js``.


Where to go from here?
======================

You might want to implement some kind of persistent single-session solution for
your website, where users authenticate once in your website and are then
automatically logged in to the XMPP server as well. For more info on how this
can be achieved, read: :ref:`session-support`.

Perhaps you want to create your own custom build of Converse.js? Then head over
to the :doc:`builds` section, or more generally the :doc:`development`
documentation.

Do you want to know how to theme Converse.js? Then read the :doc:`theming`
documentation.

