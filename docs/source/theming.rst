.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

=======
Theming
=======

.. contents:: Table of Contents
   :depth: 2
   :local:

Setting up your environment
===========================

In order to theme converse.js, you'll first need to set up a `development_` environment.

You'll also want to preview the changes you make in the browser.

To set up the development environment and also start up a web browser which
will serve the files for you, simply run::

    make serve

You can now open http://localhost:8000 in your webbrowser to see the
converse.js website.

However, when developing or changing the theme, you'll want to load all the
unminified JS and CSS resources. To do this, open http://localhost:8000/dev.html
instead.

Mockups
=======

Converse.js contains some mockups in the ``./mockup`` directory against which you
can preview and tweak your changes.

The ``./mockup/index.html`` file contains the most comprehensive mockup, while
the other files focus on particular UI aspects.

To see it in your browser, simply open: http://localhost:8000/mockup


Modifying the HTML templates of Converse.js
===========================================

The HTML markup of converse.js is contained small ``.html`` files in the
``./src/templates`` directory.

Modifying the CSS
=================

The CSS files are generated from `Sass <http://sass-lang.com>`_ files in
the ``./sass`` directory.

To generate the CSS you can run::

    make css

Creating builds
===============

Once you've themed converse.js, you'll want to create new minified builds of
the Javascript and CSS files.

Please refer to the :doc:`builds` section for information on how this is done.

