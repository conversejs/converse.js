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

Creating JavaScript and CSS bundles and distribution files
==========================================================

Converse uses `webpack <https://webpack.js.org/>`_ to create single build files containing the core code and
all of the 3rd party dependencies.

These files are in the `dist <https://github.com/conversejs/converse.js/tree/master/dist>`_ directory.

Before you start changing the core code, you can run ``make watchjs`` in your terminal.

This command will listen for any changed files and then automatically create a
new build of ``dist/converse.js``.

The CSS files are also generated, from the scss files in the
`sass <https://github.com/conversejs/converse.js/tree/master/sass>`_ directory.

Similarly to ``make watchjs``, you can run ``make watch`` to automatically
generate the css files in the ``./css/`` directory.

The Converse repository does not include the minified files in the ``dist`` or
``css`` directories. Before deployment, you'll want to generate them yourself.

To do so, run the following:

::
    make dist/converse.min.js
    make css/converse.min.css

Alternatively, if you want to generate ALL the bundles files (minified and
unminified), then you can also run::

    make dist


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

There is also the option of making a headless build of Converse.

This is a build without any UI code but still containing the core functionality of
maintaining a roster, chats and messages.

The file `src/headless.js <https://github.com/jcbrand/converse.js/blob/master/src/headless.js>`_
is used to determine which plugins are included in the build.

.. Note:: Unfortunately it's currently not yet possible to include Multi-user chat (MUC)
    functionality in the headless build. This is because both the UI and core
    functionality is still contained in one plugin and would first need to be
    split up into two parts, with the UI part dropped for this build.
