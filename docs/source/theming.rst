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

In order to theme converse.js, you first need to set up a :ref:`development` environment.

You'll also want to preview the changes you make in your browser, for which a
webserver will be useful.

To both set up the development environment and also start up a web browser to 
serve the files for you, simply run::

    make serve

.. note::
    To run the "make" commands, you'll need `GNUMake <https://www.gnu.org/software/make>`_
    installed on your computer. If you use GNU/Linux or \*BSD, it should be installed or
    available via your package manager. For Mac, I think you need to install XCode and in
    Windows you can use `Chocolatey <https://chocolatey.org/>`_.

After running ``make serve`` you can open http://localhost:8000 in your webbrowser you'll
see the converse.js website.

However, when developing or changing the theme, you'll want to load all the
unminified JS and CSS resources as separate files. To do this, open http://localhost:8000/dev.html
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

The HTML markup of converse.js is contained in small ``.html`` files in the
``./src/templates`` directory.

You can modify HTML markup that converse.js generates by modifying these files.

Modifying the CSS
=================

The CSS files are generated from `Sass <http://sass-lang.com>`_ files in the ``./sass`` directory.

To generate the CSS you can run::

    make css

Creating dist files
===================

Once you've themed converse.js, you'll want to create new minified distribution
files of all the Javascript and CSS.

Please refer to the :doc:`builds` section for information on how this is done.

