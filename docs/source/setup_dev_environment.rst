.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup_dev_environment.rst">Edit me on GitHub</a></div>

.. _`setup_dev_environment`:

============================
Setting up a dev environment
============================

Installing the 3rd party dependencies
=====================================

To develop and customize Converse, you'll first need to check out Converse's Git
repository:

::

    git clone https://github.com/conversejs/converse.js.git
    cd converse.js


We use development tools which depend on Node.js and NPM (the Node package manager).

It's recommended that you use `NVM <https://github.com/nvm-sh/nvm>`_ (the Node version manager)
to make sure you have the right version of Node.

Refer to the `NVM Github page <https://github.com/nvm-sh/nvm#install--update-script>`_ for instructions on how to install it.

Once NVM is installed, you can run the following inside your checkout of the Converse Git repository:

::

    nvm install

.. note::
    You will always have to first run ``nvm install`` in a new terminal session in order to use the
    recommended version of Node before working on Converse.


To set up the Converse development environment, you now run ``make dev``.

::

    make dev

Alternatively, if you're using Windows, or don't have GNU Make installed, you can run the
following:

::

  npm install
  npm run lerna

This will install the Node development tools and Converse's dependencies.

The front-end dependencies are those JavaScript files on which
Converse directly depends and which will be loaded in the browser as part of
the bundle in ``dist/converse.js`` (or ``dist/converse.min.js``).

To see the 3rd party dependencies (not just the front-end dependencies, but
also ones necessary for development tasks like making builds), take a look at
the list under the ``devDependencies`` in `package.json <https://github.com/jcbrand/converse.js/blob/master/package.json>`_.

.. note::
    After running ```make dev```, you should now have a new *node_modules* directory
    which contains all the external dependencies of Converse.
    If this directory does NOT exist, something must have gone wrong.
    Double-check the output of ```make dev``` to see if there are any errors
    listed. For support, you can ask in our chatroom: `dicuss@conference.conversejs.org <xmpp:discuss@conference.conversejs.org>`_.

    If you don't have an XMPP client installed, follow this link to
    `conversejs.org <https://conversejs.org/fullscreen#converse/room?jid=discuss@conference.conversejs.org>`_
    where you can log in and be taken directly to the chatroom.


.. _`dependency-libsignal`:

Libsignal
---------

If you want OMEMO encryption, you need to load `libsignal <https://github.com/signalapp/libsignal-protocol-javascript>`_ separately in your page.

For example::

    <script src="3rdparty/libsignal-protocol-javascript/dist/libsignal-protocol.js"></script>

The reason libsignal needs to be loaded separately is because it's released
under the `GPLv3 <https://github.com/signalapp/libsignal-protocol-javascript/blob/master/LICENSE>`_
which requires all other dependent JavaScript code to also be open sourced under the same
license. You might not be willing to adhere to those terms, which is why you
need to decide for yourself whether you're going to load libsignal or not.


.. _`webserver`:

Setting up a webserver
======================

When making changes to Converse, either development or theming changes,
you'll want to preview them in your browser.

For this, you'll need to serve the development files via a web server,
so that you can see your local changes in the browser.

Manually starting a web server
------------------------------

To both set up the development environment and also start up a web browser to
serve the files for you, you can run::

    make serve

.. note::
    To run the "make" commands, you'll need `GNUMake <https://www.gnu.org/software/make>`_
    installed on your computer. If you use GNU/Linux or \*BSD, it should be installed or
    available via your package manager. For Mac, you'll need to install XCode and in
    Windows you can use `Chocolatey <https://chocolatey.org/>`_.

After running ``make serve`` you can open http://localhost:8000 in your webbrowser to see the Converse website.

When developing or changing the theme, you'll want to load all the
unminified JS and CSS resources as separate files. To do this, open http://localhost:8000/dev.html instead.

You might want to open `dev.html <https://github.com/conversejs/converse.js/blob/master/dev.html>`_ in your text editor or IDE as well, to see
how ``converse.initialize`` is called and to potentially change any of the
settings.

Starting a web server with live reloading
-----------------------------------------

Alternatively, if you want to have live reloading whenever any of the source files change, you
can run ``make devserver`` (which will use `webpack-dev-server <https://github.com/webpack/webpack-dev-server>`_).

Instead of ``dev.html`` being used, `webpack.html <https://github.com/conversejs/converse.js/blob/master/webpack.html>`_
is now being used as the HTML template, and you'll need to modify that file if
you want to change the settings passed to ``converse.initialize``.

If you're running ``make devserver``, you need to open http://localhost:8080.

