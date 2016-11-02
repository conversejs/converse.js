.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/builds.rst">Edit me on GitHub</a></div>


.. _builds:

===============
Creating builds
===============

.. contents:: Table of Contents
   :depth: 3
   :local:


.. warning:: There current documentation in this section does not adequately
    explain how to create custom builds.

.. note:: Please make sure to read the section :doc:`development` and that you have installed
    all development dependencies (long story short, you should be able to just run  ``make dev``)

Creating builds and distribution files
======================================

Converse.js uses `AMD (Asynchronous Modules Definition) <http://requirejs.org/docs/whyamd.html#amd>`_
to define modules and their dependencies.

Dependencies can then be loaded on-the-fly with `require.js <http://requirejs.org>`_.
This is very useful during development, but when it comes to
deployement, it's usually desired to create a single, minified distribution build.

For this, the `r.js optimizer <http://requirejs.org/docs/optimization.html>`_
is used together with `almond.js <https://github.com/requirejs/almond>`_, which
is a minimal AMD API implementation that replaces require.js in builds (in
order to keep the build smaller).

To create the distribution build, simply run::

    make dist

This command does the following:

* It creates different builds of Converse.js in the ``./dist/`` directory.

* It bundles all the translation files in ``./locale/`` into a single file ``locales.js``.
  This file can then be included via the ``<script>`` tag. See for example the ``non_amd.html`` example page.

* Also, the CSS files in the ``./css`` directory will be minified.

The Javascript build files are contained in the ``./dist`` directory:

.. code-block:: bash

    jc@conversejs:~/converse.js (master)$ ls dist/
    converse-mobile.js               converse.min.js
    converse-mobile.min.js           converse.nojquery.js
    converse-no-dependencies.js      converse.nojquery.min.js
    converse-no-dependencies.min.js  locales.js
    converse.js

.. _`minification`:

Minifying the CSS
-----------------

To only minify the CSS files, nothing else, run the following command::

    make cssmin

The CSS files  are minified via `cssmin <https://github.com/gruntjs/grunt-contrib-cssmin>`_.

