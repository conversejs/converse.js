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
which hosts its Javascript and CSS files.

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

.. note:: Instead of always loading the latest version of Converse.js via the
    CDN, it's generally better to load a specific version (preferably the
    latest one), to avoid breakage when new backwards-incompatible versions are
    released.

Initializing Converse.js
------------------------

You'll then need to initialize Converse.js with configuration settings relevant to your requirements.
Refer to the :ref:`configuration-settings` section for info on all the available configuration settings.

To quickly get started, you can put the following Javascript code at the
bottom of your page (after the closing *</body>* element)::

    <script>
        converse.initialize({
            bosh_service_url: 'https://bind.conversejs.org', // Please use this connection manager only for testing purposes
            show_controlbox_by_default: true
        });
    </script>

The `index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file inside the
Converse.js repository may serve as a nice usable example.

Alternative builds of Converse.js
=================================

The minified ``.js`` and ``.css`` files provide the same functionality as is available
on the `conversejs.org <http://conversejs.org>`_ website. Useful for testing or demoing.

Alternative builds are however also available via the CDN.

Mobile build
------------

Besides the default build mentioned above, there is a build intended for mobile
websites, called ``converse-mobile.min.js``.
Take a look at the ``mobile.html`` file in the Converse.js repository
for an example of this build being used. There's an additional CSS file called 
``mobile.min.css`` which should be used with the mobile build.

When you load `conversejs.org <https://conversejs.org>`_ with a mobile device
then the mobile Javascript build and its CSS will be used.

Excluding 3rd party dependencies
--------------------------------

Then there is also a build that contains no 3rd party dependencies, called 
``converse-no-dependencies.min.js`` and which is used in the ``non_amd.html``
page in the repository.

Excluding only jQuery
---------------------

Lastly there is a build called ``converse.nojquery.min.js`` which excludes only
jQuery but still includes all other 3rd party dependencies.

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

