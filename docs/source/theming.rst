.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/theming.rst">Edit me on GitHub</a></div>

.. _theming:

=======
Theming
=======

Setting up your environment
===========================

In order to theme Converse, you first need to set up a :ref:`development` environment.

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
see the Converse website.

However, when developing or changing the theme, you'll want to load all the
unminified JS and CSS resources as separate files. To do this, open http://localhost:8000/dev.html
instead.


Modifying the HTML templates of Converse
========================================

The HTML markup of Converse is contained in small ``.html`` files in the
``./src/templates`` directory.

You can modify HTML markup that Converse generates by modifying these files.

Modifying the CSS
=================

The CSS files are generated from `Sass <http://sass-lang.com>`_ files in the ``./sass`` directory.

To generate the CSS you can run::

    make css

Testing your changes
=======

The recommended way to test your changes is to run the tests that are part of the Converse source code.
By executing ``make test`` you'll run all tests (which live in the ``spec`` folder) which will open a browser window in which tests are processed.

You can run a single test by changing ``it(`` to ``fit(`` so that only that one test runs. Then you click the "debug" button in the browser when the tests run. After the test has run, the opened chats will still be visible.


Creating dist files
===================

Once you've themed Converse, you'll want to create new minified distribution
files of all the JavaScript and CSS.

Please refer to the :doc:`builds` section for information on how this is done.

