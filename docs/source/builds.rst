======================
Creating custom builds
======================

.. contents:: Table of Contents
   :depth: 3
   :local:


.. warning:: There current documentation in this section does not adequately
    explain how to create custom builds.

.. _`minification`:

Minification
============

Minifying Javascript and CSS
----------------------------

Please make sure to read the section :doc:`development` and that you have installed
all development dependencies (long story short, you can run ``npm install``
and then ``grunt fetch``).

We  use `require.js <http://requirejs.org>`_ to keep track of *Converse.js* and its dependencies and to
to bundle them together in a single minified file fit for deployment to a
production site.

To minify the Javascript and CSS, run the following command:

::

    grunt minify

Javascript will be bundled and minified with `require.js`_'s optimization tool,
using `almond <https://github.com/jrburke/almond>`_.

You can `read more about require.js's optimizer here <http://requirejs.org/docs/optimization.html>`_.

CSS is minified via `cssmin <https://github.com/gruntjs/grunt-contrib-cssmin>`_.
