.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

Developer guidelines
====================

.. contents:: Table of Contents
   :depth: 2
   :local:

If you want to work with the non-minified Javascript and CSS files you'll soon
notice that there are references to a missing *node_modules* directory.
Please follow the instructions below to create these directories and fetch Converse's
3rd-party dependencies.

.. note::
    Windows environment: We recommend installing the required tools using `Chocolatey <https://chocolatey.org/>`_
    You will need Node.js (nodejs.install), Git (git.install) and optionally to build using Makefile, GNU Make (make)
    If you have trouble setting up a development environment on Windows,
    please read `this post <http://librelist.com/browser//conversejs/2014/11/5/openfire-converse-and-visual-studio-questions/#b28387e7f8f126693b11598a8acbe810>`_
    in the mailing list.:

Installing the development and front-end dependencies
-----------------------------------------------------

We use development tools which depend on Node.js and npm (the Node package manager).

If you don't have Node.js installed, you can download and install the latest
version `here <https://nodejs.org/download>`_.

Also make sure you have ``Git`` installed. `Details <http://git-scm.com/book/en/Getting-Started-Installing-Git>`_.

.. note::
    Windows users should use Chocolatey as recommended above.

.. note::
    Debian & Ubuntu users : apt-get install git npm nodejs-legacy

Once you have *Node.js* and *git* installed, run the following command inside the Converse.js
directory:

::

    make dev

On Windows you need to specify Makefile.win to be used by running: ::

    make -f Makefile.win dev

Or alternatively, if you don't have GNU Make:

::

    npm install

This will install the Node.js development tools and Converse.js's front-end dependencies.

The front-end dependencies are those javascript files on which
Converse.js directly depends and which will be loaded in the browser.

To see the dependencies, take a look at whats under the *devDependencies* key in
    `package.json <https://github.com/jcbrand/converse.js/blob/master/package.json>`_.

.. note::
    After running ```make dev```, you should now have a new *node_modules* directory
    which contains all the external dependencies of Converse.js.
    If these directory does NOT exist, something must have gone wrong.
    Double-check the output of ```make dev``` to see if there are any errors
    listed. For support, you can write to the mailing list: conversejs@librelist.com

Loading converse.js and its dependencies
----------------------------------------

With AMD and require.js (recommended)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Converse.js uses `require.js <http://requirejs.org>`_ to asynchronously load dependencies.

If you want to develop or customize converse.js, you'll want to load the
non-minified javascript files.

Add the following two lines to the *<head>* section of your webpage:

.. code-block:: html

    <link rel="stylesheet" type="text/css" media="screen" href="converse.css">
    <script data-main="main" src="node_modules/requirejs/require.js"></script>

require.js will then let the main.js file be parsed (because of the *data-main*
attribute on the *script* tag), which will in turn cause converse.js to be
parsed.

Without AMD and require.js
~~~~~~~~~~~~~~~~~~~~~~~~~~

Converse.js can also be used without require.js. If you for some reason prefer
to use it this way, please refer to
`non_amd.html <https://github.com/jcbrand/converse.js/blob/master/non_amd.html>`_
for an example of how and in what order all the Javascript files that converse.js
depends on need to be loaded.

Brief description of converse.js's dependencies
-----------------------------------------------

Converse.js relies on the following dependencies:

* `JQuery <http://jquery.com/>`_ for DOM manipulation and `promises <http://api.jquery.com/promise/>`_.
* `moment.js <http://momentjs.com/>`_ provides a better API for handling dates and times.
* `Strophe.js <http://strophe.im/>`_ maintains the XMPP session, is used to
  build XMPP stanzas, to send them, and to register handlers for received stanzas.
* `lodash <https://lodash.com/>`_ provides very useful utility functions.
* `Backbone <http://backbonejs.org/>`_ is used to model the data as Models and
  Collections and to create Views that render the UI.
* `backbone.overview <http://github.com/jcbrand/backbone.overview>`_ provides
  Overviews, which are to Views as Backbone Collections are to Models.
* `pluggable.js <https://github.com/jcbrand/pluggable.js>`_ is the plugin
  architecture for Converse.js. It registers and initializes plugins and
  allows existing attributes, functions and objects on converse.js to be
  overridden inside plugins.

When submitting a pull request
------------------------------

Please follow the usual github workflow. Create your own local fork of this repository,
make your changes and then submit a pull request.

Follow the programming style guide
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Please read the `style guide </docs/html/style_guide.html>`_ and make sure that your code follows it.

Add tests for your bugfix or feature
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Add a test for any bug fixed or feature added. We use Jasmine
for testing.

Take a look at `tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
and the `spec files <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
to see how tests are implemented.

Check that the tests pass
~~~~~~~~~~~~~~~~~~~~~~~~~
Check that all tests complete sucessfully.

Run ``make check`` in your terminal or open `tests.html <https://github.com/jcbrand/converse.js/blob/master/tests.html>`_
in your browser.
