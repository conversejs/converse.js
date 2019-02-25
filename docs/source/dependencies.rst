.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

============
Dependencies
============

Installing the 3rd party dependencies
=====================================

.. note::
    Windows environment: We recommend installing the required tools using `Chocolatey <https://chocolatey.org/>`_
    You will need Node.js (nodejs.install), Git (git.install) and optionally to build using Makefile, GNU Make (make)
    If you have trouble setting up a development environment on Windows,
    please read `this post <http://librelist.com/browser//conversejs/2014/11/5/openfire-converse-and-visual-studio-questions/#b28387e7f8f126693b11598a8acbe810>`_
    in the mailing list.:


We use development tools which depend on Node.js and npm (the Node package manager).

If you don't have Node.js installed, you can download and install the latest
version `here <https://nodejs.org/download>`_.

Alternatively you can `use your operating system's package manager to install
Node.js <https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions>`_.

Also make sure you have ``Git`` installed. `See here <http://git-scm.com/book/en/Getting-Started-Installing-Git>`_.

Now use ``git`` to check out the Converse repository:

::

    git clone git@github.com:conversejs/converse.js.git

Now go into the repository checkout and run ``make dev`` in order to set up the
development environment.

::
    
    cd converse.js
    make dev

On Windows you need to specify Makefile.win to be used by running:

::

    make -f Makefile.win dev

Alternatively, if you don't have GNU Make (necessary for the ``make`` command),
you can use NPM directly:

::

    npm install


This will install the Node.js development tools and Converse's dependencies.

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


Brief description of Converse's dependencies
===============================================

Converse relies on the following dependencies:

* `moment.js <http://momentjs.com/>`_ provides a better API for handling dates and times.
* `Strophe.js <http://strophe.im/>`_ maintains the XMPP session, is used to
  build XMPP stanzas, to send them, and to register handlers for received stanzas.
* `lodash <https://lodash.com/>`_ provides very useful utility functions.
* `Backbone <http://backbonejs.org/>`_ is used to model the data as Models and
  Collections and to create Views that render the UI.
* `backbone.overview <http://github.com/jcbrand/backbone.overview>`_ provides
  ``Backbone.Overview``, which is to Views as Backbone Collection is to Models.
  It also provides the ``Backbone.OrderedListView`` which is used to show
  alphabetically sorted lists, such as your contacts roster.
* `backbone.vdomview <http://github.com/jcbrand/backbone.vdomview>`_ provides
  ``Backbone.VDOMView`` that uses the `Snabbdom <https://github.com/snabbdom/snabbdom>`_ 
  virtual DOM for rendering DOM elements.
* `pluggable.js <https://github.com/jcbrand/pluggable.js>`_ provides the plugin
  architecture for Converse. It registers and initializes plugins and
  allows existing attributes, functions and objects on Converse to be
  overridden inside plugins.

.. _`dependency-libsignal`:

Libsignal
---------

If you want OMEMO encryption, you need to load `libsignal
<https://github.com/signalapp/libsignal-protocol-javascript>`_ separately in
your page.

For example::

    <script src="3rdparty/libsignal-protocol-javascript/dist/libsignal-protocol.js"></script>

The reason libsignal needs to be loaded separately is because it's released
under the `GPLv3 <https://github.com/signalapp/libsignal-protocol-javascript/blob/master/LICENSE>`_
which requires all other dependent JavaScript code to also be open sourced under the same
license. You might not be willing to adhere to those terms, which is why you
need to decide for yourself whether you're going to load libsignal or not.
