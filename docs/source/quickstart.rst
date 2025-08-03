.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/quickstart.rst">Edit me on GitHub</a></div>

==========
Quickstart
==========

You can use the latest version of Converse at `conversejs.org <https://conversejs.org/fullscreen.html>`_.

There are several ways to run Converse yourself or to add it to your website or web app:

Option 1: Host it via your XMPP Server
======================================

If you run your own XMPP server, check if it has a plugin for hosting Converse.

For example, the following XMPP servers have plugins available:

* **Openfire**: `inverse plugin <https://www.igniterealtime.org/projects/openfire/plugin-archive.jsp?plugin=inverse>`_
* **Prosody**: `mod_conversejs <https://modules.prosody.im/mod_conversejs.html>`_
* **ejabberd**: `mod_conversejs <https://docs.ejabberd.im/admin/configuration/modules/#mod-conversejs>`_

.. warning::
    When configuring one of these plugins in production, it's good practice to use a specific version of the Converse resources to avoid breaking changes.

For instance, this will configure ejabberd's, mod-conversejs to fetch a specific version instead of whichever is the latest one.

.. code-block:: yml
    
    mod_conversejs:
      # Replace 11.0.1 with your desired version
      conversejs_css: https://cdn.conversejs.org/11.0.1/dist/converse.min.css
      conversejs_script: https://cdn.conversejs.org/11.0.1/dist/converse.min.js


Option 2: Self-hosting
======================

Getting the necessary files
---------------------------

You can host Converse on your own server without requiring any XMPP server.
There are three ways to get the necessary files:

A. Using the CDN (Recommended)
******************************

Converse provides a CDN (via `KeyCDN <https://www.keycdn.com/>`_) for easy integration.

To use it, add these lines to your HTML page's ``<head>`` section:

.. code-block:: html

    <!-- Replace 11.0.1 with your desired version -->
    <link rel="stylesheet" href="https://cdn.conversejs.org/11.0.1/dist/converse.min.css">
    <script src="https://cdn.conversejs.org/11.0.1/dist/converse.min.js" charset="utf-8"></script>

.. warning::
    Always specify a version number in production to avoid breaking changes.


B. Download Pre-built Files
***************************

1. Download the latest release from the `Converse GitHub releases page <https://github.com/conversejs/converse.js/releases>`_
2. Extract the archive file
3. Include the minified files in your HTML:

.. code-block:: html

    <link rel="stylesheet" href="path/to/converse.min.css">
    <script src="path/to/converse.min.js" charset="utf-8"></script>

.. important::
    * All the files from the ``dist`` directory need to be available and hosted on your server
    * Converse will dynamically load additional files from this directory
    * To use a different path, change the :ref:`assets_path` setting


C. Build from Source
********************

For custom builds and development, run the following commands:

1. ``git clone git@github.com:conversejs/converse.js.git`` to clone the repo.
2. ``cd converse.js && npm install`` to install dependencies
3. ``npm run build`` to build distribution files to the ``./dist`` folder
4. ``npm run serve`` to start a local server at port ``8080``.
5. You can now access Converse at http://localhost:8080/dev.html in your browser.

See the :ref:`creating_builds` section for detailed build instructions and customization options.

.. tip::
    You can run ``npm run watch`` to automatically rebuild the dist files whenever a source file changes.


Initializing Converse
---------------------

After building and including the necessary files, you need to initialize Converse:

.. code-block:: html

    <script>
        converse.initialize();
    </script>

See the :ref:`configuration-settings` section for all available initialization options and the
`index.html <https://github.com/jcbrand/converse.js/blob/master/index.html>`_ file in the repository for a complete example.

Display Modes
*************

Converse supports different display modes:

* **Full page mode** (default): Chat takes up the entire page
* **Overlay mode**: Chat appears in a corner of your page
* **Embedded mode**: Chat appears embedded inside a container element in your page

To use fullscreen mode, simply set the ``view_mode`` parameter:

.. code-block:: javascript

    converse.initialize({
        view_mode: 'fullscreen' // other options are `overlay` and `embedded`
    });

Further reading
===============

Now that you have Converse running, you might want to:

* Explore available :ref:`features <features>` (some require additional setup)
* Implement :ref:`session-support` for single sign-on between your site and XMPP
* Enable :ref:`OMEMO encryption <feature-omemo>` (requires loading `libsignal-protocol.js <https://github.com/signalapp/libsignal-protocol-javascript>`_)
* Create :doc:`custom builds <builds>` with specific features
* Customize the appearance with :doc:`theming <theming>`
* Dive into :doc:`development <development>` to contribute or extend Converse
