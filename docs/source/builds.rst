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

Creating builds
===============

We  use `require.js <http://requirejs.org>`_ to keep track of *Converse.js* and
its dependencies and to to bundle them together in a single file fit for
deployment to a production site.

To create the bundles, simply run::

    make build

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

The built Javasript bundles are contained in the ``./builds`` directory:

.. code-block:: bash

    jc@conversejs:~/converse.js (master)$ ls builds/
    converse.js               converse-no-locales-no-otr.js      converse.website.min.js
    converse.min.js           converse-no-locales-no-otr.min.js  converse.website-no-otr.min.js
    converse.nojquery.js      converse-no-otr.js                 locales.js
    converse.nojquery.min.js  converse-no-otr.min.js             templates.js

.. _`minification`:

Minifying the CSS
-----------------

To only minify the CSS files, nothing else, run the following command::

    make cssmin

The CSS files  are minified via `cssmin <https://github.com/gruntjs/grunt-contrib-cssmin>`_.

