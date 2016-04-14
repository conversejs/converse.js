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

We  use `require.js <http://requirejs.org>`_ to keep track of *Converse.js* and
its dependencies and to to bundle them together in a single file fit for
deployment to a production site.

To create the distributable bundles, simply run::

    make dist

This command does the following:

* It creates different Javascript bundles of Converse.js.
  The individual javascript files will be bundled and minified with `require.js`_'s
  optimization tool, using `almond <https://github.com/jrburke/almond>`_.
  You can `read more about require.js's optimizer here <http://requirejs.org/docs/optimization.html>`_.

* It bundles the HTML templates in ``./src/templates/`` into a single file called ``templates.js``.
  This file can then be included via the ``<script>`` tag. See for example the ``non_amd.html`` example page.

* It bundles all the translation files in ``./locale/`` into a single file ``locales.js``.
  This file can then be included via the ``<script>`` tag. See for example the ``non_amd.html`` example page.

* Also, the CSS files in the ``./css`` directory will be minified.

The built Javasript bundles are contained in the ``./dist`` directory:

.. code-block:: bash

    jc@conversejs:~/converse.js (master)$ ls dist/
    converse.js               converse-no-dependencies.js      
    converse.min.js           converse-no-dependencies.min.js  
    converse.nojquery.js      locales.js
    converse.nojquery.min.js  templates.js

.. _`minification`:

Minifying the CSS
-----------------

To only minify the CSS files, nothing else, run the following command::

    make cssmin

The CSS files  are minified via `cssmin <https://github.com/gruntjs/grunt-contrib-cssmin>`_.

