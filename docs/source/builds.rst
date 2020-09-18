.. raw:: html

    <div id="banner"><a href="https://github.com/jcbrand/converse.js/blob/master/docs/source/builds.rst">Edit me on GitHub</a></div>


.. _builds:

=================
Generating builds
=================

.. contents:: Table of Contents
   :depth: 3
   :local:


.. warning:: There current documentation in this section does not adequately
    explain how to create custom bundles.

.. Note:: Please make sure to read the section :doc:`development` and that you have installed
    all development dependencies (long story short, you should be able to just run  ``make dev``)

.. _creating_builds:

Creating JavaScript and CSS bundles and distribution files
==========================================================

Converse uses `webpack <https://webpack.js.org/>`_ to create the final JavaScript and CSS distribution files.

The generated distribution files are all placed in the ``./dist`` directory.
The Converse repository does not include ``dist`` directory by default.

To generate the ``./dist`` directory and all CSS and JavaScript bundles, simply run ``make dist``.

When you're developing, and constantly changing code, you can run ``make watch``
to let the bundles be automatically generated as soon as you edit a file.

.. note::

   If you're on Windows or don't have GNU Make installed, you can run ``npm build``
   to build all the distribution files.


Creating custom bundles
=======================

One reason you might want to create your own bundles, is because you want to
remove some of the core plugins of Converse, or perhaps you want to include
your own.

To add or remove plugins from the build, you need to modify the
`src/converse.js <https://github.com/conversejs/converse.js/blob/master/src/converse.js>`_ file.

You'll find a section marked ``/* START: Removable components`` and
``/* END: Removable components */``.

In this section is listed the Converse plugins that will make up a bundle.

You could for example decide to disable the ControlBox altogether by removing
the ``converse-controlbox`` plugin.

After doing so, you need to run ``make dist`` again in the root or your
Converse repository, in order to generate the new build.

Be aware that some plugins might have dependencies on other plugins, so if you
remove a certain plugin but other included plugins still depend on it, then it
will still be included in your build.

To see which other plugins a particular plugin depends on, open it up in your
text editor and look at the list specified as the second parameter to the
``define`` call, near the top of the file. This list specifies the dependencies
of that plugin.

Besides the standard build, the Converse repository includes configuration
for certain other non-standard builds, which we'll now mention below.

Excluding all 3rd party dependencies
------------------------------------

The ``dist/converse-no-dependencies.js`` bundle contains only the core Converse
code and none of the 3rd party dependencies. This might be useful if you need
to load the dependencies separately.

To generate this bundle, you can run:

::

    make dist/converse-no-dependencies.js
    make dist/converse-no-dependencies.min.js

Headless build
--------------

Converse also has a special build called the `headless build`.

You can generate it by running ``make dist/converse-headless.js``

The headless build is a bundle of all the non-UI parts of Converse, and its aim
is to provide you with an XMPP library (and application) on which you can build
your own UI.

It's also installable as `@converse/headless <https://www.npmjs.com/package/@converse/headless>`_.

The main distribution of Converse relies on the headless build.

The file `src/headless/headless.js <https://github.com/jcbrand/converse.js/blob/master/src/headless/headless.js>`_
is used to determine which plugins are included in the build.
