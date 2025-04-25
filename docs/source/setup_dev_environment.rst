.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/setup_dev_environment.rst">Edit me on GitHub</a></div>

.. _`setup_dev_environment`:

============================
Setting up a dev environment
============================

.. _`webserver`:

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

To set up a Converse development environment, you now run the following:

::

    npm install
    npm run serve &
    npm run watch


Alternatively, if you have GNU Make installed, you can run:

::

    make serve_bg
    make watch


Then go to http://localhost:8000/dev.html to load Converse.

Modify `dev.html <https://github.com/conversejs/converse.js/blob/master/dev.html>`_
so that `converse.initialize()` is called with the relevant settings.

Webpack will "watch" the source files and automatically recreate the build if they
are modified. So you don't have to do anything to rebuild whenever you've
change something in a file but you will have to manually reload the browser tab
to see the changes in the browser.

Live reloading
--------------

If you want to have live reloading whenever any of the source files change, you
can run ``make devserver`` (or ``npm run devserver``) which uses `webpack-dev-server <https://github.com/webpack/webpack-dev-server>`_.

Then go to http://localhost:8080.

Instead of ``dev.html``, `webpack.html <https://github.com/conversejs/converse.js/blob/master/webpack.html>`_
is now being used as the served HTML file, and you'll need to modify that file to
change the settings passed to ``converse.initialize``.

Troubleshooting
---------------

After running ``make watch``, you should now have a new *node_modules* directory
which contains all the external dependencies of Converse.

If this directory does NOT exist, something must have gone wrong.

Double-check the output of ``make watch`` to see if there are any errors
listed.

For support, you can ask in our chatroom: `dicuss@conference.conversejs.org <xmpp:discuss@conference.conversejs.org>`_.

If you don't have an XMPP client installed, follow this link to
`conversejs.org <https://conversejs.org/fullscreen#converse/room?jid=discuss@conference.conversejs.org>`_
where you can log in and be taken directly to the chatroom.


.. _`dependency-libsignal`:

libsignal
---------

If you want OMEMO encryption, you need to load `libsignal <https://github.com/signalapp/libsignal-protocol-javascript>`_ separately in your page.

For example::

    <script src="3rdparty/libsignal-protocol-javascript/dist/libsignal-protocol.js"></script>

The reason libsignal needs to be loaded separately is because it's released
under the `GPLv3 <https://github.com/signalapp/libsignal-protocol-javascript/blob/master/LICENSE>`_
which requires all other dependent JavaScript code to also be open sourced under the same
license. You might not be willing to adhere to those terms, which is why you
need to decide for yourself whether you're going to load libsignal or not.
